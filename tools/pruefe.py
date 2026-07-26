#!/usr/bin/env python3
"""Prueft die HTML-Seiten, bevor etwas ausgespielt wird.

Warum es das gibt
-----------------

Dieses Projekt hat keine Testumgebung und keinen Build-Schritt. Ein Tippfehler
im eingebetteten JavaScript faellt deshalb nicht beim Bauen auf, sondern erst
dann, wenn eine Kundin die Buchung nicht abschliessen kann. Diese Pruefung
schliesst die Luecke fuer genau die Fehlerklassen, die eine Seite **still**
kaputt machen:

* **Syntaxfehler** -- ein einziger davon legt den gesamten ``<script>``-Block
  lahm. Die Seite sieht dann normal aus und tut nichts mehr.
* **Doppelte Schluessel** in einem Objektliteral -- der letzte gewinnt, ohne
  Warnung. Genau dieser Fehler steckte am 2026-07-27 in ``booking.html``
  (``customerName`` zweimal, der zweite Wert war ``undefined``).
* **Verweise auf Elemente, die es nicht gibt** -- ``getElementById`` liefert
  ``null``, der naechste Zugriff wirft, und der Rest der Funktion laeuft nie.
* **Klick-Handler ohne Funktion** -- ein ``onclick="foo()"`` ohne ``foo``
  ist ein Knopf, der nichts tut.
* **Geheime Schluessel** im Frontend -- darf nie passieren (``decisions.md``
  R-002).

Was sie **nicht** kann
----------------------

Sie fuehrt nichts aus. Ob die Buchungsstrecke fachlich richtig rechnet, ob
Supabase antwortet und ob Stripe die richtige Summe bekommt, sagt sie **nicht**.
Dafuer gibt es den zweiten Schritt in ``docs/pruefen.md`` -- Seite lokal laden
und die Browser-Konsole lesen.

Aufruf
------

    python3 tools/pruefe.py            # alle Seiten
    python3 tools/pruefe.py booking.html

Rueckgabe: 0 = sauber, 1 = Befunde, 2 = Aufruffehler.
"""

import html.parser
import re
import subprocess
import sys
import tempfile
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent

#: Bekannte, bewusst geduldete Befunde -- eine Zeile je Eintrag,
#: Format `datei:art:meldung`. Siehe docs/pruefen.md.
BEKANNT_DATEI = Path(__file__).resolve().parent / "bekannt.txt"

#: Die Seiten, die tatsaechlich ausgeliefert werden.
SEITEN = ["index.html", "booking.html", "admin.html", "profile.html", "auth.html"]

#: Muster, die niemals in einer Frontend-Datei stehen duerfen.
GEHEIM = [
    (r"sk_live_[A-Za-z0-9]+", "Stripe-GEHEIMSCHLUESSEL (sk_live)"),
    (r"sk_test_[A-Za-z0-9]+", "Stripe-Testgeheimschluessel (sk_test)"),
    (r"SUPABASE_SERVICE_ROLE_KEY", "Supabase-Service-Role-Schluessel"),
    (r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}",
     "JWT -- pruefen, ob es der oeffentliche Anon-Schluessel ist"),
]


