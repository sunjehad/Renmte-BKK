# Vorfall — die Preislücke wurde ausgenutzt

**Angelegt:** 2026-07-27 · **Status:** Lücke geschlossen, **Schaden nicht
beziffert** · **Blockiert auf:** Datenbank- und Stripe-Auswertung

---

## Was bekannt ist

**Andy sagt: die Lücke wurde ausgenutzt.** Mehr liegt bis jetzt nicht vor —
keine Zahl, kein Zeitraum, keine Beträge, kein Hinweis darauf, wie es
aufgefallen ist.

Alles Weitere in diesem Dokument ist **aus dem Code erhoben**, nicht aus
Beobachtungen. Es sagt, **wo** man nachsehen muss und **womit** — nicht, was
dort stehen wird.

> ⚠️ **Nichts hiervon ist eine Schadensschätzung.** Solange die Abfragen unten
> nicht gelaufen sind, ist jede Zahl geraten.

---

## Die Lücke

`stripe-checkout` und `stripe-paymentlink` übernahmen **Betrag und Währung**
unbesehen aus dem Request-Body des Browsers:

```ts
const { bookingId, bookingRef, amount, currency = 'thb', … } = body;
…
unit_amount: Math.round(amount * 100)
```

**Keine** der beiden las den Buchungssatz, bevor sie den Betrag an Stripe gab.
Wer die Anfrage im Browser abfing — Entwicklerwerkzeuge, ein Proxy, ein
`curl`-Aufruf gegen die öffentliche Function-URL — konnte jeden Betrag
einsetzen. Der Webhook bestätigte die Buchung anschließend als `paid`, weil er
nur auf das Stripe-Ereignis schaut und den Betrag nie gegenprüft.

**Ein Zugang war dafür nicht nötig.** Die Functions sind öffentlich erreichbar,
und eine Buchung lässt sich als Gast anlegen (`create_booking` ist für `anon`
freigegeben).

### Zeitfenster

| | |
|---|---|
| **Beginn** | **2026-06-27** — erster Deploy dieser Functions |
| **Ende** | **2026-07-27, 05:59:40 UTC** — Deploy des Fixes (`stripe-checkout` v7, `stripe-paymentlink` v10) |

Der Beginn ist belegt, nicht geschätzt: Die älteren Fassungen unter
`~/rentme/supabase/functions/` (28. Juni) haben **denselben** Fehler —
`unit_amount: Math.round(amount * 100)` mit `amount` aus dem Body. Es gab also
keine Fassung dieser Functions ohne die Lücke. **Rund vier Wochen.**

---

## Drei Angriffswege — und was davon in der Datenbank steht

Das ist der Punkt, an dem die Auswertung scheitern kann, wenn man ihn
übersieht:

### Weg A — `amount` im Aufruf an die Function verbiegen

Die Buchung wird ganz normal angelegt (`total_price` **korrekt**), erst der
Aufruf an `stripe-checkout` bzw. `stripe-paymentlink` trägt einen kleineren
Betrag.

> 🔴 **In der Datenbank ist das unsichtbar.** Der Buchungssatz sieht in jeder
> Spalte richtig aus: richtiger Preis, Status `paid`, `paid_at` gesetzt. Die
> Tabelle speichert **nirgends**, welcher Betrag tatsächlich eingezogen wurde.
>
> **Weg A findet man ausschließlich über Stripe** — Abfrage 2 unten.

### Weg B — `total_price` schon beim Anlegen fälschen

Die RPC `create_booking` läuft `SECURITY DEFINER`, ist für `anon` freigegeben
und übernimmt `payload->>'total_price'` wortwörtlich. Wer dort einen kleinen
Preis einträgt, bekommt danach einen dazu passenden Stripe-Betrag.

**Das ist in der Datenbank sichtbar** — der Preis passt dann nicht mehr zum
gebuchten Umfang (Dauer, Miettage, Geräte). Abfrage 1 findet es.

### Weg C — die Währung tauschen

`currency` kam ebenfalls aus dem Body. 800 in einer schwachen Währung sind
keine 800 THB.

