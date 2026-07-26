# Deploy — wo was läuft

**Erstellt:** 2026-07-27 · Alles hier ist am selben Tag aus dem Ordner erhoben.
Was **nicht** feststellbar war, steht ausdrücklich als solches darin.

---

## Die kurze Antwort

| Teil | Wo | Stand im Repo | Deployed? |
|---|---|---|---|
| Frontend (HTML) | **www.rentme-bkk.com**, Vercel | 27. Juli | **= `origin/main`**, automatisch |
| Supabase-Projekt | `nghsyxwhczvwaorssgoh` | — | läuft |
| Stripe-Functions | Supabase Edge Functions | 1. Juli | **unbekannt — und das ist das Risiko** |
| Datenbankschema | Supabase | `*.sql`, Juni | vermutlich angewandt |

---

## ⚠️ Die eine Regel, die alles andere überlagert

> ## `git push` **ist** der Deploy.

Vercel hängt an `github.com/sunjehad/Renmte-BKK` und spielt **jeden Push auf
`main` automatisch aus**. Es gibt keinen zweiten, bewussten Schritt dazwischen —
kein Freigabeknopf, keine Vorschau, die erst bestätigt werden müsste.

**Damit ist „nicht pushen ohne Freigabe" keine Formalie, sondern die
Deploy-Sperre selbst** (`decisions.md` R-005).

Was auf `origin/main` liegt, ist live. Was lokal liegt, ist es nicht.

---

## Frontend — geklärt am 2026-07-27

**Adresse:** `rentme-bkk.com` leitet per **308** auf **`www.rentme-bkk.com`**
um. Nachgeprüft mit `curl`.

**Hoster: Vercel.** Nachgeprüft an den Antwortköpfen: `server: Vercel`,
`x-vercel-id: fra1::…`, `x-vercel-cache: HIT`.

**Weg:** Vercels Git-Anbindung am Repo `github.com/sunjehad/Renmte-BKK`. Ein
Push auf `main` löst den Deploy aus, ohne weiteres Zutun.

**Warum im Repo nichts davon steht:** Bei Vercel liegt die Konfiguration im
Dashboard-Projekt, nicht im Repo. Das Fehlen von `vercel.json` ist daher
normal und kein Hinweis auf einen anderen Weg.

**Warum die Seite ihre Adresse nicht nennt:** `booking.html` baut die
Rücksprungadressen für Stripe aus `location.origin`. Das ist richtig so — die
Seite funktioniert dadurch unter jeder Domain und auch lokal.

**Noch offen:** Wo die Domain registriert ist und wem das Vercel-Konto gehört.
Das DNS zeigt faktisch auf Vercel, sonst kämen die Kopfzeilen nicht.

### Was jetzt live ist

`origin/main` steht auf **`cf51d6c`** — das ist der öffentliche Stand.
Gegenprobe am 2026-07-27: `booking.html` auf `www.rentme-bkk.com` enthält
**keinen** Drohnen-Dienst (`selectService('drone'` → 0 Treffer). Der neue
Dienst ist also **nicht** live.

**Drei Commits liegen lokal und nicht auf `origin`:**

```
7fea6bc feat: Drohnenflug als Dienst + zwei Fehlerbehebungen   ← ungepusht
f462aa8 docs: Projektdoku, Pruefwerkzeug und Aufraeumen        ← ungepusht
57ebc3c chore: .gitignore ergaenzen, Studio-Foto aufnehmen     ← ungepusht (seit 21.07.)
cf51d6c  = origin/main = LIVE
```

Die Historie ist **linear**, kein Konflikt. Ein einziger `git push` würde alles
auf einmal live schalten — **nur darf Andys Konto nicht pushen.**

> 🔴 **Der Push scheitert mit 403.** `monkeydrufyyy99` hat auf
> `sunjehad/Renmte-BKK` nur Leserechte (`push: false`, per GitHub-API
> bestätigt). Solange das so ist, ist der Deploy blockiert — unabhängig von
> allem anderen in diesem Dokument. Wege aus der Sache: `todo.md` T-4.

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

## Die richtige Reihenfolge

1. **Erst Supabase prüfen** (unten), ob die aktuelle `stripe-webhook`-Fassung
   deployed ist.
2. **Dann `git push`** — das ist der Frontend-Deploy.

Andersherum ginge ein Frontend live, dessen PromptPay-Weg auf einen Webhook
trifft, der ihn nicht kennt.

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