class Sammler(html.parser.HTMLParser):
    """Liest ``id``-Attribute und eingebettete Skripte aus einer Seite."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.skripte = []          # (startzeile, quelltext)
        self._in_script = False
        self._script_start = 0
        self._puffer = []

    def handle_starttag(self, tag, attrs):
        werte = dict(attrs)
        if werte.get("id"):
            self.ids.add(werte["id"])
        if tag == "script" and not werte.get("src"):
            self._in_script = True
            self._script_start = self.getpos()[0]
            self._puffer = []

    def handle_endtag(self, tag):
        if tag == "script" and self._in_script:
            self.skripte.append((self._script_start, "".join(self._puffer)))
            self._in_script = False

    def handle_data(self, daten):
        if self._in_script:
            self._puffer.append(daten)


def js_syntax(skripte, datei):
    """Laesst Node jeden Skriptblock pruefen -- ohne ihn auszufuehren."""
    befunde = []
    for start, quelle in skripte:
        if not quelle.strip():
            continue
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False,
                                         encoding="utf-8") as fh:
            fh.write(quelle)
            pfad = fh.name
        try:
            ergebnis = subprocess.run(["node", "--check", pfad],
                                      capture_output=True, text=True)
            if ergebnis.returncode != 0:
                erste = ergebnis.stderr.strip().splitlines()
                meldung = next((z for z in erste if "SyntaxError" in z),
                               erste[0] if erste else "unbekannt")
                befunde.append((datei, start, "SYNTAX",
                                f"Skriptblock ab Zeile {start}: {meldung}"))
        except FileNotFoundError:
            return [(datei, 0, "SYNTAX",
                     "node nicht gefunden -- Syntaxpruefung uebersprungen")]
        finally:
            Path(pfad).unlink(missing_ok=True)
    return befunde


def doppelte_schluessel(skripte, datei):
    """Findet doppelt gesetzte Schluessel im selben Objektliteral.

    Grob, aber gezielt: gezaehlt werden nur Zeilen der Form ``name:`` auf
    derselben Klammertiefe. Ternaere Ausdruecke und Sprungmarken koennen
    Fehlalarm ausloesen -- lieber einmal zu viel hinsehen als diesen Fehler
    noch einmal live zu haben.
    """
    befunde = []
    schluessel_muster = re.compile(r"^\s*([A-Za-z_$][\w$]*)\s*:(?!:)")
    for start, quelle in skripte:
        stapel = [{}]              # je Klammertiefe: schluessel -> zeile
        for versatz, zeile in enumerate(quelle.splitlines()):
            ohne_text = re.sub(r"""(['"`]).*?\1""", "''", zeile)
            ohne_text = re.sub(r"//.*$", "", ohne_text)

            treffer = schluessel_muster.match(ohne_text)
            if treffer and len(stapel) > 1:
                name = treffer.group(1)
                if name in stapel[-1]:
                    befunde.append((
                        datei, start + versatz, "DOPPELT",
                        f"Schluessel '{name}' doppelt im selben Objekt "
                        f"(zuerst Zeile {stapel[-1][name]}) -- der zweite "
                        f"gewinnt stillschweigend"))
                else:
                    stapel[-1][name] = start + versatz

            for zeichen in ohne_text:
                if zeichen == "{":
                    stapel.append({})
                elif zeichen == "}" and len(stapel) > 1:
                    stapel.pop()
    return befunde


def alle_ids(quelltext):
    """Jede ``id``, die auf der Seite entstehen kann.

    Nicht nur die statischen: Markup wird hier reichlich als Zeichenkette
    zusammengebaut (``html += `<div id="...">` ``), und Elemente werden zur
    Laufzeit angelegt (``el.id = 'x'``). Wer nur das fertige HTML ansieht,
    haelt diese fuer fehlend und meldet Unsinn.
    """
    gefunden = set(re.findall(r"""\bid\s*=\s*\\?["']([\w-]+)""", quelltext))
    gefunden |= set(re.findall(r"""\.id\s*=\s*['"]([\w-]+)['"]""", quelltext))
    gefunden |= set(re.findall(r"""setAttribute\(\s*['"]id['"]\s*,\s*['"]([\w-]+)""",
                               quelltext))
    return gefunden


def fehlende_ids(skripte, ids, datei):
    """``getElementById('x')``, wo es kein ``x`` gibt.

    Unterschieden wird, ob das Ergebnis geprueft wird. ``const c = …; if(c)``
    ist abgesichert -- die Zeile ist dann totes, aber harmloses Beiwerk und
    blockiert nichts. Ohne Pruefung wirft der naechste Zugriff, und der Rest
    der Funktion laeuft nie: das ist ein Fehler.
    """
    befunde = []
    muster = re.compile(r"""getElementById\(\s*['"]([\w-]+)['"]\s*\)""")
    zuweisung = re.compile(
        r"""(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=[^=]*getElementById""")
    for start, quelle in skripte:
        zeilen = quelle.splitlines()
        for versatz, zeile in enumerate(zeilen):
            for name in muster.findall(zeile):
                if name in ids:
                    continue
                variable = zuweisung.search(zeile)
                umfeld = " ".join(zeilen[versatz:versatz + 3])
                geprueft = bool(
                    variable and re.search(
                        r"(?:if\s*\(\s*!?\s*%s\b|%s\s*\?|%s\s*&&)"
                        % ((re.escape(variable.group(1)),) * 3), umfeld))
                geprueft = geprueft or "?." in zeile
                befunde.append((
                    datei, start + versatz, "TOT" if geprueft else "ID",
                    f"getElementById('{name}') -- kein Element mit dieser id"
                    + (" (abgesichert, also toter Code)" if geprueft
                       else " und das Ergebnis wird ungeprueft benutzt")))
    return befunde


#: Schluesselwoerter, die in einem Attribut wie ``onkeydown="if(...)…"``
#: stehen duerfen, ohne dass sie eine Funktion waeren.
JS_WOERTER = {"if", "for", "while", "switch", "catch", "return", "typeof",
              "function", "new", "delete", "void", "do", "else", "try"}


def tote_handler(quelltext, skripte, datei):
    """``onclick="foo()"`` ohne dass es ``foo`` gibt."""
    js = "\n".join(q for _, q in skripte)
    definiert = set(re.findall(r"function\s+([A-Za-z_$][\w$]*)", js))
    # Alles, was einer Funktion zugewiesen wird -- auch `window.x = function`
    # und Pfeilfunktionen. Ohne das gilt die halbe Seite als undefiniert.
    definiert |= set(re.findall(
        r"(?:^|[\s;{(])(?:window\.)?([A-Za-z_$][\w$]*)\s*=\s*"
        r"(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)",
        js, re.M))
    definiert |= set(re.findall(r"([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?function", js))

    befunde = []
    # \b vor `on`: sonst trifft das Muster auch `textC|ontent = '…('`.
    muster = re.compile(r"""\bon\w+\s*=\s*["']\s*([A-Za-z_$][\w$]*)\s*\(""")
    for nummer, zeile in enumerate(quelltext.splitlines(), 1):
        for name in muster.findall(zeile):
            if name in definiert or name in JS_WOERTER:
                continue
            befunde.append((datei, nummer, "HANDLER",
                            f"Handler ruft '{name}()' -- nirgends definiert"))
    return befunde


def _jwt_rolle(zeichenkette):
    """Die ``role``-Angabe eines JWT, ohne Pruefung der Signatur.

    Ein Supabase-Anon-Schluessel **gehoert** ins Frontend; ein
    Service-Role-Schluessel waere ein Notfall. Beide sehen gleich aus -- der
    Unterschied steht in der Nutzlast. Ohne diese Unterscheidung meldet die
    Pruefung jedes Mal denselben harmlosen Treffer und wird abgeschaltet.
    """
    import base64
    import json
    try:
        nutzlast = zeichenkette.split(".")[1]
        nutzlast += "=" * (-len(nutzlast) % 4)
        return json.loads(base64.urlsafe_b64decode(nutzlast)).get("role", "?")
    except Exception:
        return "?"


def geheimnisse(quelltext, datei):
    """Geheime Schluessel gehoeren nie in eine ausgelieferte Datei."""
    befunde = []
    for nummer, zeile in enumerate(quelltext.splitlines(), 1):
        for muster, was in GEHEIM:
            treffer = re.search(muster, zeile)
            if not treffer:
                continue
            if was.startswith("JWT"):
                rolle = _jwt_rolle(treffer.group(0))
                if rolle == "anon":
                    continue          # oeffentlich, gehoert dorthin (R-002)
                befunde.append((datei, nummer, "GEHEIM",
                                f"JWT mit role='{rolle}' im Frontend -- "
                                f"nur 'anon' ist zulaessig"))
            else:
                befunde.append((datei, nummer, "GEHEIM", was))
    return befunde


def pruefe_seite(pfad):
    """Alle Pruefungen fuer eine Seite."""
    quelltext = pfad.read_text(encoding="utf-8")
    sammler = Sammler()
    sammler.feed(quelltext)
    name = pfad.name

    befunde = []
    befunde += js_syntax(sammler.skripte, name)
    befunde += doppelte_schluessel(sammler.skripte, name)
    befunde += fehlende_ids(sammler.skripte, alle_ids(quelltext), name)
    befunde += tote_handler(quelltext, sammler.skripte, name)
    befunde += geheimnisse(quelltext, name)
    return befunde


def lade_bekannt():
    """Die geduldeten Altbefunde.

    Ohne diese Liste stuende die Pruefung wegen laengst bekannter Altlasten
    dauerhaft rot -- und wuerde nach zwei Tagen niemanden mehr interessieren.
    Neue Befunde brechen weiterhin.
    """
    if not BEKANNT_DATEI.is_file():
        return set()
    eintraege = set()
    for zeile in BEKANNT_DATEI.read_text(encoding="utf-8").splitlines():
        zeile = zeile.strip()
        if zeile and not zeile.startswith("#"):
            eintraege.add(zeile)
    return eintraege


def schluessel(befund):
    """Kennung ohne Zeilennummer -- sonst zaehlt jede eingefuegte Zeile neu."""
    datei, _, art, meldung = befund
    return f"{datei}:{art}:{meldung}"


def main(argv):
    ziele = argv[1:] or SEITEN
    bekannt = lade_bekannt()
    alle = []
    for eintrag in ziele:
        pfad = WURZEL / eintrag
        if not pfad.is_file():
            print(f"Nicht gefunden: {pfad}", file=sys.stderr)
            return 2
        befunde = pruefe_seite(pfad)
        neu = [b for b in befunde if schluessel(b) not in bekannt]
        alle += neu
        geduldet = len(befunde) - len(neu)
        zeichen = "FEHLER" if neu else "ok"
        anhang = f", {geduldet} bekannt" if geduldet else ""
        print(f"{eintrag:<16} {zeichen:>7}  ({len(neu)} neu{anhang})")

    if alle:
        print()
        for datei, zeile, art, meldung in sorted(alle):
            print(f"{datei}:{zeile}:{art}:{meldung}")
        print(f"\n{len(alle)} neue(r) Befund(e). **Nicht ausspielen.**")
        return 1

    print("\nKeine neuen Befunde. Das heisst: keine der geprueften "
          "Fehlerklassen.\nOb die Buchung fachlich stimmt, sagt diese "
          "Pruefung nicht -- siehe docs/pruefen.md, Schritt 2.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
