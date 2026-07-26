# RentMe Bangkok — Buchungs-Website

Website und Buchungsstrecke für **Rent Me Bangkok** — Fotostudio,
Podcast-Produktion und DJI-Verleih im Bereich Asoke/Makkasan.

**Vier Dienste:** Fotostudio, Podcast-Setup, DJI-Geräteausleihe und
Drohnenflug. Die ersten drei werden gebucht und bezahlt; der Drohnenflug ist
eine **Anfrage** ohne Zahlung (`docs/decisions.md` R-008).

Statisches Frontend, Supabase als Datenbank und Auth, Stripe für Zahlungen.
**Kein Build-Schritt, kein Framework** — die Seiten sind einzelne HTML-Dateien
mit eingebettetem CSS und JavaScript.

## Einstieg

1. `AGENT_RULES.md` — verbindliche Regeln, haben Vorrang
2. `CLAUDE.md` — dauerhaftes Projektwissen
3. `docs/context.md` — aktueller Stand
4. `docs/deploy.md` — **wo was läuft, und was daran ungeklärt ist**
5. `docs/todo.md` — offene Punkte
6. `docs/decisions.md` — warum etwas so ist

## Lokal starten

```bash
cd ~/Desktop/rentme-bangkok
python3 serve.py          # SimpleHTTPServer auf Port 3456
open http://localhost:3456
```

`serve.py` ist fünf Zeilen und dient nur dem lokalen Ansehen. Die Seiten sprechen
auch lokal mit dem **echten** Supabase-Projekt und den **echten** Stripe-Live-
Schlüsseln — siehe die Warnung in `AGENT_RULES.md`.

## Seiten

| Datei | Zweck | Zeilen |
|---|---|---|
| `index.html` | Startseite, Angebote, Preise | 1.410 |
| `booking.html` | Buchungsstrecke inkl. Zahlung | 2.254 |
| `admin.html` | Verwaltung der Buchungen | 1.084 |
| `profile.html` | Kundenprofil | 422 |
| `auth.html` | Anmeldung / Registrierung | 360 |
| `instagram/posts.html` | Instagram-Ansicht | — |

## Prüfen vor jeder Änderung

```bash
python3 tools/pruefe.py     # statisch, Exit 0 = weiter
python3 serve.py            # dann lokal ansehen, Konsole muss leer sein
```

Pflicht, nicht Empfehlung — das Verfahren steht in `docs/pruefen.md`,
begründet in `docs/decisions.md` R-007.

## Backend

- **Supabase** — Projekt `nghsyxwhczvwaorssgoh`. Schema in
  `supabase-setup.sql`, Rechte in `supabase-security.sql`,
  Zahlungserweiterung in `stripe-migration.sql`.
- **Stripe** — drei Edge-Functions unter `supabase/functions/`:
  `stripe-checkout` (Karte), `stripe-paymentlink` (PromptPay-QR),
  `stripe-webhook` (Zahlungsbestätigung).
- **EmailJS** — Buchungsbestätigung per Mail, Konfiguration in `booking.html`.

Geheimnisse liegen **nicht** im Repo. Die Functions lesen sie aus der
Supabase-Umgebung (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`SUPABASE_SERVICE_ROLE_KEY`).

## Abgrenzung

Dieses Projekt ist **nur** die Website und die Buchung. Social-Media-Marketing
für dasselbe Studio ist ein eigenes Projekt (`~/Desktop/rentme-social`) — gleiches
Geschäft, getrennter Code, kein Zugriff in beide Richtungen
(`~/projects-brain/BRAIN.md`).