> ⚠️ **Auch das steht nicht in der Datenbank.** Die Spalte
> `bookings.currency` hat den Vorgabewert `'THB'` und wurde von **keiner** der
> Functions je beschrieben. Sie zeigt für jede Buchung `THB`, unabhängig davon,
> was Stripe bekommen hat. **Nur der Stripe-Export beantwortet das.**

---

## Der Schaden hat zwei Richtungen

**1. Entgangenes Geld.** Die Differenz zwischen dem, was hätte eingezogen
werden müssen, und dem, was Stripe tatsächlich eingezogen hat.

**2. Blockierte Termine — und der läuft weiter.** Eine unterbezahlte Buchung
steht als `paid` in der Tabelle. Die View `availability` blendet damit den
Zeitraum aus:

```sql
WHERE status <> 'cancelled'
  AND booking_status IN ('confirmed', 'cash_on_pickup', 'paid')
```

**Der Platz ist für echte Gäste gesperrt** — bis heute, für jeden Termin, der
noch in der Zukunft liegt. Das kostet unabhängig vom entgangenen Geld, und es
hört nicht von selbst auf.

**3. Kollateralschaden an anderen Gästen.** Sobald der Webhook eine Zahlung
bestätigt, ruft er `cancel_competing_pending_bookings` auf. Diese Funktion
setzt **jede** überlappende Buchung im Status `pending_payment` auf
`cancelled` / `expired`. Eine Ein-Baht-Zahlung hat also möglicherweise
**echten Gästen mitten im Bezahlvorgang die Buchung weggenommen**. Diese Leute
haben eine Absage bekommen und wissen bis heute nicht, warum. Abfrage 4.

---

## Die Abfragen

**Alle vier sind reine `SELECT`s — sie ändern nichts.** Am einfachsten im
Supabase-Dashboard → *SQL Editor*; dort braucht es weder `psql` noch ein
Passwort.

> ⚠️ **Sie sind gegen das Schema geschrieben, nicht gegen die Datenbank
> gelaufen.** Von hier aus gab es keinen Zugang. Spalten- und Funktionsnamen
> stammen aus `supabase-setup.sql` und `stripe-migration.sql`; wenn am Schema
> seither von Hand etwas geändert wurde, kann eine Abfrage mit einem
> Spaltenfehler abbrechen. Das ist dann ein Tippfehler, kein Befund.

Alle setzen den folgenden Kopf voraus. Er rechnet den Sollpreis genauso wie
`supabase/functions/_shared/preise.ts` — **wer dort eine Zahl ändert, ändert
sie hier mit.**

```sql
-- ── KOPF: Sollpreis aus dem reservierten Umfang ──────────────────────────
WITH b AS (
  SELECT
    x.*,
    CASE
      WHEN x.equipment_start_date IS NOT NULL
       AND x.equipment_end_date   IS NOT NULL
      THEN (x.equipment_end_date - x.equipment_start_date) + 1
    END AS miettage
  FROM bookings x
),
geraete AS (
  SELECT
    b.id,
    SUM(CASE t WHEN 'pocket3' THEN 500
               WHEN 'neo'     THEN 700
               WHEN 'nano'    THEN 500 END)::numeric AS tagessatz,
    bool_and(t IN ('pocket3','neo','nano'))          AS alle_bekannt
  FROM b
  CROSS JOIN LATERAL unnest(COALESCE(b.equipment_items, '{}'::text[])) AS t
  GROUP BY b.id
),
soll AS (
  SELECT
    b.*,
    CASE
      WHEN b.service_type = 'studio_rental'
       AND b.duration_hours BETWEEN 1 AND 12
        THEN 200::numeric * b.duration_hours

      WHEN b.service_type = 'podcast'
       AND b.service_subtype = 'editing_only'
       AND b.duration_hours BETWEEN 1 AND 12
        THEN 1000::numeric * b.duration_hours

      WHEN b.service_type = 'podcast'
       AND b.service_subtype IN ('podcast_recording','podcast_editing')
       AND b.duration_hours BETWEEN 1 AND 12
        THEN 200::numeric * b.duration_hours + 1000

      WHEN b.service_type = 'equipment'
       AND g.alle_bekannt
       AND b.miettage BETWEEN 1 AND 90
        THEN round(g.tagessatz * b.miettage
                   * CASE WHEN b.miettage >= 3 THEN 0.9 ELSE 1 END)

      -- podcast_setup, drone, reel und alles Lueckenhafte: bewusst NULL.
      -- Nicht nachrechenbar heisst nicht unauffaellig -- siehe Abfrage 3.
      ELSE NULL
    END AS preis_soll
  FROM b
  LEFT JOIN geraete g ON g.id = b.id
)
```

