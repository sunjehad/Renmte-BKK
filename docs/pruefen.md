# Prüfen vor dem Ausspielen

**Warum es diese Seite gibt:** Die Website ist im Betrieb und nimmt echtes Geld
entgegen. Es gibt keine Testumgebung, kein Staging, keinen Build-Schritt — nichts,
was einen Fehler abfängt, bevor eine Kundin ihn merkt. Bis das anders ist, ersetzt
dieses Verfahren das fehlende Netz.

> **Reihenfolge einhalten. Schritt 1 ist billig und findet die Fehler, die eine
> Seite still lahmlegen. Schritt 2 findet, was nur zur Laufzeit sichtbar wird.**

---

## Schritt 1 — Statische Prüfung (Sekunden)

```bash
cd ~/Desktop/rentme-bangkok
python3 tools/pruefe.py
```

Exit 0 heißt: keine neuen Befunde. Exit 1 heißt: **nicht ausspielen.**

Geprüft werden fünf Fehlerklassen, alle ohne die Seite auszuführen:

| Art | Was gefunden wird | Warum das zählt |
|---|---|---|
| `SYNTAX` | JavaScript-Syntaxfehler (über `node --check`) | Ein einziger legt den **ganzen** `<script>`-Block lahm. Die Seite sieht normal aus und tut nichts mehr. |
| `DOPPELT` | Derselbe Schlüssel zweimal im selben Objektliteral | Der letzte gewinnt, ohne Warnung. Genau dieser Fehler saß am 2026-07-27 in `booking.html` und schickte einen leeren Kundennamen an Stripe. |
| `ID` | `getElementById('x')` ohne `x`, Ergebnis ungeprüft benutzt | Der nächste Zugriff wirft, der Rest der Funktion läuft nie. |
| `TOT` | dasselbe, aber abgesichert (`if (el) …`) | Harmlos, aber toter Code — als Hinweis geführt. |
| `HANDLER` | `onclick="foo()"` ohne `foo` | Ein Knopf, der nichts tut. |
| `GEHEIM` | `sk_live`, `sk_test`, Service-Role-Schlüssel, JWT mit falscher Rolle | Ein geheimer Schlüssel im Frontend ist ein Notfall. Der Anon-Schlüssel (`role: anon`) wird erkannt und **nicht** gemeldet — er gehört dorthin. |
| `BETRAG` | Ein Betrag oder eine Währung geht an Stripe, ohne aus der serverseitigen Preisquelle zu stammen | Genau das war T-1: eine Zeile `unit_amount: Math.round(amount * 100)` — und die ganze Rechnerei daneben ist wertlos. |
| `PREISE` | Die 21 Tests der Preisquelle schlagen fehl | Hier hängt der Geldbetrag dran. Ein falscher Preis kommt sonst durch alle anderen Prüfungen sauber hindurch. |

### Auch die Stripe-Functions werden geprüft

Seit dem 2026-07-27 sieht `pruefe.py` nicht mehr nur auf die HTML-Seiten:

- **Syntax der Edge-Functions.** `node --check` kann kein TypeScript, deshalb
  wird über Nodes Type-Stripping geparst. Ausführen ginge nicht — die Dateien
  holen ihre Abhängigkeiten über URLs und brauchen Deno.
- **Die Preisquelle** (`supabase/functions/_shared/preise.ts`) wird mit
  `node --test` durchgerechnet. Node führt TypeScript direkt aus; es bleibt
  bei **null Abhängigkeiten** (R-001).

> Beides läuft nur beim Aufruf **ohne Argumente**. `pruefe.py booking.html`
> prüft weiterhin nur die eine Seite.

### Bekannte Befunde

`tools/bekannt.txt` führt geduldete Altlasten, damit die Prüfung nicht dauerhaft
rot steht und ignoriert wird. **Neue Befunde brechen weiterhin.** Wird einer
behoben, gehört sein Eintrag gelöscht.

Heute steht dort ein Posten: der unerreichbare Mini-Kalender in `index.html`
(`docs/todo.md` T-9).

### Nachgewiesen, dass die Prüfung greift

Am 2026-07-27 wurden drei Fehler künstlich eingebaut und alle drei gefunden:

```
booking.html:1884:DOPPELT:Schluessel 'customerName' doppelt im selben Objekt …
booking.html:875:SYNTAX:Skriptblock ab Zeile 875: SyntaxError: Unexpected identifier 'btn'
booking.html:1383:TOT:getElementById('editing-episode') -- kein Element mit dieser id
```

Für die neuen Prüfungen derselbe Nachweis, vier weitere eingebaute Fehler:

