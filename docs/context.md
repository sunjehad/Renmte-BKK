# Kontext — RentMe Bangkok

Aktueller Stand. Bei jeder größeren Änderung nachziehen.
Dauerhaftes Wissen steht in `CLAUDE.md`, Begründungen in `decisions.md`.

**Stand: 2026-07-27**

---

## Wo das Projekt steht

Die Website ist **im Betrieb** und nimmt echtes Geld entgegen. Sie ist kein
Entwurf und kein Prototyp — was hier geändert wird, wirkt auf zahlende
Kundschaft.

Gleichzeitig ist sie das am wenigsten gepflegte Projekt im Bestand: bis zum
2026-07-27 gab es **keine einzige Dokumentationsdatei**, keine Tests und keine
festgehaltene Entscheidung. Dieser Ordner `docs/` ist der erste Schritt dagegen.

## Git

- Branch `main`, **13 Commits**, letzter inhaltlicher vom **2026-07-21**.
- ⚠️ **Ein Commit ist nicht gepusht** (`57ebc3c`). `main` liegt eins vor
  `origin/main`.
- Remote: `https://github.com/sunjehad/Renmte-BKK.git` — **Eigentümer
  ungeklärt** (`todo.md` T-4). Der Tippfehler im Repo-Namen ist echt.
- Der Doku-Wächter des Gehirns läuft hier als `post-commit`-Hook.

## Was zuletzt geschah

**2026-07-27** — Erste Bestandsaufnahme durch BrainMag, Fokusübernahme.
Rein lesend erhoben, dann:

- **Ein echter Fehler behoben:** In `booking.html` war `customerName` zweimal
  im selben Objektliteral gesetzt; die zweite Angabe (`state.name`) überschrieb
  die erste, und `state.name` existiert im gesamten Projekt nicht. Stripe bekam
  in **beiden** Zahlungspfaden einen leeren Kundennamen. Behoben.
- **`.backup`-Dateien aus dem Git genommen** (R-004).
- **Doku-Grundstock angelegt** — dieses Verzeichnis, `README.md`, `CLAUDE.md`,
  `AGENT_RULES.md`.
- **Zwei ernste offene Punkte benannt:** der aus dem Browser stammende
  Zahlbetrag (`todo.md` T-1) und die ungeklärte Deploy-Lage der
  Stripe-Functions (`deploy.md`).
- **Prüfnetz gebaut** (`tools/pruefe.py`, `docs/pruefen.md`) — auf Andys
  Auflage, dass `booking.html` nur angefasst wird, wenn danach sicher ist, dass
  die Website läuft. An drei künstlich eingebauten Fehlern nachgewiesen.
  Laufzeitprobe: `index.html` und `booking.html` laden mit **leerer Konsole**,
  Schritt 1 der Buchung rendert vollständig.
- **Remote geklärt:** Sun ist Eigentümer, Andy ist Manager — das Repo ist
  richtig so.

**2026-07-27 (später am Tag)** — Andys Auftrag: neuer Dienst **Drohnenflug**.
- Gebaut in Startseite (vierte Karte mit DJI-Neo-Bild und eigenem SVG-Symbol),
  Buchungsstrecke (drei Pakete, Schnitt als Zusatz, Ort und Vorhaben) und
  Verwaltung. Als **Anfrage** ohne Zahlung und ohne Termin (R-008).
- In alle fünf Sprachen übersetzt, Abschnittsüberschrift von „drei" auf
  „vier Leistungen" gezogen.
- **Preise fehlen noch** — die Seite zeigt „Price on request", es wurde keine
  Zahl erfunden (`todo.md` T-10).
- **Dabei gefunden und repariert:** Die DJI-Geräteausleihe war **nicht
  buchbar** — der Kalender wurde nie aufgebaut. Ebenso zeigte die Bestätigung
  für Podcast-Setup „undefined" als Service.

**2026-07-21** — letzte Arbeit vor der Übernahme: `.gitignore` ergänzt,
`.DS_Store` entfernt, Studio-Foto aufgenommen.

**Juni bis Anfang Juli** — Aufbau der Zahlungsstrecke: Stripe-Checkout,
PromptPay über PaymentIntent, Preisstruktur für Podcast-Setup und
Reel-Bearbeitung, Schutz gegen Doppelbuchung
(`cancel_competing_pending_bookings`).

## Was als Nächstes ansteht

Die beiden dringenden Punkte aus `todo.md` brauchen **Andys Zugänge**, nicht
mehr Arbeit am Code:

1. **T-2** — bei Supabase nachsehen, welche Fassung der Stripe-Functions läuft
   (`deploy.md` enthält den Prüfweg).
2. **T-1** — den Betrag serverseitig aus der Datenbank holen statt aus dem
   Request-Body. Das ist eine überschaubare Änderung an zwei Functions, aber
   sie muss deployed werden — und Deploy ist gesperrt (R-005).

Danach erst die technische Schuld: Tests für die Functions (T-7), dann
`booking.html` entflechten (T-6).

## Was hier bewusst **nicht** passiert

- Kein Deploy, kein Push, keine SQL-Ausführung (R-005).
- Keine Änderung an `~/rentme/` (R-006).
- `booking.html` wird nicht umgebaut, solange es keine Möglichkeit gibt, die
  Buchungsstrecke zu prüfen.
