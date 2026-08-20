#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════
# Die Web-Fassungen der Reels in den Supabase-Bucket "work" laden.
#
# Voraussetzung: Der Bucket "work" existiert und ist OEFFENTLICH.
#   Dashboard -> Storage -> New bucket -> Name "work", Public an.
#   Der CLI kann keine Buckets anlegen (Stand 2.108.0, nur ls/cp/mv/rm).
#
# Die Dateien entstehen aus dem Dropbox-Material mit
# tools/reels-web-fassung.py und liegen unter images/work/ (gitignore).
#
# Aufruf:  ./tools/reels-hochladen.sh
#
# Angelegt 2026-08-20 mit der Arbeitsproben-Galerie.
# ══════════════════════════════════════════════════════════════════════════
set -uo pipefail
fehler=0
cd "$(dirname "$0")/.."

QUELLE="images/work"
BUCKET="work"

if [ ! -d "$QUELLE" ]; then
  echo "FEHLER: $QUELLE fehlt. Erst tools/reels-web-fassung.sh laufen lassen." >&2
  exit 1
fi

ANZ=$(find "$QUELLE" -type f \( -name '*.mp4' -o -name '*.jpg' \) | wc -l | tr -d ' ')
echo "Lade $ANZ Dateien in die Wurzel von ss:///$BUCKET ..."
echo

# Datei fuer Datei statt "cp -r": Der rekursive Aufruf legt den ORDNER im
# Bucket an, nicht seinen Inhalt -- die Dateien landen dann unter
# work/work/n02.jpg statt work/n02.jpg. Am 20.08. genau so passiert.
#
# Eine Woche Zwischenspeicher: Die Reels aendern sich nicht. Das spart
# Uebertragungsvolumen -- der kostenlose Tarif gibt 5 GB im Monat her.
# Wird ein Reel ersetzt, muss es einen neuen Dateinamen bekommen, sonst
# sehen wiederkehrende Besucher bis zu sieben Tage lang das alte.
for datei in "$QUELLE"/*.mp4 "$QUELLE"/*.jpg; do
  [ -e "$datei" ] || continue
  name=$(basename "$datei")
  printf '  %-14s' "$name"
  if supabase storage cp "$datei" "ss:///$BUCKET/$name" \
       --linked --experimental --cache-control "max-age=604800" >/dev/null 2>&1
  then echo "ok"
  else echo "FEHLER"; fehler=1
  fi
done

BASIS="https://nghsyxwhczvwaorssgoh.supabase.co/storage/v1/object/public/$BUCKET"

echo
echo "Gegenprobe -- jede Datei aus der Auswahl oeffentlich abrufbar?"
schlecht=0
while IFS= read -r kennung; do
  for endung in mp4 jpg; do
    code=$(curl -s -o /dev/null -w '%{http_code}' "$BASIS/$kennung.$endung")
    [ "$code" = "200" ] || { echo "  FEHLT: $kennung.$endung ($code)"; schlecht=$((schlecht+1)); }
  done
done < <(python3 -c "
import json
for r in json.load(open('tools/reels-auswahl.json'))['reels']: print(r['id'])
")

if [ "$schlecht" = "0" ] && [ "$fehler" = "0" ]; then
  echo "  alle abrufbar."
  echo
  echo "MEDIA in work-media.js muss stehen auf:"
  echo "  '$BASIS/'"
else
  echo
  echo "NICHT vollstaendig -- $schlecht Datei(en) fehlen. MEDIA nicht umstellen."
  exit 1
fi
