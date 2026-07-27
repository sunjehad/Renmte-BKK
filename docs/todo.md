# ToDo — RentMe Bangkok

Stand **2026-07-27**. Reihenfolge ist Dringlichkeit, nicht Aufwand.

---

## Dringend — wartet auf Andy

### [ ] T-10 — Preise für den Drohnen-Dienst fehlen

Der Dienst ist gebaut und läuft, zeigt aber **„Price on request"**, weil keine
Zahlen vorliegen. Das ist bewusst so: erfundene Preise auf einer Live-Seite
sind schlimmer als keine.

**Gebraucht werden vier Zahlen:**

| | Umfang | Preis |
|---|---|---|
| BASIC | bis 1 Std. vor Ort, Rohmaterial | ฿____ |
| STANDARD | bis 3 Std. vor Ort, Rohmaterial | ฿____ |
| PREMIUM | halber Tag, Rohmaterial | ฿____ |
| Schnitt (Zusatz) | fertiger Film statt Rohmaterial | ฿____ |

Eintragen in `booking.html`, Konstante `DRONE_PACKAGES` bzw.
`DRONE_EDITING_PRICE` — **nur dort**, eine Zeile je Paket. Der Umfangstext
(„bis 1 Stunde vor Ort") ist ebenfalls geraten und gehört bestätigt.

## Dringend — betrifft Geld

### [x] T-1 — Der Zahlbetrag kam aus dem Browser — **behoben und live**

**Ausgespielt am 2026-07-27 um 05:59:40 UTC** (`stripe-checkout` v6→v7,
`stripe-paymentlink` v9→v10). Der Fix liegt in
`supabase/functions/_shared/preise.ts` (R-010).

> 🔴 **Die Lücke wurde ausgenutzt.** Andy hat das am 2026-07-27 bestätigt.
> Wie viel, wie oft und wer betroffen ist, ist **offen** — die Auswertung hat
> eine eigene Akte: **`docs/vorfall-2026-07-27-preisluecke.md`**. Sie enthält
> vier fertige SQL-Abfragen und sagt, was dafür gebraucht wird.

**Der ursprünglich hier vorgeschlagene Fix wäre wirkungslos gewesen.** Er
lautete: `select total_price from bookings where id = bookingId`. Aber
`total_price` ist **genauso vom Browser gesetzt** — der Buchungssatz entsteht
über die RPC `create_booking` (`stripe-migration.sql` Z. 79 ff.), die
`SECURITY DEFINER` läuft, für `anon` freigegeben ist und
`payload->>'total_price'` wortwörtlich übernimmt. Der Angreifer hätte
denselben Betrag einen Schritt früher gefälscht.

**Stattdessen umgesetzt:** Der Betrag wird aus dem **reservierten Umfang** neu
berechnet (Dienst, Unterart, Dauer, Miettage, Geräte) — also aus den Feldern,
die auch bestimmen, was der Kunde bekommt und was der Kalender sperrt.
Fail-closed: kein Preis sicher ermittelbar → HTTP 422, **kein** Rückfall auf
den Browser-Wert. `amount` und `currency` aus dem Body werden nicht mehr
benutzt.

**Gleich mitbehoben:** `currency` kam ebenfalls aus dem Body — 800 THB hätten
als 800 IDR (~1,70 THB) eingezogen werden können.

**Geprüft:** 21 Tests in `preise.test.ts`, dazu eine statische Wache in
`tools/pruefe.py`, die anschlägt, sobald ein Betrag oder eine Währung an
Stripe nicht aus der Preisquelle stammt. Beides an künstlich eingebauten
Fehlern nachgewiesen.

### [x] T-2 — Deploy-Wahrheit der Functions — **bewiesen am 2026-07-27**

`supabase functions list`, abgefragt **vor** dem Deploy: alle drei `ACTIVE`,
`stripe-checkout` v6, `stripe-paymentlink` v9, `stripe-webhook` v10, zuletzt
ausgespielt am **1. Juli** — `stripe-paymentlink` um 08:28:00 UTC, drei
Sekunden nach dem letzten Deploy-Eintrag in den CLI-Spuren.

**Es lief die Fassung vom 1. Juli.** Die befürchtete Lage (per PromptPay
bezahlte Buchungen bleiben auf `pending`) hat es **nie gegeben**.

**Offen bleibt nur noch:** ob Stripe `payment_intent.succeeded` abonniert hat.
Fehlt das Abonnement, wird der Webhook-Zweig nie ausgelöst — unabhängig davon,
wie aktuell die Function ist.

### [ ] T-11 — Vorfall: die Preislücke **wurde** ausgenutzt

**Andy hat es am 2026-07-27 bestätigt.** Einzelheiten liegen nicht vor.

Eigene Akte mit belegtem Zeitfenster (2026-06-27 bis 2026-07-27 05:59:40 UTC),
den drei Angriffswegen und vier fertigen SQL-Abfragen:
**`docs/vorfall-2026-07-27-preisluecke.md`**.

**Der Punkt, an dem die Auswertung sonst schiefgeht:** Der wahrscheinlichste
Angriffsweg — `amount` erst im Aufruf an die Function verbiegen — ist in der
**Datenbank unsichtbar**. Der Buchungssatz sieht in jeder Spalte richtig aus;
was tatsächlich eingezogen wurde, steht nur bei Stripe. **Ohne den
Stripe-Export findet man nichts und hält den Vorfall für erledigt.**

**Dringend zuerst:** Abfrage 3 der Akte — unterbezahlte Buchungen mit Status
`paid` sperren **bis heute** Termine für echte Gäste. Das ist laufender
Schaden, unabhängig vom entgangenen Geld.

---

## Offen — braucht eine Antwort von Andy

### [x] T-3 — Wie kommt das Frontend auf den Server? — **beantwortet**

**2026-07-27:** **`www.rentme-bkk.com` auf Vercel**, angebunden an
`github.com/sunjehad/Renmte-BKK`. **Ein Push auf `main` spielt automatisch
aus** — `git push` *ist* der Deploy. Dass keine `vercel.json` im Repo liegt,
ist bei Vercel normal; die Konfiguration steht im Dashboard.

Nachgeprüft: `rentme-bkk.com` → 308 → `www.rentme-bkk.com`, Antwortköpfe
`server: Vercel`. **Live steht seit dem Push vom 2026-07-27 `0e76917`** —
Drohnen-Dienst und die Reparatur der DJI-Ausleihe sind enthalten und wurden an
der laufenden Seite gegengeprüft. Einzelheiten in `docs/deploy.md`.

⚠️ **Gilt nur fürs Frontend.** Die Edge-Functions hängen **nicht** an Git; sie
gehen nur über `supabase functions deploy` live (siehe T-1).

**Weiter offen:** Domain-Registrar und Eigentümer des Vercel-Kontos.

### [x] T-4 — GitHub-Schreibrechte — **erledigt am 2026-07-27**

Der erste Push scheiterte mit **403**: `monkeydrufyyy99` hatte auf
`sunjehad/Renmte-BKK` nur Leserechte (`push: false`, per GitHub-API belegt).

**Gelöst auf dem empfohlenen Weg:** Sun hat eine Collaborator-Einladung mit
`write` geschickt; sie war noch offen, wurde angenommen, danach ging der Push
durch — **`cf51d6c..0e76917`, fünf Commits.** Vercel hat automatisch
ausgespielt.

Sun bleibt Eigentümer, Andy Manager. **Gepusht wird weiterhin nur auf Ansage** —
in ein fremdes Repo schiebt man nicht nebenbei (R-005).

### [~] T-5 — Kann `~/rentme/` weg? — **fachlich ja, Freigabe fehlt**

Dort liegen zwei ältere Kopien der Stripe-Functions. Der einzige Grund, sie
aufzuheben, war die Frage, ob eine davon deployed ist. **Mit dem Beweis unter
T-2 ist das geklärt: `~/rentme/` ist nicht die Quelle des Deployten.** Der
Grund ist entfallen.

**Trotzdem wird dort nichts gelöscht ohne Andys ausdrückliche Ansage.** Zu
bedenken: Die dortige Fassung vom 28. Juni ist die einzige Kopie des
**PaymentLink-Verfahrens**, das vor dem 1. Juli lief — und sie hat für die
Vorfallsauswertung noch einen Wert, weil sich an ihr belegen lässt, dass die
Lücke von Anfang an bestand.

---

## Technische Schuld — kein Zeitdruck

### [ ] T-9 — Unerreichbarer Mini-Kalender in `index.html`

`index.html` Zeilen 1307–1345: `showMiniCal` und `hideMiniCal` hängen am
`window`-Objekt, werden aber **nirgends aufgerufen**, und das Element
`mini-cal` existiert im ganzen Dokument nicht. Der Block läuft nie.

**Der Grund, warum das hier steht und nicht unter „Kleinkram":** Der Block
enthält `isBooked()`, das die Belegung aus einer Hash-Formel **erfindet** —
`((y*31+m*7+d*13)%10) < 3`. Würde er je wieder verdrahtet, zeigte die
Startseite frei erfundene ausgebuchte Tage. In der Historie steht schon einmal
ein Commit `Remove fake reviews`; das hier ist dieselbe Sorte.

**Empfehlung: ersatzlos entfernen**, nicht wiederbeleben. Bis dahin in
`tools/bekannt.txt` geführt.

### [ ] T-6 — `booking.html` ist 2.254 Zeilen

HTML, CSS und JavaScript in einer Datei, mit Zustandsverwaltung,
Zahlungspfaden und Supabase-Aufrufen. Weit über der 500-Zeilen-Regel aus
`~/projects-brain/knowledge/rules.md`. `index.html` (1.410) und `admin.html`
(1.084) liegen ebenfalls darüber.

**Nicht anfangen, bevor es eine Möglichkeit gibt, die Buchungsstrecke zu
prüfen** — sonst wird eine funktionierende Zahlungsstrecke ohne Netz umgebaut.

### [ ] T-7 — Keine Testumgebung, keine Function-Tests

**Teilweise angegangen am 2026-07-27:** `tools/pruefe.py` prüft die Seiten
statisch, `docs/pruefen.md` beschreibt das Verfahren. Damit sind die
Fehlerklassen abgedeckt, die eine Seite **still** lahmlegen.

**Weiter angegangen am 2026-07-27:** Die Preishoheit der Edge-Functions ist
jetzt getestet — 21 Tests in `supabase/functions/_shared/preise.test.ts`,
mitgeprüft von `tools/pruefe.py`. Node führt das TypeScript direkt aus, es
gibt weiterhin **keine** Abhängigkeit und keinen Build-Schritt.

**Was weiterhin fehlt und der eigentliche Punkt ist:**
- eine **getrennte Testumgebung** (zweites Supabase-Projekt + Stripe-Testmodus).
  Ohne sie kann die Buchungsstrecke nie ganz durchgeklickt werden, weil jeder
  Versuch eine echte Buchung und eine echte Zahlung erzeugt.
- **Tests der Webhook-Function** gegen erfundene Stripe-Ereignisse. Sie ist die
  einzige der drei, die noch ungetestet ist — und sie entscheidet, ob eine
  Buchung als bezahlt gilt.

### [ ] T-8 — Doppelte Preisführung — **seit 2026-07-27 dreifach**

Preise stehen in `index.html`, in `booking.html` **und** jetzt zusätzlich in
`supabase/functions/_shared/preise.ts`.

Das ist bewusst in Kauf genommen (R-010): Die Alternative wäre gewesen, erst
die Preise zusammenzuführen und die Sicherheitslücke aus T-1 so lange offen zu
lassen. `preise.test.ts` nagelt jede Zahl fest, damit ein Auseinanderlaufen
wenigstens auffällt statt still Geld zu kosten.

**Der Weg heraus:** `preise.ts` ist die einzige Stelle, die serverseitig zählt.
Sinnvoll wäre, die Beträge von dort auszuliefern (eine schlanke Function oder
eine erzeugte JSON-Datei) statt sie im HTML zu wiederholen.

---

## Erledigt

- [x] **2026-07-27** — `customerName` wurde in `booking.html` zweimal im selben
      Objekt gesetzt; die zweite Angabe (`state.name`) überschrieb die erste,
      und `state.name` existiert nirgends. Ergebnis: Stripe bekam einen leeren
      Kundennamen. In beiden Zahlungspfaden behoben.
- [x] **2026-07-27** — `admin.html.backup` und `booking.html.backup` aus dem Git
      genommen (137 KB, Stand 28. Juni), `*.backup` in `.gitignore`.
      Wiederherstellbar: `git show c24b9f0:booking.html.backup`.
- [x] **2026-07-27** — Doku-Grundstock angelegt: `README.md`, `CLAUDE.md`,
      `AGENT_RULES.md`, `docs/`.
- [x] **2026-07-27** — **DJI-Geräteausleihe war nicht buchbar** und ist repariert.
      `initEquipCalendar()` wurde ausschließlich im Zweig `reel` aufgerufen —
      und `state.service` wird nirgends auf `'reel'` gesetzt. Folge: leerer
      Kalender ohne einen einzigen Tag, kein Datum wählbar, Schritt 2 nicht zu
      verlassen. In der laufenden Seite vorher/nachher belegt.
- [x] **2026-07-27** — **Neuer Dienst „Aerial / Drone Filming"** in Startseite,
      Buchungsstrecke und Verwaltung (R-008). Übersetzt in alle fünf Sprachen.
      Preise offen, siehe T-10.
- [x] **2026-07-27** — `svcLabel` war unvollständig: `podcast_setup` und `reel`
      fehlten, die Bestätigung zeigte für sie **„undefined"** als Service. An
      beiden Stellen ergänzt.
- [x] **2026-07-27** — **Prüfnetz gebaut**, bevor an `booking.html` gearbeitet
      wird (Andys Auflage): `tools/pruefe.py` + `tools/bekannt.txt` +
      `docs/pruefen.md`. Nachgewiesen an drei künstlich eingebauten Fehlern.
      Laufzeitprobe: `index.html` und `booking.html` laden mit leerer Konsole.
- [x] **2026-07-27** — **Push durch**, GitHub-Schreibrechte geklärt (T-4);
      `cf51d6c..0e76917` live auf `www.rentme-bkk.com`.
- [x] **2026-07-27** — **Serverseitige Preisquelle** gebaut (T-1, R-010):
      `supabase/functions/_shared/preise.ts`, fail-closed, 21 Tests. Dazu die
      Wache `BETRAG` in `tools/pruefe.py`, die Rückfälle auf den Browser-Wert
      und eine Währung aus dem Body meldet.
- [x] **2026-07-27** — **Functions ausgespielt**, 05:59:40 UTC:
      `stripe-checkout` v6→v7, `stripe-paymentlink` v9→v10. Mit `--use-api`,
      weil der Docker-Weg über zehn Minuten am Image-Download hing.
- [x] **2026-07-27** — **T-2 bewiesen** über `supabase functions list` vor dem
      Deploy. Es lief die Fassung vom 1. Juli — die befürchtete
      `pending`-Lage hat es nie gegeben.
