# Entscheidungen — RentMe Bangkok

Projekteigene Entscheidungen, Nummerierung `R-xxx`.
Projektübergreifendes steht in `~/projects-brain/knowledge/decisions.md` (`B-xxx`).

> **Rückwirkend aufgeschrieben.** R-001 bis R-003 halten fest, was im Code
> bereits so gebaut **ist** — sie sind aus dem Bestand gelesen, nicht neu
> entschieden. Wo eine Begründung nicht belegbar war, steht das dabei.

---

## R-001 — Statisches HTML, kein Framework

**Bestand seit dem ersten Commit, aufgeschrieben 2026-07-27**

Die Seiten sind einzelne HTML-Dateien mit eingebettetem CSS und JavaScript.
Kein React, kein Build-Schritt, kein Paketmanager; Fremdbibliotheken kommen über
CDN.

**Was dafür spricht:** Die Seite lässt sich überall ausliefern, wo Dateien
liegen können. Es gibt nichts, was zwischen Bearbeiten und Sichtbarwerden kaputt
gehen kann.

**Was es kostet:** `booking.html` ist auf 2.254 Zeilen gewachsen, Preise stehen
doppelt (`docs/todo.md` T-6, T-8), und es gibt keine Stelle, an der sich etwas
prüfen ließe. Die Entscheidung trägt für eine Seite mit fünf Unterseiten —
nicht mehr.

**Nicht rückgängig gemacht**, aber die Grenze ist erreicht.

---

## R-002 — Geheimnisse ausschließlich in der Supabase-Umgebung

**Bestand, verifiziert 2026-07-27**

