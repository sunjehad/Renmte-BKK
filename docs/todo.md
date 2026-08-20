# ToDo — RentMe Bangkok

Stand **2026-07-27**. Reihenfolge ist Dringlichkeit, nicht Aufwand.

---

## Dringend — wartet auf Andy

### [x] T-10 — Drohnen-Preise — **entschieden am 2026-07-28: bleibt „auf Anfrage"**

**Andys Entscheidung:** „drohnen video preise bleiben erstmal nur auf anfrage."

**Es ist nichts zu tun** — der jetzige Zustand ist genau der gewünschte:
- `booking.html` führt Drohne als **Anfrage** (`booking_status: 'enquiry'`),
  ohne Zahlschritt; `dronePriceLabel()` zeigt „Price on request".
- `supabase/functions/_shared/preise.ts` hat `DROHNEN_PAKETPREIS` bewusst auf
  `null` und lehnt jede Drohnen-Zahlung ab, statt eine Zahl zu erfinden.

**Wieder aufmachen, sobald Preise feststehen.** Dann vier Zahlen (BASIC,
STANDARD, PREMIUM, Schnitt-Zusatz) in `booking.html` `DRONE_PACKAGES` /
`DRONE_EDITING_PRICE` **und** in `preise.ts` — solange T-8 offen ist, an beiden
Stellen. Der Umfangstext („bis 1 Stunde vor Ort") ist geraten und gehört
mitbestätigt.

## Dringend — betrifft Geld

### [x] T-12 — Ausgespielt am 2026-07-28

`stripe-checkout` **v8**, `stripe-paymentlink` **v11**, seit 16:19:29 UTC.
Frontend auf `fac0d74`, über Vercel automatisch. Vorher der Ist-Stand
festgehalten (v7 / v10), damit die Auskunft darüber nicht verlorengeht.

Reihenfolge und Begründung stehen in `docs/deploy.md`.

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

### [~] T-11 — Vorfall: die Preislücke — **Annahme widerrufen am 2026-07-28**

**Es gab keinen Vorfall.** Andy stellt am 2026-07-28 klar: „es wurde noch gar
nichts per kreditkarte gebucht, das waren nur testbuchungen von uns". Die
Bestätigung vom 2026-07-27 beruhte auf einem Missverständnis.

**Erhoben:** Abfrage 3 der Akte gelaufen → **0 Zeilen**. Keine Buchung sperrt
einen Termin bei unstimmigem Preis. Abfragen 1, 2 und 4 nicht ausgeführt —
ohne echte Zahlungen ohne Gegenstand.

**Gültig bleibt:** Die Lücke war real und ist behoben (T-1, live seit
2026-07-27 05:59:40 UTC). Das Zeitfenster stimmt — es war offen, es wurde nur
nichts hineingetragen.

**Rest, dann ist T-11 zu:** Stripe-Dashboard im **Live-Modus** → *Payments* →
Filter *Succeeded*, 2026-06-27 bis 2026-07-27. Erwartet: leer.

Akte mit Korrektur und Ergebnisabschnitt:
**`docs/vorfall-2026-07-27-preisluecke.md`**.

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


### [ ] T-14 — `work.html` traegt eine Teilkopie der Grundgestaltung

Angelegt 2026-08-20 mit der Arbeitsproben-Galerie.

`work.html` wiederholt Farbwerte, Leiste, Knoepfe und Fusszeile aus
`index.html`, weil dort alles inline im `<style>` steht und es keinen
Bauschritt gibt. **Wer an der Gestaltung dreht, muss beide Stellen aendern.**

Kein Zeitdruck, aber der Weg heraus ist klar: den `<style>`-Block aus
`index.html` in eine `site.css` ziehen, die beide Seiten laden. Das fasst
allerdings die laufende Buchungsseite an -- deshalb bewusst nicht
nebenbei erledigt.

Nicht betroffen sind Kacheln, Schiene und Leuchtkasten: die stehen in
`work-media.css` und `work-media.js` und werden wirklich geteilt.

### [ ] T-15 — Preiskarten auf dem Handy: gestapelt oder wischbar?

Angelegt 2026-08-20. Nach der Kuerzung ist die Startseite auf dem Handy
**11.065 px statt 13.773 px** lang (13,1 statt 16,3 Bildschirme) --
und das **einschliesslich** des neuen Arbeitsproben-Abschnitts.

Der groesste verbliebene Posten sind die fuenf gestapelten Preiskarten
(1.898 px). Als wischbare Reihe -- wie jetzt schon die DJI-Geraete --
waeren es rund 500 px, also **nochmal 1.400 px weniger**.

**Bewusst nicht gemacht.** Preise sind Vergleichsinhalt: In einer Schiene
sieht man drei der fuenf Angebote nie. Auf einer Seite, die echtes Geld
einnimmt, ist das Andys Entscheidung, nicht meine. Wenn er sie will,
sind es zwei Zeilen CSS -- dieselbe Regel wie `.dji-rail`.

---

**Stand 2026-07-28:** Beim Umbau des Podcast-Angebots sind die Preise erneut an
drei Stellen angefasst worden (`index.html`, `booking.html`, `preise.ts`). Die
Schuld ist damit nicht getilgt, aber sie ist jetzt **geprüft**: 22 Tests in
`preise.test.ts` nageln jede Zahl der Serverseite fest. Wer sie ändert, ohne
`booking.html` mitzuziehen, merkt es nicht — wer sie in `preise.ts` falsch
ändert, schon.

## Erledigt

- [x] **2026-08-20** — **Arbeitsproben-Galerie.** Neue Seite `work.html` mit
      18 Reels in vier Baendern, dazu eine wischbare Schiene direkt unter dem
      Kopfbereich der Startseite. Liste und Verhalten in `work-media.js`,
      Gestaltung in `work-media.css` -- beide Seiten teilen sie sich.
      `See Our Work` im Kopfbereich zeigte bis dahin auf Instagram und zeigt
      jetzt auf die eigene Seite; `Work` steht in beiden Navigationen und in
      der Fusszeile, in allen fuenf Sprachen.
      **Nur preisfreie Reels** (n-Reihe, a07, a08, b09-b13, c14) -- die
      A-Reihe a01-a06 und die acht vom 06.08. tragen Preise mit Verfallsdatum
      31. August im Bild, siehe T-13.
- [x] **2026-08-20** — **Waagerechter Ueberlauf auf dem Handy behoben.** Das
      Buchungsraster stand inline auf `1fr 1fr` und passte bei 375 px nicht:
      `scrollWidth` war 444 statt 375, wodurch der ganze Kopfbereich verschoben
      und rechts abgeschnitten war. Jetzt einspaltig (`.booking-grid`).
- [x] **2026-08-20** — **Startseite auf dem Handy gekuerzt**, 13.773 -> 11.065 px
      (16,3 -> 13,1 Bildschirme), einschliesslich des neuen Galerie-Abschnitts.
      Drei gestapelte DJI-Karten wurden eine wischbare Reihe (-1.155 px), die
      Merkmalslisten der Preiskarten sind einklappbar, Leistungstexte auf drei
      Zeilen gekuerzt (antippen klappt auf), Abschnittspolster 70 -> 44 px.
      Dabei aufgefallen: `.dji-grid-inner` in der CSS traf im ganzen Dokument
      **kein Element** -- der Container war klassenlos.
- [x] **2026-08-20** — **Tippziele vergroessert**: Kalendertage waren 22x34,
      die Monatspfeile 32x32, Fusszeilen- und Menuelinks 21 px hoch. Alles
      unter 44 px liegt unter der Fingerbreite.
- [x] **2026-08-20** — `tools/mobil-messen.html` angelegt: misst Ueberlauf,
      Seitenlaenge und Tippziele bei 390 px. `work.html` in `tools/pruefe.py`
      aufgenommen.

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

### [ ] T-13 — Was am 31. August mit den Aktionen geschieht

Angelegt 2026-07-28, ergänzt 2026-07-29 um Andys Absicht.

**Andys Plan:** *„Nach dem 31. werden wir die Preise einfach etwas anheben und
dafür kein Rabatt mehr. Die sind ja nur da, um Kunden zu locken — aber das
gehen wir dann an, je nachdem wie viele Kunden wir haben."*

Also **kein** Zurückschalten auf die durchgestrichenen Normalpreise, sondern
ein neues, moderat höheres Preisniveau ohne Aktionskennzeichnung. Die heutigen
Normalpreise sind Anker fürs Marketing, kein Ziel.

**Betroffen sind drei Aktionen:**
| Aktion | steht auf |
|---|---|
| Studio | ฿200/Std. „promo until 31 Aug" |
| We Cut Your Podcast | 50 % — erste Stunde ฿1.500/฿2.000/฿3.000 |
| Record Your Podcast | jede weitere Stunde zum halben Satz |

**Wichtig: nichts davon schaltet von selbst um.** Am 1. September stehen
dieselben Preise da, nur mit abgelaufenem Datum daneben. Eine Automatik, die
den Preis unbeaufsichtigt verdoppelt, wäre gefährlicher als ein veraltetes
Datum — deshalb bewusst nicht gebaut.

**Die Entscheidungsgrundlage steht auf der Verwaltungsseite.** Der Wächter
zeigt „Buchungen der letzten sieben Tage" — genau die Zahl, an der Andy die
Anhebung festmachen will. Ende August dort nachsehen.

**Wenn es soweit ist, an drei Stellen ändern** (`docs/decisions.md`, T-8):
`index.html`, `booking.html` und `supabase/functions/_shared/preise.ts` —
danach **beides** ausspielen, Push und `supabase functions deploy`. Die
durchgestrichenen Preise und alle „until 31 Aug"-Hinweise fallen dann weg,
in **allen fünf Sprachen**.

⚠️ **Mit dem Preiswechsel muss auch ein Reel von der Website.** `alt08`
(„Content people actually watch.") steht seit dem 20.08. in der
Arbeitsproben-Galerie und trägt im Bild „LAUNCH OFFER · 50 % OFF · FROM
฿1,500 PER HOUR". Andy hat es bewusst ausgewählt (siehe
`tools/reels-auswahl.json`). Ab dem 1. September steht dort eine falsche
Zahl — dann austauschen oder aus `work-media.js` nehmen.

⚠️ **Beim Neusetzen den Abstand zum reinen Schnitt nachrechnen.** Mit der
jetzigen Staffel (Variante A) unterbietet Filmen + Schnitt ab etwa 1¾ Stunden
den reinen Schnitt. Das war eine bewusste Entscheidung, ergibt sich aber nicht
von selbst — wer die Sätze anhebt, verschiebt diesen Punkt.

