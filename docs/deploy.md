# Deploy — wo was läuft

**Erstellt:** 2026-07-27 · Alles hier ist am selben Tag aus dem Ordner erhoben.
Was **nicht** feststellbar war, steht ausdrücklich als solches darin.

---

## Die kurze Antwort

| Teil | Wo | Stand im Repo | Deployed? |
|---|---|---|---|
| Frontend (HTML) | **www.rentme-bkk.com**, Vercel | `d5dca2e` | **= `origin/main`**, automatisch |
| Supabase-Projekt | `nghsyxwhczvwaorssgoh` | — | läuft |
| Stripe-Functions | Supabase Edge Functions | 27. Juli | **ja — seit 2026-07-27 05:59:40 UTC** |
| Datenbankschema | Supabase | `*.sql`, Juni | vermutlich angewandt |

> ## ⚠️ Die zwei Deploys sind getrennt
>
> `git push` spielt **nur das Frontend** aus. Die Edge-Functions hängen nicht
> an Vercel und nicht an Git — sie gehen ausschließlich über
> `supabase functions deploy` live.
>
> Wer nur pusht, hat an den Zahlungswegen **nichts** geändert. Das ist keine
> Feinheit: Genau dieser Irrtum hätte den T-1-Fix wirkungslos im Repo liegen
> lassen.

**Stand 2026-07-27:** Beides ist ausgespielt. Der Fix der Preislücke (T-1,
R-010) ist seit **05:59:40 UTC** live — Einzelheiten unter „Functions
ausspielen". Der **Vorfall** dazu (die Lücke wurde ausgenutzt) hat eine eigene
Akte: **`docs/vorfall-2026-07-27-preisluecke.md`**.

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

**Stand 2026-07-27, nach dem zweiten Push:** `origin/main` steht auf
**`d5dca2e`**, lokal und entfernt gleichauf. Drohnen-Dienst und die Reparatur
der DJI-Ausleihe sind live (gegengeprüft an `www.rentme-bkk.com`); `d5dca2e`
selbst ändert am Frontend nichts — er betrifft die Functions, die Prüfwerkzeuge
und die Doku.

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

### ✅ Welche Fassung lief? — **bewiesen am 2026-07-27**

`supabase functions list --project-ref nghsyxwhczvwaorssgoh`, abgefragt
**vor** dem Deploy (denn der Deploy überschreibt genau diese Auskunft):

| Function | Status | Version | zuletzt ausgespielt |
|---|---|---|---|
| `stripe-checkout` | ACTIVE | **v6** | 2026-07-01 |
| `stripe-paymentlink` | ACTIVE | **v9** | 2026-07-01, **08:28:00 UTC** |
| `stripe-webhook` | ACTIVE | **v10** | 2026-07-01 |

**Damit ist T-2 beantwortet:** Es lief die Fassung vom **1. Juli** — die neue,
mit PaymentIntent und dem Webhook-Zweig `payment_intent.succeeded`. Die
befürchtete Lage (alte Fassung live → per PromptPay bezahlte Buchungen bleiben
auf `pending`) hat es **nie gegeben**.

**Zwei Folgerungen:**

1. **`~/rentme/` ist nachweislich nicht die Quelle des Deployten** (T-5,
   EA-R-10). Der einzige Grund, den Ordner aufzuheben, ist damit entfallen.
2. Die Auswertung der CLI-Spuren unten war **richtig** — `stripe-paymentlink`
   wurde um 08:28:00 UTC ausgespielt, **drei Sekunden** nach dem letzten
   Deploy-Eintrag in der Spur (08:27:57). Der Abschnitt bleibt hier stehen,
   weil er zeigt, wie weit man ohne Zugang kommt.

---

### Wie es ohne Zugang erschlossen wurde — die CLI-Spuren

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

