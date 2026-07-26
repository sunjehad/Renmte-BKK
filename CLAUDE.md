# CLAUDE.md — RentMe Bangkok

> Dauerhaftes Projektwissen. Nur ändern, wenn sich Grundlegendes ändert.
> Aktueller Stand und offene Punkte stehen in `docs/`.
> **`AGENT_RULES.md` hat durchgehend Vorrang.**

## Projektziel

Website und Buchungsstrecke für Rent Me Bangkok: Kundschaft sieht das Angebot,
wählt Datum und Uhrzeit, bucht und bezahlt — ohne dass jemand von Hand
dazwischenmuss. `admin.html` ist die Gegenseite für den Betrieb.

## Technologien

Statisches HTML mit eingebettetem CSS und JavaScript. **Kein Build-Schritt,
kein Framework, kein Paketmanager.** Ergänzt um:

- **Supabase** (`nghsyxwhczvwaorssgoh`) — Postgres, Auth, Row Level Security,
  Edge Functions (Deno/TypeScript)
- **Stripe** — Karte über Checkout, thailändisches PromptPay über PaymentIntent
- **EmailJS** — Buchungsbestätigung per Mail, direkt aus dem Browser
- Externe Bibliotheken über CDN (`jsdelivr`, `esm.sh`), nichts lokal installiert

`serve.py` ist ein Fünfzeiler für die lokale Ansicht auf **Port 3456**.

## Struktur

```
index.html          Startseite, Angebote, Preise
booking.html        Buchungsstrecke — Auswahl, Daten, Zahlung, Bestätigung
admin.html          Verwaltung der Buchungen
profile.html        Kundenprofil
auth.html           Anmeldung / Registrierung
instagram/          Instagram-Ansicht und Exporte
images/             Bildmaterial
supabase/functions/ Stripe-Edge-Functions (maßgebliche Fassung)
*.sql               Schema, Rechte, Zahlungserweiterung
docs/               Kontext, Deploy, Entscheidungen, offene Punkte
```

## Datenmodell

Zwei Tabellen: **`profiles`** (Kundendaten, an `auth.users` gehängt) und
**`bookings`** (die Buchungen). `stripe-migration.sql` erweitert `bookings` um
die Zahlungsfelder und bringt die Funktion
`cancel_competing_pending_bookings(uuid)` mit — sie verhindert, dass derselbe
Zeitraum zweimal verkauft wird, sobald eine Zahlung eingeht.

**Buchungen sind ohne Anmeldung möglich** (`guest_name` statt `user_id`).

## Die vier Angebote

`studio_rental` · `podcast` · `podcast_setup` · `equipment`, dazu
Reel-Bearbeitung als Zusatz. Preise stehen **im Code**, nicht in der Datenbank —
wer sie ändert, ändert `index.html` **und** `booking.html`.

## Zahlungswege

| Weg | Frontend | Function | Bestätigung |
|---|---|---|---|
| Karte | Stripe Checkout, Weiterleitung | `stripe-checkout` | Webhook `checkout.session.completed` |
| PromptPay-QR | QR im Bild, kein Verlassen der Seite | `stripe-paymentlink` | Webhook `payment_intent.succeeded` |
| Bar | keine | keine | `update_booking_payment` direkt |

**Beide Webhook-Zweige müssen in der deployten Fassung vorhanden sein.** Fehlt
der zweite, bleibt eine bezahlte PromptPay-Buchung auf `pending` stehen —
das Geld ist da, die Buchung nicht bestätigt. Siehe `docs/deploy.md`.

## Wichtige Regeln / niemals ändern

- **Keine Geheimnisse ins Repo.** Die Functions lesen alles aus `Deno.env`;
  das bleibt so. Der `pk_live_`-Schlüssel im Frontend ist ein
  **öffentlicher** Stripe-Schlüssel und gehört dorthin — ein `sk_`-Schlüssel
  niemals.
- **Row Level Security bleibt an.** `supabase-security.sql` ist der Grund,
  warum der öffentliche Anon-Schlüssel im Frontend stehen darf.
- **Preis niemals aus dem Frontend übernehmen, ohne ihn serverseitig zu
  prüfen** — der Betrag geht heute aus dem Browser an die Function
  (`docs/todo.md`).
- **Die Stripe-Functions nur unter `supabase/functions/` bearbeiten.**