### Abfrage 1 — Preis passt nicht zum gebuchten Umfang (findet Weg B)

```sql
SELECT booking_ref, created_at, service_type, service_subtype,
       duration_hours, equipment_items, miettage,
       total_price, preis_soll,
       preis_soll - total_price AS fehlbetrag,
       booking_status, payment_status, paid_at,
       stripe_payment_intent, stripe_session_id
FROM soll
WHERE preis_soll IS NOT NULL
  AND total_price IS DISTINCT FROM preis_soll
ORDER BY (preis_soll - total_price) DESC NULLS LAST;
```

**Lesehilfe:** Ein positiver `fehlbetrag` heißt zu wenig berechnet. Treffer mit
kleinem Betrag können auch alte Preisstände sein — dann steht ein **runder**
Unterschied über viele Buchungen hinweg. Ein Angriff sieht anders aus:
einzelne Buchungen mit absurd niedrigem `total_price` (1, 10, 20).

### Abfrage 2 — die Abgleichliste für Stripe (findet Weg A und C)

**Das ist die wichtige.** Weg A ist in der Datenbank unsichtbar; erst der
Abgleich mit Stripe zeigt ihn.

```sql
SELECT booking_ref,
       paid_at,
       service_type,
       total_price,
       preis_soll,
       CASE WHEN service_type = 'podcast_setup' THEN 1000::numeric
            ELSE COALESCE(preis_soll, total_price)
       END AS soll_eingezogen,
       payment_method,
       stripe_payment_intent,
       stripe_session_id
FROM soll
WHERE booking_status = 'paid' OR payment_status = 'paid'
ORDER BY paid_at;
```

**Dazu aus Stripe:** *Dashboard → Payments → Export* (CSV) für den Zeitraum
**2026-06-27 bis 2026-07-27**. Gebraucht werden die Spalten `id`, `amount`,
`currency`, `created`, `status` sowie `metadata.booking_id` /
`metadata.booking_ref` — beide Functions haben die Buchung von Anfang an in
die Metadaten geschrieben, der Abgleich geht also ohne Raten.

**Verglichen wird:** `amount / 100` gegen `soll_eingezogen`, und `currency`
gegen `thb`. Jede Zeile, bei der das auseinandergeht, ist ein Treffer.

> Wer schnell einen ersten Eindruck will: Im Stripe-Export nach `amount`
> aufsteigend sortieren. **Alles unter ฿200 ist verdächtig** — das ist der
> niedrigste reguläre Preis (eine Stunde Studio). Die einzige zulässige
> Ausnahme sind ฿1.000-Zahlungen zu `podcast_setup` (Anzahlung).

### Abfrage 3 — läuft noch Schaden? (gesperrte Termine)

```sql
SELECT booking_ref, guest_name, guest_email,
       service_type, booking_date, start_time, end_time,
       equipment_start_date, equipment_end_date, equipment_items,
       total_price, preis_soll, booking_status, paid_at
FROM soll
WHERE status <> 'cancelled'
  AND booking_status IN ('confirmed', 'cash_on_pickup', 'paid')
  AND (booking_date >= CURRENT_DATE
       OR equipment_end_date >= CURRENT_DATE)
  AND (preis_soll IS NULL
       OR total_price IS DISTINCT FROM preis_soll)
ORDER BY COALESCE(booking_date, equipment_start_date);
```

Das sind die Buchungen, die **heute noch** einen Platz belegen und deren Preis
entweder nicht stimmt oder sich nicht nachrechnen lässt. Jede davon gehört
angesehen, bevor sie storniert wird — `preis_soll IS NULL` heißt „nicht
nachrechenbar", **nicht** „betrügerisch": `podcast_setup` und die
Drohnen-Anfragen landen hier regulär.

