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
