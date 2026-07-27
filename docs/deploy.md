# Deploy — wo was läuft

**Erstellt:** 2026-07-27 · Alles hier ist am selben Tag aus dem Ordner erhoben.
Was **nicht** feststellbar war, steht ausdrücklich als solches darin.

---

## Die kurze Antwort

| Teil | Wo | Stand im Repo | Deployed? |
|---|---|---|---|
| Frontend (HTML) | **www.rentme-bkk.com**, Vercel | 27. Juli | **= `origin/main`**, automatisch |
| Supabase-Projekt | `nghsyxwhczvwaorssgoh` | — | läuft |
| Stripe-Functions | Supabase Edge Functions | 27. Juli | **nein — der T-1-Fix liegt nur lokal** |
| Datenbankschema | Supabase | `*.sql`, Juni | vermutlich angewandt |

> ## ⚠️ Die zwei Deploys sind getrennt
>
> `git push` spielt **nur das Frontend** aus. Die Edge-Functions hängen nicht
> an Vercel und nicht an Git — sie gehen ausschließlich über
> `supabase functions deploy` live.
>
> **Folge, Stand 2026-07-27:** Der Fix der Preislücke (T-1, R-010) ist
> committet und gepusht, aber **nicht wirksam**. Bei Supabase läuft weiter die
> Fassung vom 1. Juli, die den Betrag aus dem Browser übernimmt. Die Lücke ist
> offen, bis jemand mit Supabase-Zugang deployed.

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

**Stand 2026-07-27, nach dem Push:** `origin/main` steht auf **`0e76917`**,
lokal und entfernt gleichauf. Der Drohnen-Dienst und die Reparatur der
DJI-Ausleihe sind live — an `www.rentme-bkk.com` gegengeprüft.

> ✅ **Die frühere 403-Sperre ist erledigt.** `monkeydrufyyy99` hatte auf
> `sunjehad/Renmte-BKK` nur Leserechte; Sun hat eine Collaborator-Einladung
> mit `write` geschickt, sie wurde angenommen, danach ging der Push durch
> (`cf51d6c..0e76917`, fünf Commits). Einzelheiten: `todo.md` T-4.

Für das Frontend gilt damit weiterhin: **was auf `origin/main` liegt, ist
live.** Für die Edge-Functions gilt das ausdrücklich **nicht** — siehe den
Kasten ganz oben.

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

### Welche Fassung läuft? — erhoben am 2026-07-27 aus den CLI-Spuren

Die Supabase-CLI schreibt Ablaufspuren nach `~/.supabase/traces/*.ndjson`.
Sie hat niemand angelegt, um sie zu lesen — aber sie beantwortet die Frage
fast vollständig, **ohne einen einzigen Zugriff auf Supabase.**

Verzeichnete `functions deploy`-Läufe, alle Zeiten **UTC**:

| Tag | erfolgreich | bemerkenswert |
|---|---|---|
| 2026-06-27 | 8 | erste Ausspielung |
| 2026-06-28 | 1 | **15:21:24** |
| 2026-06-30 | 0 | nur `functions list`, `secrets list` |
| 2026-07-01 | 8 (+1 gescheitert) | letzter Lauf **08:27:57** |
| danach | — | **keine Spurdatei mehr — die CLI lief seither nicht** |

Die Zeiten passen auf die Sekunde zu den Dateiständen:

```
2026-06-28T15:21:23Z  ~/rentme/…/stripe-webhook/index.ts   (Datei geschrieben)
2026-06-28T15:21:24Z  functions deploy  ok                  ← eine Sekunde später
2026-07-01T08:10:20Z  <Repo>/…/stripe-webhook/index.ts     (Datei geschrieben)
2026-07-01T08:10:26Z  functions deploy  ok                  ← sechs Sekunden später
2026-07-01T08:27:__Z  supabase link  →  .temp im REPO angelegt
2026-07-01T08:27:57Z  functions deploy  ok                  ← der letzte Lauf ueberhaupt
```

Das `.temp/linked-project.json`, das der `link`-Lauf um 08:27 UTC (15:27
Bangkok) **im Repo** angelegt hat, zeigt auf `nghsyxwhczvwaorssgoh` —
dasselbe Projekt. Der letzte Deploy erfolgte also aus **diesem** Verzeichnis,
nach dem letzten Stand der Dateien.

**Schlussfolgerung:** Es spricht alles dafür, dass bei Supabase die Fassung
vom **1. Juli** läuft — also die neue, mit PaymentIntent und dem Webhook-Zweig
`payment_intent.succeeded`. Die befürchtete Lage (alte Fassung vom 28. Juni
live, PromptPay-Zahlungen bleiben auf `pending`) wird von den Spuren
**nicht** gestützt: Die alte Fassung war live, ist aber am 1. Juli überschrieben
worden.

**Was daran unbewiesen bleibt — ausdrücklich:**

- Die Spuren nennen **weder den Function-Namen noch das Projekt**. Dass alle
  drei Functions erfasst waren, ist geschlossen, nicht gemessen (`functions
  deploy` ohne Slug spielt alle aus, und der Befehl steht ohne Argument in der
  Spur).
- Sie sagen nichts über Deploys von **anderen Rechnern** oder aus dem
  Dashboard.
- Ob im Stripe-Dashboard `payment_intent.succeeded` als Ereignis abonniert
  ist, steht auf einem anderen Blatt — fehlt es dort, nützt der neue
  Webhook-Zweig nichts.

**Damit bleibt T-2 formal offen**, aber das Risiko ist von „ungeklärt" auf
„sehr wahrscheinlich in Ordnung" gefallen. Der Beweis kostet einen Befehl,
sobald jemand angemeldet ist — siehe unten.

**Und `~/rentme/` bleibt liegen** (T-5): Die dortige Webhook-Fassung *war*
nachweislich einmal ausgespielt. Gelöscht wird nichts, solange der Beweis
aussteht.

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

## Was als Nächstes ansteht

**Der Frontend-Push ist durch. Offen ist der Functions-Deploy — und der ist
jetzt der dringende Teil**, weil der T-1-Fix (R-010) sonst wirkungslos
bleibt und der Betrag weiter aus dem Browser kommt.

1. **Prüfen**, was heute läuft (Befehle unten) — bestätigt oder widerlegt den
   Trace-Befund oben.
2. **Ausspielen:** `supabase functions deploy` für alle drei Functions.
3. **Gegenprobe:** eine Buchung anlegen und den Betrag im Request auf `1`
   setzen. Erwartet wird **HTTP 422** mit `code` aus `preise.ts`, **kein**
   Stripe-Vorgang.

## Wie Andy es prüft

Von einer Sitzung aus, die bei Supabase angemeldet ist (`supabase login` —
auf diesem Rechner liegt **kein** Zugangs-Token, `~/.supabase/access-token`
existiert nicht):

```bash
# 1. Welche Functions gibt es, und wann wurden sie zuletzt deployed?
supabase functions list --project-ref nghsyxwhczvwaorssgoh

# 2. Die deployte Fassung herunterladen und gegen das Repo vergleichen
supabase functions download stripe-webhook --project-ref nghsyxwhczvwaorssgoh
diff supabase/functions/stripe-webhook/index.ts <heruntergeladene Fassung>
```

**Steht bei `functions list` ein Datum vom 1. Juli, ist der Trace-Befund
bestätigt und T-2 erledigt.**

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
