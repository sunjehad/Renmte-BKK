# AGENT_RULES — RentMe Bangkok

> Diese Regeln haben Vorrang vor allem anderen in diesem Repo.
> Vor jeder Aufgabe zuerst `CLAUDE.md`, `docs/context.md`, `docs/deploy.md`
> und `docs/decisions.md` lesen.

## Die Regel, die alles andere überwiegt

> **Dieses Projekt nimmt echtes Geld von echten Kunden entgegen.**

Es gibt keine Testumgebung. Kein Staging, kein Stripe-Testmodus, keine zweite
Supabase-Instanz. Die Schlüssel im Frontend sind **Live-Schlüssel**
(`pk_live_…`), und die Seite läuft lokal gegen dieselbe Datenbank wie die
öffentliche Fassung.

Daraus folgt alles Weitere.

## Niemals ohne ausdrückliche Freigabe

- **Kein `git push`.** ⚠️ **`git push` IST der Deploy** — Vercel hängt am Repo
  `github.com/sunjehad/Renmte-BKK` und spielt jeden Push auf `main`
  automatisch auf `www.rentme-bkk.com` aus (geklärt 2026-07-27,
  `docs/deploy.md`). Es gibt keinen Schritt dazwischen. Wer hier pusht,
  veröffentlicht — auch versehentlich.
  Der Remote selbst ist richtig: Sun ist Eigentümer, Andy ist Manager. Die
  Freigabe gilt trotzdem **je Vorgang**, nicht ein für alle Mal.
- **Kein `supabase functions deploy`.**
- **Keine SQL-Migration ausführen.** Die `.sql`-Dateien sind Dokumentation
  dessen, was einmal ausgeführt wurde; sie erneut laufen zu lassen ist kein
  harmloser Vorgang.
- **Keine Stripe- oder Supabase-Aufrufe**, die etwas verändern. Lesen zum
  Nachsehen ist etwas anderes als Schreiben — im Zweifel fragen.
- **Keine Buchung anlegen, ändern oder stornieren**, auch nicht „zum Testen".

## Beim Arbeiten am Code

- **Die richtige Kopie erwischen.** Die Stripe-Functions existieren dreifach
  (`docs/deploy.md`). Maßgeblich ist **immer** `supabase/functions/` in diesem
  Repo. Die Kopien unter `~/rentme/` sind älter und dürfen nicht bearbeitet
  werden.
- **Keine Sicherungskopien neben Git.** Git ist die Versionierung
  (`docs/decisions.md` R-004).
- **Nichts raten, was nachsehbar ist.** Preise, Feldnamen und Abläufe stehen im
  Code oder im Schema.
- Englische UI-Texte (die Kundschaft ist international), deutsche Kommentare und
  Dokumentation.

## Vor jeder Änderung: prüfen

**Andys Auflage vom 2026-07-27:** `booking.html` wird nur angefasst, wenn danach
sicher ist, dass die Website noch funktioniert. Das Verfahren dafür steht in
**`docs/pruefen.md`** und ist Pflicht, nicht Empfehlung:

```bash
python3 tools/pruefe.py     # Schritt 1 -- Exit 0, sonst nicht weiter
python3 serve.py            # Schritt 2 -- Seite laden, Konsole muss leer sein
```

**Beim Durchklicken bis Schritt 4 („Confirm") gehen und dort aufhören.** Die
lokale Seite spricht mit der **echten** Datenbank und den **echten**
Stripe-Live-Schlüsseln; ein abgeschlossener Testdurchlauf ist eine echte
Buchung und eine echte Zahlung.

Änderungen an `booking.html` sind besonders heikel — 2.254 Zeilen mit
eingebettetem Zustand (`state`), Zahlungspfaden und Supabase-Aufrufen. Klein
schneiden, nach **jedem** Schnitt Schritt 1 laufen lassen.