Alle drei Edge-Functions lesen ihre Geheimnisse über `Deno.env.get(...)`:
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`.
Im Repo steht **kein** geheimer Schlüssel — nachgeprüft.

Der Stripe-Schlüssel im Frontend (`pk_live_…`) ist der **öffentliche**
Schlüssel und gehört dorthin; ebenso der Supabase-Anon-Schlüssel, dessen
Sicherheit an Row Level Security hängt (`supabase-security.sql`).

**Gilt weiter. Ein `sk_`-Schlüssel darf nie in eine Frontend-Datei.**

---

## R-003 — Buchen ohne Konto bleibt möglich

**Bestand, aufgeschrieben 2026-07-27**

`bookings` führt `guest_name` für Buchungen ohne `user_id`. Wer nicht angemeldet
ist, kann trotzdem buchen und zahlen.

**Warum das so bleibt:** Ein Konto vor der Buchung zu verlangen, ist die
teuerste Hürde, die eine Buchungsstrecke haben kann. Die Anmeldung
(`auth.html`, `profile.html`) ist ein Angebot, keine Bedingung.

---

## R-004 — Git ist die Versionierung, keine `.backup`-Dateien

**2026-07-27**

`admin.html.backup` und `booking.html.backup` (Stand 28. Juni, zusammen 137 KB)
lagen versioniert neben den echten Dateien. Sie sind aus dem Git genommen,
`*.backup` steht in `.gitignore`.

**Warum:** Zwei Fassungen derselben Seite nebeneinander heißt, dass beim
nächsten Bearbeiten die falsche erwischt werden kann. Genau dieser Fehler ist
bei den Stripe-Functions bereits eingetreten (`docs/deploy.md`) — dort gibt es
drei Fassungen und niemand weiß, welche läuft.

**Nichts ist verloren:** `git show c24b9f0:booking.html.backup`.

---

## R-005 — Kein Deploy und kein Push ohne Andys Freigabe

**2026-07-27**

Es gibt keine Testumgebung: keine zweite Supabase-Instanz, keinen
Stripe-Testmodus, kein Staging. Jede Ausspielung wirkt sofort auf zahlende
Kundschaft.

Zum Remote (`github.com/sunjehad/Renmte-BKK`): **Sun ist Eigentümer, Andy ist
Manager** (bestätigt 2026-07-27). Das Repo ist richtig. Dass nicht ungefragt
gepusht wird, folgt trotzdem — in ein fremdes Repo schiebt man nicht nebenbei.

**Konkret:** kein `supabase functions deploy`, kein `git push`, kein Ausführen
der `.sql`-Dateien, keine verändernden Stripe- oder Supabase-Aufrufe. Steht
verbindlich in `AGENT_RULES.md`.

---

## R-006 — Maßgeblich ist immer `supabase/functions/` in diesem Repo

**2026-07-27**

Die Stripe-Functions existieren an drei Orten mit unterschiedlichem Inhalt
(`docs/deploy.md`). Bearbeitet wird ausschließlich die Fassung in diesem Repo;
die Kopien unter `~/rentme/` werden nicht angefasst und nicht gelöscht, solange
ungeklärt ist, ob eine davon deployed ist.


---

## R-007 — Vor jeder Änderung wird geprüft

**2026-07-27, Andys Auflage:** „booking.html nur anfassen, wenn sicher ist, dass
die Website danach noch funktioniert."

Das war bis dahin nicht prüfbar: kein Build, keine Tests, kein Staging. Ein
Tippfehler im eingebetteten JavaScript fiel erst auf, wenn eine Kundin die
Buchung nicht abschließen konnte — genau so lag der `customerName`-Fehler
wochenlang live.

**Eingeführt:** ein zweistufiges Verfahren, verbindlich in `docs/pruefen.md`.

1. `python3 tools/pruefe.py` — statisch, ohne Ausführen. Findet Syntaxfehler,
   doppelte Objektschlüssel, tote Element-Verweise, Handler ohne Funktion und
   geheime Schlüssel. Bekannte Altlasten stehen in `tools/bekannt.txt`, damit
   die Prüfung nicht dauerhaft rot steht und deshalb ignoriert wird.
2. Seite lokal laden, Konsole muss leer sein.

**Warum eine eigene Prüfung und kein fertiges Werkzeug:** Ein Linter bräuchte
`node_modules`, eine Konfiguration und einen Build-Schritt — genau das, was
R-001 diesem Projekt erspart. Die fünf Fehlerklassen, die hier wirklich
vorkommen, sind mit `ast`-freiem Python und `node --check` abgedeckt, ohne eine
einzige Abhängigkeit.

**Grenze, ausdrücklich:** Das Verfahren prüft, ob die Seite **funktioniert** —
nicht, ob sie **richtig rechnet**. Ein falscher Preis kommt sauber durch. Und
die Buchungsstrecke kann nie ganz durchgeklickt werden, solange es keine
Testumgebung gibt (`docs/todo.md` T-7).


---

## R-008 — Drohnenflug ist eine Anfrage, keine Sofortbuchung

**2026-07-27, Andys Entscheidung**

Der neue Dienst „Aerial / Drone Filming" führt **keine Zahlung** und **kein
Datum** in der Buchungsstrecke. Der Kunde wählt ein Paket, beschreibt Ort und
Vorhaben, hinterlässt seine Daten — Termin und Endpreis werden danach
abgestimmt.

**Warum:** Flugzeit, Anfahrt und die Genehmigungslage sind je Objekt
verschieden. Ein fester Preis im Voraus wäre geraten, und ein fest gebuchter
Termin ließe sich nicht halten, wenn der Luftraum am Standort gesperrt ist.

**Zwei technische Folgen, beide beabsichtigt:**

1. **Kein Konflikt mit dem Doppelbuchungsschutz.** `cancel_competing_pending_bookings`
   kennt nur `studio_rental`, `podcast`, `podcast_setup` und `equipment`. Ein
   neuer Typ fiele dort durch — genau deshalb darf eine Drohnen-Anfrage **kein**
   Zeitfenster belegen. Wäre der Dienst terminbasiert, müsste die SQL-Funktion
   erweitert und ausgespielt werden (`AGENT_RULES.md`: gesperrt).
2. **Eigener Status `enquiry`.** Ohne ihn stünde die Anfrage als `confirmed` in
   der Verwaltung, weil `booking_status` bisher allein am Preis hing: kein
   Preis → `confirmed`. Eine Anfrage ist aber weder bezahlt noch bestätigt.

**Preise:** Die drei Pakete stehen in `booking.html` in **einer** Konstanten
(`DRONE_PACKAGES`), Aufpreis für den Schnitt in `DRONE_EDITING_PRICE`. Solange
dort `null` steht, zeigt die Seite ehrlich „Price on request" — es wird
**keine Zahl erfunden**. Sobald Andy die Beträge nennt, ist es je Paket eine
Zeile.

---

## R-009 — Der Dienst wird über die Adresse vorgewählt

**2026-07-27**

`booking.html?service=<typ>` springt direkt in den passenden Dienst. Die
Startseite verlinkte seit jeher so (`?service=podcast_setup` im Preisteil) —
**ausgewertet wurde der Parameter nie**, der Link landete auf Schritt 1 ohne
Auswahl. Jetzt wird er ausgewertet, aber nur für Dienste, zu denen es auch
eine Karte gibt; sonst stünde der Nutzer in einem leeren Schritt 2.

---

## R-010 — Den Preis bestimmt der Server, und zwar aus dem Umfang

**2026-07-27** — Antwort auf T-1.

`stripe-checkout` und `stripe-paymentlink` nahmen den zu zahlenden Betrag
unbesehen aus dem Request-Body. Wer die Anfrage abfing und `amount` auf `1`
setzte, buchte für ein Baht; der Webhook bestätigte danach als `paid`.

**Der naheliegende Fix wäre falsch gewesen.** `todo.md` T-1 schlug vor,
`total_price` aus der Datenbank zu lesen. Das hätte die Lücke **nicht**
geschlossen: Der Buchungssatz entsteht über die RPC `create_booking`
(`stripe-migration.sql` Z. 79 ff.), die `SECURITY DEFINER` läuft, für `anon`
freigegeben ist und `payload->>'total_price'` wortwörtlich übernimmt. Der Wert
in der Datenbank ist genauso vom Browser gesetzt wie der im Body — nur einen
Schritt früher.

**Entschieden:** Der Betrag wird in `supabase/functions/_shared/preise.ts` aus
dem **reservierten Umfang** neu berechnet — Dienst, Unterart, Dauer, Miettage,
Geräte. Das sind die Felder, die bestimmen, was der Kunde bekommt und was der
Kalender sperrt. Wer sie fälscht, fälscht seine eigene Buchung mit und bekommt
wirklich nur die eine Stunde, für die er zahlt. Damit hängt der Preis an der
Leistung, und das ist die Eigenschaft, auf die es ankommt.

**Fail-closed.** Lässt sich kein Betrag sicher bestimmen, wird abgelehnt —
kein Rückfall auf den Browser-Wert. Betroffen sind heute Drohne (Preise
unbekannt, T-10) und `reel` (Paketgröße steht nur in `notes`, in keiner
Spalte). Eine Buchung, die nicht zustande kommt, ist behebbar; eine Buchung
über 10 THB ist es nicht.

**Zweiter Befund, gleich mitbehoben:** Auch `currency` kam aus dem Body. Ein
serverseitig korrekt errechneter Betrag von 800 hätte als 800 IDR eingezogen
werden können — rund 1,70 THB. Die Währung ist jetzt fest (`WAEHRUNG`).

**Das Frontend wurde nicht angefasst.** Es schickt `amount` weiterhin mit; der
Wert wird nur noch verglichen und bei Abweichung protokolliert. Das ist
Absicht: So bleibt eine Spur, an der sich ein Manipulationsversuch erkennen
lässt, und `booking.html` musste für einen Sicherheitsfix nicht angerührt
werden (R-007).

**Preistafel doppelt geführt.** Die Zahlen stehen jetzt in `booking.html`
**und** in `preise.ts` — T-8 wird dadurch schlimmer, nicht besser. Bewusst in
Kauf genommen: Die Alternative wäre, die Preise erst zusammenzuführen und die
Lücke so lange offen zu lassen. `preise.test.ts` nagelt jede Zahl fest, damit
ein Auseinanderlaufen auffällt.

**Nachtrag 2026-07-27, nach dem Ausspielen:** Der Fix ist seit **05:59:40 UTC**
live (`stripe-checkout` v7, `stripe-paymentlink` v10). **Andy hat bestätigt,
dass die Lücke ausgenutzt wurde** — die Auswertung führt eine eigene Akte,
`docs/vorfall-2026-07-27-preisluecke.md`. Damit war R-010 keine Vorsorge,
sondern eine Reparatur.

---

## R-011 — Functions werden mit `--use-api` und einzeln ausgespielt

**2026-07-27**, aus dem Deploy des T-1-Fixes gelernt.

**`--use-api`.** Ohne das Flag baut die CLI in einem lokalen Docker-Container
und lädt dafür `edge-runtime:v1.73.13`. Das hing über zehn Minuten am
Image-Download. Mit `--use-api` baut Supabase serverseitig — Sekunden. Für
dieses Projekt gibt es keine lokale Entwicklungsumgebung, die der Container
abbilden müsste; der Docker-Weg kauft hier nichts.

**Einzeln, nicht alle.** `supabase functions deploy` ohne Slug spielt jede
Function aus, auch die, an denen niemand gearbeitet hat. Bei Zahlungswegen ist
das unnötiges Risiko. Deshalb:

```bash
supabase functions deploy stripe-checkout stripe-paymentlink --use-api
```

**Und vorher `functions list`.** Der Deploy überschreibt Version und Datum —
also genau die Auskunft darüber, was vorher lief. Am 2026-07-27 hat nur diese
Reihenfolge den Beweis für T-2 gerettet. Wer zuerst ausspielt, hat ihn
vernichtet.

**Nebenbei richtiggestellt:** Der Zugangs-Token der CLI 2.108 liegt im
**macOS-Schlüsselbund**, nicht unter `~/.supabase/access-token`. Aus dem Fehlen
der Datei wurde am selben Tag fälschlich geschlossen, es gebe keinen Login.
Die richtige Probe ist `supabase projects list`.

---

## 2026-07-28 — Das Podcast-Angebot: drei Dienste statt fünf halber

**Andys Festlegung.** Die Seite bot bis dahin fünf Podcast-Varianten an, von
denen zwei denselben Preis hatten und drei überhaupt nicht buchbar waren.
Künftig gibt es genau drei:

| Dienst | `service_type` | Preis |
|---|---|---|
| **Record Your Podcast** | `podcast_setup` | ฿600 / ฿800 / ฿1.100 je Stunde (1/2/3 Kameras), + ฿300/h Videograf, + ฿1.000 einmalig — **Schnitt und Intro-Clip inklusive** |
| **Cut Only** | `podcast` + `editing_only` | ฿3.000 bis 2 h Rohmaterial, + ฿1.000 je weiterer Stunde (Aktionspreis, regulär ฿6.000) |
| **Full Podcast Service** | `full_podcast` | ฿19.000 für 5 Folgen — **nur Anfrage**, kein Zahlschritt |

**Warum `podcast` jetzt „Cut Only" heißt.** Die Aufnahme lief in zwei
konkurrierenden Abläufen (`podcast` und `podcast_setup`), von denen der erste
gar keine Auswahlkarte hatte. Statt eine neue Kennung einzuführen und den
Bestand zu migrieren, behält `podcast` die Kennung und verliert die Aufnahme.
`service_subtype = 'editing_only'` heißt seit jeher genau das.

**Der Preis hing an der falschen Größe.** `editing_only` rechnete `1.000 THB ×
Folgenzahl`. Verkauft wurde ฿3.000 für bis zu zwei Stunden Material. Maßgeblich
ist jetzt die **Menge Rohmaterial** — `duration_hours` trägt bei diesem Dienst
Stunden Material, nicht Studiozeit. Hätte niemand das zusammengeführt, hätte die
Seite fail-closed-konform und völlig unauffällig ein Drittel des Preises
eingezogen.

**Die alten Unterarten werden abgelehnt, nicht weitergerechnet.**
`podcast_recording` und `podcast_editing` liefern in `preise.ts` jetzt
`ANGABEN_UNVOLLSTAENDIG`. Taucht so eine Buchung neu auf, stimmt etwas nicht —
dann soll die Preisquelle stehen bleiben statt zu raten. Altbestand wird nicht
rückwirkend neu bepreist; er ist bezahlt.

**Anzahlung bleibt bei ฿1.000** (Andys Entscheidung, Variante a). Das ist genau
die einmalige Einrichtungsgebühr — eine Teilzahlung, die sich in einem Satz
erklären lässt. Voll abbuchen ließe sich später **ohne** Schemaänderung, indem
Kameraanzahl und Videograf in die vorhandene Spalte `service_subtype` kodiert
werden (z. B. `setup_2cam_vg`). Zwei neue Spalten braucht es dafür nicht.

**Anfrage-Dienste sind jetzt eine Liste**, nicht sieben Mal `=== 'drone'`:
`ANFRAGE_DIENSTE = ['drone', 'full_podcast']`. Sie durchlaufen dieselbe Strecke,
enden aber nicht an der Kasse — Status `enquiry`, kein Zahlschritt, und die
Bestätigungsseite spricht von einer Anfrage.

**Nachtrag vom selben Tag — die Einzelsession wird teurer, nicht das Paket
billiger.** Die erste Fassung hatte ein Loch: Eine Session (2 h, 2 Kameras,
Videograf) kostete ฿3.200, eine Folge im Fünferpaket ฿3.800. Das Paket war ein
**Aufpreis**. Andys Entscheidung: die Einzelsession anheben.

| | vorher | jetzt |
|---|---|---|
| 1 Kamera | ฿600/h | **฿800/h** |
| 2 Kameras | ฿800/h | **฿1.100/h** |
| 3 Kameras | ฿1.100/h | **฿1.500/h** |
| Videograf | +฿300/h | **+฿400/h** |
| Einrichtung (einmalig) | ฿1.000 | **฿1.500** |

Normalfall damit **฿4.500**; fünf einzeln ฿22.500 gegen ฿19.000 im Paket —
**16 % Ersparnis**, und das Paket ist erklärbar, ohne seinen Inhalt aufzublähen.

Die Einrichtungsgebühr ist zugleich die online eingezogene **Anzahlung**; sie
steigt damit von ฿1.000 auf ฿1.500 (`PODCAST_SETUP_ANZAHLUNG`). Sie steht in
`booking.html` jetzt als Konstante `PODCAST_AUFBAU` und nicht mehr als Zahl an
fünf Stellen.


**Zweiter Nachtrag vom 2026-07-28 — Cut Only folgt der Werbung, nicht meiner
Annahme.** Andy hat den Aushang „WE CUT YOUR PODCAST" nachgereicht. Das
Preismodell darin ist ein anderes als das zuvor gebaute:

Der Preis hängt an der **Zahl der Kameraperspektiven im Rohmaterial**, nicht an
einer Materialpauschale — die Perspektiven bestimmen den Schnittaufwand. Die
erste Stunde kostet den vollen Promo-Satz, jede weitere die Hälfte.

| Kameras | normal/h | Promo (50%) | jede weitere Stunde |
|---|---|---|---|
| 1 | ฿3.000 | **฿1.500** | ฿750 |
| 2 | ฿4.000 | **฿2.000** | ฿1.000 |
| 3 | ฿6.000 | **฿3.000** | ฿1.500 |

Damit ist auch geklärt, woher die ฿3.000 aus dem Gespräch kamen: Das ist der
**3-Kamera-Satz für die erste Stunde**, nicht „bis zu zwei Stunden Material".
Die erste Fassung hätte bei drei Kameras und einer Stunde ฿3.000 statt richtig
฿3.000 verlangt — bei einer Kamera aber ฿3.000 statt ฿1.500, also das Doppelte.

**Die Kameraanzahl steht in `service_subtype`** (`editing_only_2cam`), nicht in
einer neuen Spalte. Genau der Weg, der beim Podcast-Setup als spätere Option
notiert war (siehe oben) — hier gleich angewandt: Die Spalte gibt es, sie trägt
genau diese Art von Angabe, und der Betrag bleibt damit **serverseitig
nachrechenbar ohne Schemaänderung**. Das nackte `editing_only` wird abgelehnt.

**Lieferformate 16:9 und 9:16** stehen jetzt in der Buchungsstrecke, weil sie
auf dem Aushang stehen. Ohne sie fragt jeder Kunde nach.

**„On request only" ist beim Full Podcast Service jetzt sichtbar** (Andys
Wunsch) — als Kennzeichnung an der Karte, am Preis und in der Zusammenfassung,
nicht nur im Kleingedruckten.

---

## 2026-07-28 — DJI-Staffel gilt wie beworben, Reels bekommen echten Rabatt

**Gerätemiete: die beworbene Staffel ist jetzt die gültige.** Der Prozentrabatt
(10 % ab 3 Tagen) ist ersatzlos entfallen; ab drei Tagen gilt ein **eigener
Tagessatz je Gerät**:

| Gerät | 1–2 Tage | ab 3 Tagen |
|---|---|---|
| DJI Pocket 3 | ฿500 | **฿300** |
| DJI Neo | ฿700 | **฿500** |
| DJI Osmo Nano | ฿500 | **฿300** |

Begründung: Die Zahl stand öffentlich auf der Startseite; 3 Tage Pocket 3 waren
dort ฿900 versprochen und ฿1.350 abgebucht. Von den beiden möglichen
Auflösungen ist die kundenfreundliche die, die keine Beschwerde erzeugt — und
40 % sind ein Anreiz, drei Tage statt einen zu mieten, 10 % nicht.

> ⚠️ **Nebenwirkung, bewusst nicht stillschweigend geglättet:** Bei Pocket 3
> und Nano kostet die 3-Tage-Miete (฿900) **weniger als zwei Tage** (฿1.000).
> Das folgt zwingend aus den beworbenen Zahlen. Wer das nicht will, muss den
> Staffelsatz auf ฿350 heben (3 × 350 = ฿1.050) — das ist eine Preisfrage,
> keine technische, und gehört Andy.

**Reel-Pakete: Einzelreel ฿300, Pakete mit echtem Nachlass.**

| Paket | Preis | je Reel | Ersparnis |
|---|---|---|---|
| 1 Reel | ฿300 | ฿300 | — |
| 5 Reels | ฿1.200 | ฿240 | ฿300 (20 %) |
| 10 Reels | ฿2.100 | ฿210 | ฿900 (30 %) |

Vorher kosteten alle drei Pakete ฿200 je Reel — die Karte sagte es selbst:
„save ฿0 per reel". Ein Paket ohne Ersparnis ist schlechter als gar kein Paket.

**Reel-Schnitt ist jetzt buchbar.** Der Dienst existierte im Code vollständig,
hatte aber keine Auswahlkarte und wurde serverseitig abgelehnt, weil die
Paketgröße nur in `notes` stand. Beides behoben: Karte auf Schritt 1, und die
Größe steht in `service_subtype` (`reel_5`) — derselbe Weg wie beim
Schnittdienst, also nachrechenbar **ohne Schemaänderung**.

**Ein Test hat die Änderung gefangen.** `manipulierter Betrag: gefaelschte
rental_days bleiben wirkungslos` nagelte die alte 10-%-Rechnung fest (฿2.250)
und schlug fehl, bis die neue Staffel eingetragen war (฿1.500). Genau dafür ist
`preise.test.ts` da.

---

## 2026-07-28 — Textarbeit an der Kundenansicht

Nach einer kritischen Durchsicht aus Kundensicht, von Andy beauftragt:

- **Der Preisblock zeigt jetzt alle fünf buchbaren Preise.** „We Cut Your
  Podcast" und „Reel Editing" fehlten dort ganz — der Schnittdienst, für den es
  einen gedruckten Aushang gibt, stand nur als roter Kasten im Fließtext. Ein
  Abschnitt mit der Überschrift „NO SURPRISES" darf sein bestes Angebot nicht
  verstecken. Das Raster ist auf `auto-fit` umgestellt, damit fünf Karten
  passen.
- **„Most Popular" sitzt jetzt auf „Record Your Podcast".** Vorher trug es das
  Fünferpaket — das Einzige, das man nicht buchen kann. Das stärkste optische
  Signal führte in ein Anfrageformular.
- **Das Wort „deposit" gehört nur noch der Gerätekaution.** Die ฿1.500 beim
  Podcast heißen jetzt „Setup fee — paid now", mit dem ausdrücklichen Zusatz,
  dass sie Teil des Gesamtpreises sind und nicht zurückgezahlt werden. Vorher
  hieß beides „deposit" und meinte das Gegenteil voneinander.
- **Beide Aktionen haben ein Enddatum** (31. August), in allen fünf Sprachen.
  Ein Rabatt ohne Frist liest sich als Normalpreis. Ablauf ist Handarbeit, s.
  `docs/todo.md` T-13.
- **„FOUR SERVICES" ist raus.** Die Zahl stimmte nicht mehr und wäre bei der
  nächsten Änderung wieder falsch geworden; jetzt steht dort
  „STUDIO. PODCAST. GEAR.", ebenfalls in allen Sprachen.
- **Die beiden Fragen im Schnittdienst sind eindeutig gestellt.** „Camera
  angles" erklärt jetzt, dass Handy plus GoPro zwei sind; aus „How much raw
  footage" wurde „Total length of your recordings" mit dem Hinweis, dass
  90 Minuten auf drei Kameras 90 Minuten sind und nicht 4½ Stunden. Genau
  dieser Irrtum hätte den Preis verdreifacht.

**Schritt 1 der Buchung: drei beschriftete Gruppen statt sieben gleichrangiger
Karten** (2026-07-28). Aus vier Diensten waren sieben geworden, davon drei rund
um Podcast und zwei, die beide mit „schick uns dein Material" anfangen.

Bewusst **keine zweite Klickebene** — ein Zwischenschritt kostet Buchungen.
Stattdessen drei Überschriften auf einem Bildschirm, die die Frage beantworten,
die der Kunde tatsächlich hat — *wer macht was und wo*:

1. **In our studio** — Studio · Record Your Podcast · Full Podcast Service
2. **You send us the footage** — We Cut Your Podcast · Reel Editing
3. **Gear &amp; aerial** — DJI Rental · Drohnenflug

Der Gewinn liegt bei Gruppe 2: Nebeneinander unter einer gemeinsamen
Überschrift wird der Unterschied zwischen Podcast-Schnitt und Reel-Schnitt zur
Nebensache statt zur Verwechslungsgefahr. Gruppe 1 zeigt, dass die drei
Podcast-Angebote Stufen desselben Dienstes sind, keine Konkurrenten.

Die Karten wurden **nicht neu geschrieben**, sondern im Quelltext umgehängt —
so kann sich beim Umbau kein Preis und kein Text verändert haben. Der
Deep-Link (`?service=…`) sucht mit `querySelector` im ganzen Dokument und ist
von der Verschachtelung unberührt; alle sieben wurden einzeln gegengeprüft.
„CUT ONLY" heißt jetzt **„WE CUT YOUR PODCAST"** wie auf dem Aushang und auf
der Startseite.

---

## 2026-07-28 — Startseite bereinigt, Preisgefüge geradegezogen, Seite fünfsprachig

**Der Abschnitt „Creators love this space" ist entfernt.** Andys Entscheidung.
Er behauptete „Hundreds of creators … have used Rent Me Bangkok" — dafür gibt
es keinen Beleg, und er wiederholte die 141K-Zahl aus dem Kopfbereich. Der
Navigationspunkt „About" zeigte dorthin und ist mit weggefallen, sonst hätte er
ins Leere geführt. Die zugehörigen Wörterbuch- und CSS-Einträge sind ebenfalls
raus — **gegengeprüft**, nicht geraten: gelöscht wurde nur, was im Markup
nachweislich nicht mehr vorkommt (29 tote Schlüssel, darunter der komplette
Satz zum alten ฿10.000-Paket).

**Zwei Fehler im Kopfbereich behoben:**
- „3 Core Services" stimmte nicht mehr. Dort steht jetzt **„50 % off podcast
  editing — until 31 Aug"**: wahr, aktuell und arbeitet für die Aktion, statt
  eine Zahl zu nennen, die bei jeder Änderung wieder falsch wird.
- Die Besucherzahl wurde mit `toLocaleString()` **ohne Sprache** formatiert,
  richtete sich also nach dem Browser des Besuchers. Auf einem deutschen Gerät
  stand dort „141.662" — ein englischer Leser liest das als 141,66. Jetzt fest
  `en-US`, wie alle anderen Beträge der Seite („฿1,500").

**Filmen + Schnitt ist jetzt in jeder Kombination teurer als reiner Schnitt.**
Die Sätze steigen von 800/1.100/1.500 auf **900/1.300/1.900** je Stunde.

| Fall | filmen + schneiden | nur schneiden | Abstand |
|---|---|---|---|
| 1 h, 3 Kameras | ฿3.400 | ฿3.000 | +฿400 |
| 2 h, 2 Kameras | ฿4.100 | ฿3.000 | +฿1.100 |
| 8 h, 3 Kameras | ฿16.700 | ฿13.500 | +฿3.200 |

Der knappste Fall (1 h, 3 Kameras) liegt noch ฿400 auseinander; vorher waren es
bei 2 h und 3 Kameras **฿0** — beides kostete ฿4.500. Normalfall jetzt ฿4.900,
fünf einzeln ฿24.500 gegen ฿19.000 im Paket, also **22 % Ersparnis**.

**Die Seite ist wieder vollständig fünfsprachig.** Alle neuen Preiskarten
(Record Your Podcast, Full Podcast Service, We Cut Your Podcast, Reel Editing)
haben Übersetzungsmarker und Einträge in Englisch, Französisch, Deutsch,
Russisch und Thai. Gegengeprüft: **112 Schlüssel im Markup, kein einziger fehlt
in irgendeiner der fünf Sprachen.** In Bangkok ist Thai die Sprache, die zählt
— vorher blieben genau die Podcast-Preise beim Umschalten auf Englisch stehen.

**Nachtrag: der Staffelsatz gilt nur für die zusätzlichen Tage** (2026-07-28).
Andys Einwand: „zwischen 2 und 3 Tage nur 50 Baht?" — und er hatte recht. Ein
rückwirkender Staffelsatz macht den Sprung nicht weg, er verschiebt ihn nur:
Solange der Satz unter dem Grundpreis liegt, ist der dritte Tag rechnerisch
fast geschenkt, bei ฿350 eben ฿50.

Jetzt: **die ersten zwei Tage zum vollen Satz, jeder weitere zum Zusatzsatz.**

| | 1 T | 2 T | 3 T | 7 T | 14 T |
|---|---|---|---|---|---|
| Pocket 3 / Nano | ฿500 | ฿1.000 | ฿1.300 | ฿2.500 | ฿4.600 |
| Neo | ฿700 | ฿1.400 | ฿1.900 | ฿3.900 | ฿7.400 |

Es ist dieselbe Logik wie beim Schnittdienst — erste Einheit voll, jede weitere
günstiger. Ein Kunde, der beides bucht, findet dasselbe Muster wieder statt
zweier verschiedener Rabattsysteme. Und der Nachlass landet bei den langen
Mieten, wo er hingehört.

Dazu ein Test, der für alle drei Geräte über 30 Tage prüft, dass der Preis
**nie fällt**. Das war der eigentliche Fehler, nicht die Höhe der Zahl.

---

## 2026-07-28 — Handybedienung: Größen und Ankerpunkte, Farben unverändert

Andys Vorgabe: Vorschlag übernehmen, **Farben bleiben**. Also kein Navy — nur
Struktur, Trefferflächen und die Stelle, an der der Knopf sitzt.

**Buchungsstrecke:**
- Die Aktionsleiste klebt auf dem Handy am unteren Rand (`position:sticky`),
  mit dem **Preis links und dem Knopf rechts**. Vorher stand der Knopf unter
  dem gesamten Inhalt: Wer die Dauer wählte, sah ihn nicht und musste
  weiterscrollen — wobei der Preis oben aus dem Bild verschwand. Der Betrag
  wird von `updateDock()` gepflegt und kennt den Sonderfall Podcast-Setup
  („฿1.500 / ฿3.300“ — jetzt fällig / gesamt) sowie Anfragen ohne Preis.
- **Eingabefelder auf 16 px** unter `@media(pointer:coarse)`. Bei 14 px zoomt
  Safari beim Antippen in jedes Feld hinein und die Seite springt — in
  Schritt 3 bei jedem einzelnen Feld.
- **Chips und Zeitfenster auf 44 px** Mindesthöhe. Sie lagen bei rund 33 px
  (`padding:8px 18px` bei 13 px Schrift); 44 ist das empfohlene Mindestmaß.
- **„Step 2 of 5 — Details"** statt nackter Punkte. Die Beschriftungen werden
  auf dem Handy ausgeblendet; ohne Zähler weiß niemand, wie viel noch kommt.

**Startseite:**
- 🔴 **Der Buchungsknopf war auf dem Handy unsichtbar.** `.nav-cta{display:none}`
  versteckte ihn hinter dem Hamburger-Menü — die wichtigste Schaltfläche der
  Seite hinter zwei Antippern. Er bleibt jetzt in der Kopfleiste stehen, nur
  kompakter.
- Dazu eine **feste Leiste am unteren Rand**, die erscheint, sobald der
  Kopfbereich durchgescrollt ist (`IntersectionObserver` auf `#hero`), mit dem
  Studiopreis und der laufenden Aktion. Fünfsprachig wie der Rest.
