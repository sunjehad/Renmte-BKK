# Deploy — wo was läuft

**Erstellt:** 2026-07-27 · Alles hier ist am selben Tag aus dem Ordner erhoben.
Was **nicht** feststellbar war, steht ausdrücklich als solches darin.

---

## Die kurze Antwort

| Teil | Wo | Stand im Repo | Deployed? |
|---|---|---|---|
| Frontend (HTML) | öffentliche Live-Adresse | 6. Juli | **unbekannt** |
| Supabase-Projekt | `nghsyxwhczvwaorssgoh` | — | läuft |
| Stripe-Functions | Supabase Edge Functions | 1. Juli | **unbekannt — und das ist das Risiko** |
| Datenbankschema | Supabase | `*.sql`, Juni | vermutlich angewandt |

---

## Die Live-Adresse steht nicht im Ordner

Gesucht wurde nach Domains, `CNAME`, Vercel-/Netlify-/Firebase-Konfiguration und
fest verdrahteten URLs. Ergebnis:

- **Das Frontend verrät seine eigene Adresse nicht.** `booking.html` baut die
  Rücksprungadressen für Stripe aus `location.origin` — die Seite funktioniert
  unter jeder Domain und nennt keine.
- Es gibt **keine** Deploy-Konfiguration im Repo. Kein `vercel.json`, kein
  `netlify.toml`, kein `CNAME`, kein GitHub-Actions-Workflow.
- Zwei Domainnamen kommen überhaupt vor, beide **ohne** Beweiskraft:
  - `rentmebangkok.com` — nur als Bestandteil einer Kalender-Kennung
    (`booking.html`: `booking_ref + '@rentmebangkok.com'`)
  - `rentme-bkk.com` — in der **alten**, nicht mehr maßgeblichen Fassung von
    `stripe-paymentlink` als Rücksprungadresse (Stand 28. Juni, siehe unten)

**`rentme-bkk.com` ist der einzige Hinweis darauf, unter welcher Domain die
Seite einmal lief.** Bestätigt ist er nicht.

Wie das Frontend auf den Server kommt — von Hand, per FTP, über einen Hoster mit
Git-Anbindung — ist aus dem Ordner **nicht** erkennbar. Das ist der Grund,
warum unklar bleibt, ob die öffentliche Fassung dem Stand vom 6. Juli
entspricht.

---

## Die Stripe-Functions gibt es dreifach

| Ort | Stand | Bewertung |
|---|---|---|
| `~/Desktop/rentme-bangkok/supabase/functions/` | **1. Juli** | **maßgeblich, im Git** |
| `~/rentme/supabase/functions/` | 28. Juni | älter, außerhalb Git |
| `~/rentme/<name>/index.ts` (flach) | 28. Juni | älter, außerhalb Git |

Nachgeprüft am 2026-07-27 mit `diff`:

- **`stripe-checkout`** — Repo und `~/rentme/supabase/functions/` sind
  **identisch**; die flache Kopie weicht ab.
- **`stripe-paymentlink`** — alle drei verschieden.
- **`stripe-webhook`** — alle drei verschieden.

### Der Unterschied ist keine Kosmetik

Zwischen dem 28. Juni und dem 1. Juli hat sich das **Zahlungsverfahren für
PromptPay geändert**:

| | alt (28. Juni) | neu (1. Juli, maßgeblich) |
|---|---|---|
| `stripe-paymentlink` | erzeugt einen Stripe **PaymentLink** und lässt einen fremden Dienst (`api.qrserver.com`) den QR-Code zeichnen | erzeugt einen **PaymentIntent** mit `payment_method_types: ['promptpay']` — der QR kommt von Stripe selbst |
| `stripe-webhook` | kennt **nur** `checkout.session.completed` | kennt zusätzlich **`payment_intent.succeeded`** |

---

## Das offene Risiko, in einem Satz

> **Läuft bei Supabase noch die Fassung vom 28. Juni, während das Frontend vom
> 6. Juli davor sitzt, dann bezahlt ein Kunde per PromptPay-QR — und die Buchung
> bleibt auf `pending` stehen.**

Denn: Das neue Frontend ruft `stripe-paymentlink` in der Erwartung eines
PaymentIntent auf. Selbst wenn das gutgeht, fehlt der alten `stripe-webhook`
der Zweig `payment_intent.succeeded`. Das Geld ist eingegangen, die Buchung ist
nicht bestätigt, `cancel_competing_pending_bookings` läuft nicht — der Zeitraum
bleibt für andere buchbar.

**Das ist der einzige Punkt in diesem Projekt, an dem Unklarheit unmittelbar
Geld und Kundenvertrauen kostet.**

---

## Wie Andy es prüft

Von einer Sitzung aus, die bei Supabase angemeldet ist:

```bash
# 1. Welche Functions gibt es, und wann wurden sie zuletzt deployed?
supabase functions list --project-ref nghsyxwhczvwaorssgoh

# 2. Die deployte Fassung herunterladen und gegen das Repo vergleichen
supabase functions download stripe-webhook --project-ref nghsyxwhczvwaorssgoh
diff supabase/functions/stripe-webhook/index.ts <heruntergeladene Fassung>
```

Ohne CLI reicht auch das Supabase-Dashboard → *Edge Functions* → jeweils
*Deployments*: **Steht dort ein Datum vom 1. Juli oder später, ist alles gut.
Steht dort der 28. Juni oder früher, muss neu deployed werden.**

Ein zweiter, unabhängiger Weg über das **Stripe-Dashboard**: unter
*Developers → Webhooks* nachsehen, ob `payment_intent.succeeded` als
abonniertes Ereignis eingetragen ist. Fehlt es dort, wird der neue Zweig nie
ausgelöst — selbst wenn die Function aktuell ist.

**Erst danach** lässt sich sagen, ob deployed werden muss. Ein Deploy ohne
diese Prüfung wäre geraten.

---

## Was danach in dieses Dokument gehört

- Die tatsächliche Live-Adresse und der Weg, wie das Frontend dorthin kommt.
- Das Deploy-Datum der drei Functions.
- Die Antwort auf die Frage, ob `~/rentme/` gelöscht werden kann — sie ist
  heute nur deshalb aufzuheben, weil unklar ist, ob dort etwas Deploytes liegt.