**Was die Spuren allein nicht sagen konnten:** Sie nennen weder Function-Namen
noch Projekt, und sie erfassen keine Deploys von anderen Rechnern oder aus dem
Dashboard. Deshalb war das Ergebnis „sehr wahrscheinlich", nicht „bewiesen" —
den Beweis lieferte erst `functions list` (oben).

---

## Functions ausspielen — der Weg, der funktioniert

**Ausgespielt am 2026-07-27 um 05:59:40 UTC:**

```bash
supabase functions deploy stripe-checkout stripe-paymentlink --use-api
```

| Function | vorher | nachher |
|---|---|---|
| `stripe-checkout` | v6 | **v7** |
| `stripe-paymentlink` | v9 | **v10** |
| `stripe-webhook` | v10 | v10 (unverändert — nicht geändert, nicht ausgespielt) |

> ### `--use-api` benutzen, nicht den Docker-Weg
>
> Ohne das Flag baut die CLI in einem lokalen Container und lädt dafür
> `edge-runtime:v1.73.13` herunter. Das hing am 2026-07-27 **über zehn
> Minuten** am Image-Download. Mit `--use-api` baut Supabase serverseitig —
> in Sekunden durch.
>
> Für dieses Projekt ist das unstrittig: Es gibt keine lokale
> Entwicklungsumgebung, die der Container abbilden müsste.

**Nur die geänderten Functions nennen.** `supabase functions deploy` ohne Slug
spielt alle aus — auch die, an denen niemand gearbeitet hat. Bei Zahlungswegen
ist das unnötiges Risiko.

### Gegenprobe nach dem Deploy

Eine Buchung anlegen und im Request an `stripe-checkout` den Betrag auf `1`
setzen. Erwartet wird **HTTP 422** mit einem `code` aus `preise.ts` und
**kein** Stripe-Vorgang. Steht dort eine Stripe-URL, ist etwas schiefgegangen.

---

## Anmelden — der Token liegt im Schlüsselbund

> ⚠️ **Nicht auf `~/.supabase/access-token` prüfen.** Die CLI 2.108 legt den
> Zugangs-Token im **macOS-Schlüsselbund** ab, nicht als Datei. Am 2026-07-27
> hat genau diese Fehlannahme zu dem falschen Schluss geführt, es liege gar
> kein Login vor — tatsächlich lief `supabase projects list` anstandslos.
>
> **Richtige Probe:** `supabase projects list`. Antwortet der Befehl, ist die
> Anmeldung da. Sonst `supabase login`.

```bash
# 1. Welche Functions gibt es, und wann wurden sie zuletzt deployed?
supabase functions list --project-ref nghsyxwhczvwaorssgoh

# 2. Die deployte Fassung herunterladen und gegen das Repo vergleichen
supabase functions download stripe-webhook --project-ref nghsyxwhczvwaorssgoh
diff supabase/functions/stripe-webhook/index.ts <heruntergeladene Fassung>
```

Ohne CLI reicht auch das Supabase-Dashboard → *Edge Functions* → jeweils
*Deployments*.

> **Merksatz für das nächste Mal:** `functions list` **vor** dem Deploy
> abfragen. Der Deploy überschreibt Version und Datum — also genau die
> Auskunft, die man hinterher gern hätte. Am 2026-07-27 ist das gutgegangen,
> weil vorher gefragt wurde.

Ein zweiter, unabhängiger Weg über das **Stripe-Dashboard**: unter
*Developers → Webhooks* nachsehen, ob `payment_intent.succeeded` als
abonniertes Ereignis eingetragen ist. Fehlt es dort, wird der neue Zweig nie
ausgelöst — selbst wenn die Function aktuell ist. **Das ist noch offen.**

---

## Was hier noch fehlt

- Ob Stripe `payment_intent.succeeded` überhaupt abonniert hat.
- Wo die Domain registriert ist und wem das Vercel-Konto gehört.
- Der Datenbank-Zugang, mit dem sich der Vorfall auswerten lässt —
  `docs/vorfall-2026-07-27-preisluecke.md`.