- **`scroll-margin-top:84px`** auf alle Abschnitte mit `id`. Ohne das
  verschwand jede angesprungene Überschrift hinter der festen Kopfleiste.
- **Zwischengröße 769–1024 px** ergänzt: Preisraster und DJI-Karten zweispaltig
  statt einspaltig. Vorher gab es nur „drei Spalten" oder „eine".
- Auf schmalen Geräten kleinere Polster an den Preiskarten (28/20 statt 40/32)
  — fünf Karten untereinander ergaben sonst eine sehr lange Seite.

Kein Preis, kein Text und keine Reihenfolge wurde dabei geändert.

**Nachtrag: die erfundenen Zahlen im Kopfbereich sind raus** (2026-07-28).
Andy: „die views am anfang sind immer noch fake." Er hat recht — beim ersten
Hinweis wurde nur „3 Core Services" korrigiert, die eigentliche Behauptung
blieb stehen.

Entfernt: **„141.662 Views / 30 days"** und **„21 Posts Published"**. Für beide
gibt es keinen Beleg; die Views waren zusätzlich der Rest des schon gelöschten
Abschnitts „Creators love this space" (dort standen dieselben 141K). Die
Zähleranimation `animateCounter()` samt `heroObserver` ist mit weggefallen —
sie animierte ausschließlich diese eine Zahl.

**Korrigiert am selben Tag:** Zunächst wurden die beiden Zahlen durch belegbare
Angaben ersetzt. Auf Andys Ansage — „nein, einfach sowas raus machen" — ist der
**gesamte Statistikblock** entfernt, samt CSS und den vier
Wörterbuch-Schlüsseln. Der Kopfbereich endet jetzt mit den beiden Schaltflächen.

Das ist die richtigere Entscheidung: Kennzahlen im Kopfbereich sind ein Versprechen,
das jemand pflegen muss. Ein Betrieb ohne belastbare Zahlen ist mit ihnen schlechter
dran als ohne — jede stehengebliebene Zahl wird irgendwann zur Unwahrheit.

Gegengeprüft: Im gesamten Markup steht keine Zahl mehr, die nicht aus der
Preisliste oder der Adresse kommt.
