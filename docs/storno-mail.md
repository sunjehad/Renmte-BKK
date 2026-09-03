# Die Storno-Mail

**Erstellt:** 2026-09-03 · Anlass: die Absage von RMB-A95926BE (Aleksandra
Barkova, 4. September) musste von Hand geschrieben werden, weil das Panel
keine verschickt.

---

## Was das Panel bisher tat: nichts sagen

`admin.html` verschickte **keine einzige E-Mail**. Cancel, Refund und Release
haben den Status in der Datenbank gesetzt und damit war der Vorgang zu Ende.
Der Kunde stand am nächsten Tag vor der Tür, wenn niemand daran dachte, ihm
von Hand zu schreiben.

Seit dem 3. September verschickt das Storno-Fenster eine Mail — über
**dieselbe Straße wie die Bestätigung**: dasselbe EmailJS-Konto, derselbe
Dienst `service_jwnx06q`, derselbe Absender. Nur die Vorlage ist eine andere.

## ⚠️ Der eine Schritt, der noch offen ist

> Die Vorlage gibt es noch nicht.

Wie alle Textbausteine liegt sie **im EmailJS-Konto**, nicht im Code. Bis sie
angelegt ist, sagt das Storno-Fenster ausdrücklich *„No cancellation template
set up in EmailJS yet"*, storniert die Buchung und verschickt **nichts**.
Kein stiller Fehlschlag — derselbe Grundsatz wie beim Dropbox-Link in
`booking.html`.

### So wird sie angelegt

1. Bei **emailjs.com** anmelden (Konto `rentmebkk@gmail.com`).
2. Die bestehende Kundenvorlage **`template_n7rkhjd`** öffnen und
   **duplizieren**. Damit bleibt die Gestaltung dieselbe wie bei der
   Bestätigung — genau das ist gewollt.
3. Die Kopie umbenennen, z. B. `customer_cancellation`.
4. Betreff und Text durch die Blöcke weiter unten ersetzen.
5. Die neue **Template-ID** kopieren (Form `template_xxxxxxx`).
6. In `admin.html` eintragen:

   ```js
   const EMAILJS_CANCEL_TEMPLATE = 'template_xxxxxxx';
   ```

   Die Zeile steht im Block „STORNO-MAIL (EmailJS)", direkt über dem
   Supabase-Client. Solange dort der Platzhalter steht, geht nichts raus.
7. `git push` — das **ist** der Deploy (siehe `deploy.md`).

## Die Felder, die die Vorlage ausgeben muss

Kommen aus `sendeStornoMail()` in `admin.html`. Was die Vorlage nicht ausgibt,
kommt beim Kunden nicht an:

| Feld | Inhalt |
|---|---|
| `booking_ref` | RMB-A95926BE |
| `customer_name` | Aleksandra Barkova |
| `customer_email` | die Adresse des Kunden |
| `service` | Studio Rental (die Bezeichnung, nicht der rohe Wert) |
| `booking_date` | 4 Sept 2026 (schon lesbar gesetzt) |
| `start_time` | 15:00 |
| `storno_grund` | der im Fenster gewählte Grund, ganzer Satz |
| `geld_text` | Erstattung, Wahl zwischen Erstattung und Guthaben, oder leer |
| `betrag` | THB 400 |

`storno_grund` und `geld_text` sind **fertige Sätze**, keine Schlüsselwörter.
Die Vorlage setzt sie unverändert ein. `geld_text` kann leer sein — dann darf
kein leerer Absatz mit Überschrift stehen bleiben.

## Betreff

```
We have to cancel your booking on {{booking_date}} — {{booking_ref}}
```

## Text

```
Hi {{customer_name}},

I'm very sorry — we have to cancel your booking.

  {{service}}
  {{booking_date}} at {{start_time}}
  Booking reference: {{booking_ref}}
  Total: {{betrag}}

{{storno_grund}}

{{geld_text}}

If there is anything I can do, just reply to this email.

Sorry again, and thank you for your understanding.

RentMe Bangkok
51 Kamphaeng Phet 7 Rd, Makkasan, Ratchathewi, Bangkok 10400
```

## Die Kopie an uns

Das Panel schickt dieselben Felder zusätzlich an die Betreibervorlage
`template_thqicqi` (dieselbe, die bei einer neuen Buchung anschlägt). Ein
Storno sieht dort deshalb zunächst aus wie eine Buchung. Wer das getrennt
haben will, legt eine zweite Betreibervorlage an und trägt sie als
`EMAILJS_ADMIN_TEMPLATE` in `admin.html` ein — **nur dort**, nicht in
`booking.html`, sonst ändert sich auch die Buchungsmeldung.

## Was die Mail nicht kann

Sie bewegt **kein Geld**. Der Refund-Knopf setzt weiterhin nur den Status,
Stripe wird nicht angerufen — der Dialog sagt das auch. Wer „volle Erstattung"
ankündigt, muss sie selbst auslösen. Ob eine PromptPay-Zahlung über das
Stripe-Dashboard erstattbar ist oder als Überweisung von Hand laufen muss,
ist **ungeklärt** (offene Frage EA-RM-12 im Projekt-Gehirn).
