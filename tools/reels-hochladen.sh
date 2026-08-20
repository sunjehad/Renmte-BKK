#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════
# Die Web-Fassungen der Reels in den Supabase-Bucket "work" laden.
#
# Voraussetzung: Der Bucket "work" existiert und ist OEFFENTLICH.
#   Dashboard -> Storage -> New bucket -> Name "work", Public an.
#   Der CLI kann keine Buckets anlegen (Stand 2.108.0, nur ls/cp/mv/rm).
#
# Die Dateien entstehen aus dem Dropbox-Material mit
# tools/reels-web-fassung.sh und liegen unter images/work/ (gitignore).
#
# Aufruf:  ./tools/reels-hochladen.sh
#
# Angelegt 2026-08-20 mit der Arbeitsproben-Galerie.
# ══════════════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

QUELLE="images/work"
BUCKET="work"

if [ ! -d "$QUELLE" ]; then
  echo "FEHLER: $QUELLE fehlt. Erst tools/reels-web-fassung.sh laufen lassen." >&2
  exit 1
fi

ANZ=$(find "$QUELLE" -type f \( -name '*.mp4' -o -name '*.jpg' \) | wc -l | tr -d ' ')
echo "Lade $ANZ Dateien nach ss:///$BUCKET/ ..."

# Eine Woche Zwischenspeicher: Die Reels aendern sich nicht. Das spart
# Uebertragungsvolumen -- der kostenlose Tarif gibt 5 GB im Monat her.
# Wird ein Reel ersetzt, muss es einen neuen Dateinamen bekommen, sonst
# sehen wiederkehrende Besucher bis zu sieben Tage lang das alte.
supabase storage cp -r "$QUELLE" "ss:///$BUCKET" \
  --linked --experimental \
  --jobs 4 \
  --cache-control "max-age=604800"

echo
echo "Fertig. Gegenprobe -- diese Adresse muss ein Bild liefern:"
echo "  https://nghsyxwhczvwaorssgoh.supabase.co/storage/v1/object/public/$BUCKET/b11.jpg"
echo
echo "Danach in work-media.js MEDIA umstellen auf:"
echo "  'https://nghsyxwhczvwaorssgoh.supabase.co/storage/v1/object/public/$BUCKET/'"
