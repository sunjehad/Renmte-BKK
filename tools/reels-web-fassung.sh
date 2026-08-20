#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════
# Web-Fassungen der Reels erzeugen: 1080x1920 -> 720x1280, Ton behalten,
# dazu je ein Standbild. Aus 6-15 MB werden 1-2 MB.
#
# Ausgabe nach images/work/ (gitignore) -- von dort holt sie
# tools/reels-hochladen.sh in den Supabase-Bucket.
#
# WELCHE REELS: nur preisfreie. Die A-Reihe a01-a06 und die acht Reels vom
# 06.08. tragen die Aktionspreise samt "bis 31. August" im Bild und waeren
# ab dem 1. September falsch (docs/todo.md, T-13).
#
# Angelegt 2026-08-20 mit der Arbeitsproben-Galerie.
# ══════════════════════════════════════════════════════════════════════════
set -e
D="$HOME/Dropbox/Video aller Projekte/rentme"
S="$(cd "$(dirname "$0")/.." && pwd)/images/work"
mkdir -p "$S"

pack(){  # $1 = Quelldatei, $2 = Zielname ohne Endung
  ffmpeg -y -loglevel error -i "$1" \
    -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" \
    -c:v libx264 -crf 26 -preset slow -profile:v high -level 4.0 \
    -c:a aac -b:a 96k -ac 2 \
    -movflags +faststart -pix_fmt yuv420p "$S/$2.mp4"
  ffmpeg -y -loglevel error -ss 1 -i "$S/$2.mp4" -frames:v 1 \
    -vf "scale=540:960" -q:v 6 "$S/$2.jpg"
  printf '%-10s %6s  %s\n' "$2" "$(du -h "$S/$2.mp4" | cut -f1)" "ok"
}

for n in 01 02 03 04 05 06 07 08 09 10; do
  pack "$D/fertig/reels-inhalt-2026-08-09/rentme-n$n.mp4" "n$n"
done
for n in a07 a08 b09 b10 b11 b12 b13 c14; do
  pack "$D/fertig/reels-2026-08-09/rentme-$n.mp4" "$n"
done
echo "FERTIG"
