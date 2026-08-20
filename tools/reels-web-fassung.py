#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Web-Fassungen der ausgewaehlten Reels erzeugen.

Liest ``tools/reels-auswahl.json`` -- das ist die eine Stelle, an der steht,
welche Reels auf die Seite gehoeren -- und legt fuer jedes zwei Dateien in
``images/work/`` ab:

    <id>.mp4    720x1280, H.264, Ton behalten. Aus 6-15 MB werden 1-2 MB.
    <id>.jpg    Standbild bei Sekunde 1, 540x960.

``images/work/`` steht in ``.gitignore``: Die Videos gehoeren nicht ins Repo,
sondern in den Supabase-Bucket (siehe ``tools/reels-hochladen.sh``).

Aufruf:  python3 tools/reels-web-fassung.py [--neu]
         --neu  erzeugt auch schon vorhandene Dateien noch einmal

Angelegt 2026-08-20 mit der Arbeitsproben-Galerie.
"""
import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUSWAHL = os.path.join(WURZEL, "tools", "reels-auswahl.json")
ZIEL = os.path.join(WURZEL, "images", "work")

NEU = "--neu" in sys.argv


def pfad(p):
    return os.path.expanduser(p)


def eines(r):
    """Ein Reel umrechnen. Gibt (id, Meldung) zurueck."""
    quelle = pfad(r["quelle"])
    mp4 = os.path.join(ZIEL, r["id"] + ".mp4")
    jpg = os.path.join(ZIEL, r["id"] + ".jpg")

    if not os.path.exists(quelle):
        return r["id"], "FEHLT: " + r["quelle"]

    fertig = all(os.path.exists(f) and os.path.getsize(f) > 0 for f in (mp4, jpg))
    if fertig and not NEU:
        return r["id"], "schon da"

    # Auf 720x1280 bringen, ohne zu verzerren: hochskalieren bis beide Kanten
    # passen, dann mittig beschneiden. Quellen sind 1080x1920, also nur Verkleinern.
    lauf = subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-i", quelle,
        "-vf", "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280",
        "-c:v", "libx264", "-crf", "26", "-preset", "slow",
        "-profile:v", "high", "-level", "4.0",
        "-c:a", "aac", "-b:a", "96k", "-ac", "2",
        "-movflags", "+faststart", "-pix_fmt", "yuv420p", mp4,
    ], capture_output=True, text=True)
    if lauf.returncode:
        return r["id"], "ffmpeg-Fehler: " + lauf.stderr.strip()[:120]

    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-ss", "1", "-i", mp4,
        "-frames:v", "1", "-vf", "scale=540:960", "-q:v", "6", jpg,
    ], capture_output=True)

    mb = os.path.getsize(mp4) / 1024 / 1024
    return r["id"], f"{mb:.1f} MB"


def main():
    doc = json.load(open(AUSWAHL, encoding="utf-8"))
    reels = doc["reels"]
    os.makedirs(ZIEL, exist_ok=True)

    print(f"{len(reels)} Reels aus tools/reels-auswahl.json\n")
    with ThreadPoolExecutor(max_workers=4) as p:
        ergebnisse = list(p.map(eines, reels))

    for kennung, meldung in ergebnisse:
        print(f"  {kennung:<8} {meldung}")

    kaputt = [k for k, m in ergebnisse if m.startswith(("FEHLT", "ffmpeg"))]
    gesamt = sum(
        os.path.getsize(os.path.join(ZIEL, r["id"] + ".mp4"))
        for r in reels
        if os.path.exists(os.path.join(ZIEL, r["id"] + ".mp4"))
    )
    print(f"\nZusammen {gesamt / 1024 / 1024:.1f} MB in images/work/")

    warn = [r["id"] for r in reels if r.get("preis") or r.get("kunde")]
    if warn:
        print("Mit Vorbehalt in der Auswahl: " + ", ".join(warn)
              + "  (siehe _warnungen in reels-auswahl.json)")

    if kaputt:
        print("\nFEHLGESCHLAGEN: " + ", ".join(kaputt))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
