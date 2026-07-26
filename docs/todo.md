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

### [ ] T-1 — Der zu zahlende Betrag kommt aus dem Browser

**Befund (verifiziert 2026-07-27):** `stripe-checkout` und `stripe-paymentlink`
übernehmen `amount` unbesehen aus dem Request-Body:

```ts
const { bookingId, bookingRef, amount, … } = body;
…
unit_amount: Math.round(amount * 100)
```

**Keine** der drei Functions liest den Buchungssatz aus der Datenbank, bevor sie
den Betrag an Stripe gibt. Wer die Anfrage im Browser abfängt und `amount` auf
`1` setzt, bucht für ein Baht — und der Webhook bestätigt die Buchung
anschließend als `paid`, weil er nur auf das Stripe-Ereignis schaut.

**Zu tun:** Die Function holt den Betrag selbst:
`select total_price, deposit_amount from bookings where id = bookingId` und
rechnet damit. Der Wert aus dem Body wird höchstens noch zum Vergleich benutzt.

*Keine Aussage darüber, ob das je ausgenutzt wurde — dafür bräuchte es einen
Blick in die Stripe-Zahlungen.*

### [ ] T-2 — Deploy-Wahrheit der Stripe-Functions klären

Ob bei Supabase die Fassung vom 1. Juli oder die vom 28. Juni läuft, ist
ungeklärt. Läuft die alte, bleiben per PromptPay bezahlte Buchungen auf
`pending` stehen. Prüfweg und Hintergrund: **`docs/deploy.md`**.

Braucht Andys Supabase-Zugang — von hier aus nicht feststellbar.

---

## Offen — braucht eine Antwort von Andy

### [ ] T-3 — Wie kommt das Frontend auf den Server?

Im Repo steht keine Deploy-Konfiguration. Unbekannt ist damit auch, ob die
öffentliche Fassung dem Stand vom 6. Juli entspricht. Einziger Hinweis auf die
Domain: `rentme-bkk.com`, und der stammt aus einer veralteten Datei.

### [x] T-4 — Wem gehört `github.com/sunjehad/Renmte-BKK`? — **beantwortet**

**2026-07-27 (Andy):** Sun ist der Eigentümer, Andy ist Manager. Das Repo ist
richtig so. Der Remote steht damit nicht mehr in Frage.

Offen bleibt nur die Freigabe für den einzelnen Vorgang: **ein Commit wartet
seit dem 21.07.** (`57ebc3c`), und die Änderungen vom 27.07. liegen ebenfalls
im Arbeitsbaum. Gepusht wird auf Ansage, nicht von allein (R-005).

### [ ] T-5 — Kann `~/rentme/` weg?

Dort liegen zwei ältere Kopien der Stripe-Functions. Sie sind nur deshalb
aufzuheben, weil unklar ist, ob eine davon deployed ist. Sobald T-2 beantwortet
ist, entfällt der Grund.

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

**Was weiterhin fehlt und der eigentliche Punkt ist:**
- eine **getrennte Testumgebung** (zweites Supabase-Projekt + Stripe-Testmodus).
  Ohne sie kann die Buchungsstrecke nie ganz durchgeklickt werden, weil jeder
  Versuch eine echte Buchung und eine echte Zahlung erzeugt.
- **Tests der drei Edge-Functions** gegen erfundene Stripe-Ereignisse. Das ginge
  auch ohne Testumgebung und wäre der nächste sinnvolle Schritt.

### [ ] T-8 — Doppelte Preisführung

Preise stehen in `index.html` **und** `booking.html`. Eine Änderung an einer
Stelle ist eine stille Falle.

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