```
stripe-checkout/index.ts:94:BETRAG:Betrag an Stripe stammt nicht aus der serverseitigen Preisquelle …
stripe-checkout/index.ts:93:BETRAG:Waehrung an Stripe stammt nicht aus der festen Konstante WAEHRUNG
_shared/preise.test.ts:0:PREISE:fehlgeschlagen: 1 - manipulierter Betrag: der Browser-Wert wird ignoriert
_shared/preise.ts:0:SYNTAX:Unterminated string constant
```

Der dritte Fall ist der wichtigste: Er entstand dadurch, dass der
Stundensatz von 200 auf 20 gesetzt wurde — ein Preisfehler um eine
Zehnerstelle, den **vorher keine Prüfung dieses Projekts gefunden hätte.**

---

## Schritt 2 — Die Seite wirklich laden

```bash
cd ~/Desktop/rentme-bangkok
python3 serve.py &
open http://localhost:3456/index.html
```

Dann in **jeder** geänderten Seite:

1. Entwicklerwerkzeuge öffnen, **Konsole** ansehen. Sie muss **leer** sein.
   Jede rote Zeile ist ein Grund, nicht auszuspielen.
2. Neu laden und noch einmal hinsehen — die Konsole zeigt nur, was seit dem
   Öffnen passiert ist.

   > ⚠️ **Der Browser liefert gern die alte Fassung.** `serve.py` setzt keine
   > Cache-Regeln; eine geänderte Seite kann unverändert aussehen. Am
   > 2026-07-27 hat das eine neu eingebaute Karte „verschwinden" lassen — sie
   > stand im Quelltext, aber nicht im DOM. **Immer hart neu laden**
   > (`Cmd+Shift+R`) oder eine Zählnummer anhängen: `?v=2`.
3. Den geänderten Bereich anklicken und ansehen.

**Stand 2026-07-27 geprüft:** `index.html` und `booking.html` laden mit
**leerer Konsole**; Schritt 1 der Buchungsstrecke rendert vollständig
(alle drei Angebote mit Preisen).

### ⚠️ Wo Schritt 2 aufhört

> **Die lokale Seite spricht mit der ECHTEN Datenbank und den ECHTEN
> Stripe-Live-Schlüsseln.**

Es gibt keine getrennte Testumgebung. Wer die Buchungsstrecke lokal
durchklickt, legt eine **echte Buchung** an und kann eine **echte Zahlung**
auslösen.

**Deshalb: bis Schritt 4 („Confirm") klicken, dort aufhören.** Nicht bezahlen,
keine Buchung abschließen, auch nicht „nur kurz zum Testen".

Was damit ungeprüft bleibt: ob der richtige Betrag bei Stripe ankommt, ob der
Webhook die Buchung bestätigt, ob die Bestätigungsmail rausgeht. Das ist der
Preis dafür, dass es keine Testumgebung gibt — und der Grund, warum eine auf
der ToDo-Liste steht (`docs/todo.md` T-7).

---

## Schritt 3 — Ausspielen

**Nur mit Andys ausdrücklicher Freigabe** (`decisions.md` R-005). Vorher müssen
Schritt 1 und 2 sauber sein.

> ⚠️ **Es sind zwei Deploys, nicht einer.**
> `git push` spielt **nur das Frontend** aus (Vercel). Die Edge-Functions
> gehen ausschließlich über `supabase functions deploy` live. Wer nur pusht,
> hat an den Zahlungswegen nichts geändert — siehe `docs/deploy.md`.

Bei Änderungen an den Stripe-Functions kommt hinzu: **erst klären, was dort
überhaupt läuft** — siehe `docs/deploy.md`. Ein Deploy über einen ungeklärten
Stand ist geraten, nicht gewusst.

---

## Was dieses Verfahren nicht ersetzt

Es prüft, ob die Seite **funktioniert** — und seit dem 2026-07-27 auch, ob die
**Server**seite richtig rechnet. Nicht geprüft wird, ob `booking.html` dasselbe
rechnet: Die Preise stehen dort weiterhin doppelt (`docs/todo.md` T-8).

Ein Preisfehler **im Frontend** führt heute nicht mehr zu einem falschen
Einzug — eingezogen wird immer der serverseitig errechnete Betrag. Er führt
dazu, dass die Seite dem Gast eine andere Zahl anzeigt, als abgebucht wird,
und dass im Protokoll der Function eine Betragsabweichung steht. Falsch
informiert statt falsch abgerechnet: ärgerlich, aber nicht teuer — und im
Protokoll sichtbar.

Weiterhin ungeprüft: die **Webhook**-Function, die entscheidet, ob eine
Buchung als bezahlt gilt (`docs/todo.md` T-7).