### Abfrage 4 — wem wurde die Buchung weggenommen?

```sql
SELECT o.booking_ref, o.guest_name, o.guest_email, o.guest_phone,
       o.service_type, o.booking_date, o.start_time, o.end_time,
       o.total_price,
       o.updated_at            AS abgesagt_am,
       o.reservation_expires_at AS frist_lief_bis
FROM bookings o
WHERE o.booking_status = 'cancelled'
  AND o.payment_status = 'expired'
  AND o.reservation_expires_at IS NOT NULL
  AND o.updated_at < o.reservation_expires_at
ORDER BY o.updated_at DESC;
```

**Warum das die Verdrängten findet:** Läuft eine Reservierung normal ab,
erledigt das `expire_pending_bookings()` — **nach** Ablauf der Frist. Wird sie
dagegen von `cancel_competing_pending_bookings` gekippt, geschieht das im
Moment einer fremden Zahlung, also **vor** der Frist. Genau darauf zielt
`updated_at < reservation_expires_at`.

Beide Funktionen setzen dieselben Statuswerte — an den Status allein sind sie
nicht zu unterscheiden. **Der Zeitvergleich ist der einzige Hinweis**, und er
ist ein Indiz, kein Beweis.

Wer hier steht, hat eine Absage bekommen und weiß nicht, warum. Falls sich der
Verdacht bestätigt, gehört diesen Gästen eine Nachricht.

---

## Was Andy beibringen muss

| Gebraucht | Wofür | Einfachster Weg |
|---|---|---|
| **Datenbank-Zugang** | Abfragen 1, 3, 4 | Supabase-Dashboard → **SQL Editor**. Kein Passwort, kein `psql` nötig. |
| **Stripe-Export** | Abfrage 2 — und nur dort sind Weg A und C sichtbar | Stripe-Dashboard → *Payments* → *Export*, 2026-06-27 bis 2026-07-27, mit Metadaten-Spalten |

**Warum das hier nicht selbst erledigt wurde:** In
`supabase/.temp/pooler-url` steht kein Passwort, `psql` ist auf dem Rechner
nicht installiert, und Aufrufe an Stripe sind gesperrt. Der Weg über das
Dashboard braucht keines von beidem.

**Reihenfolge:** Erst Abfrage 3 (laufender Schaden, dringend), dann 2
(Bezifferung), dann 1 und 4.

---

## Was schon geschlossen ist

- **Die Lücke selbst** — seit 2026-07-27 05:59:40 UTC. Betrag und Währung
  kommen serverseitig aus `preise.ts`; `amount` und `currency` aus dem Body
  werden nicht mehr benutzt (R-010).
- **Rückfall ausgeschlossen** — `tools/pruefe.py` meldet unter der Art
  `BETRAG`, sobald ein Betrag oder eine Währung an Stripe nicht aus der
  Preisquelle stammt. An eingebauten Fehlern nachgewiesen.
- **Ein Wiederauftreten wäre sichtbar:** Weicht der vom Browser gemeldete
  Betrag ab, schreibt die Function eine Warnung ins Protokoll
  (`Betragsabweichung bei <id>`). Das ist die Spur, die vorher gefehlt hat.

## Was ausdrücklich **nicht** geschlossen ist

- **Der Webhook prüft den Betrag weiterhin nicht.** Er bestätigt jede Zahlung
  als `paid`, ohne zu vergleichen, ob die Summe zur Buchung passt. Solange
  beide Zahlungswege serverseitig rechnen, ist das nicht ausnutzbar — aber es
  ist die zweite Verteidigungslinie, die es nie gab. Gehört zu T-7.
- **`create_booking` nimmt `total_price` weiterhin aus dem Browser.** Das ist
  jetzt folgenlos für den Einzug (der Betrag wird ohnehin neu gerechnet), aber
  die Verwaltung zeigt den Wert an. Sauber wäre, die Spalte serverseitig zu
  füllen oder ganz zu streichen.
