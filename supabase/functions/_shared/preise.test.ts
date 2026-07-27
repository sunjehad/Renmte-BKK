// Pruefung der serverseitigen Preisquelle.
//
// Aufruf (Node 22+, TypeScript wird ohne Uebersetzungsschritt ausgefuehrt):
//
//     node --test supabase/functions/_shared/preise.test.ts
//
// oder mit allem anderen zusammen:
//
//     python3 tools/pruefe.py
//
// Der Kern dieser Datei ist der Abschnitt "Manipulierter Betrag". Alles andere
// haelt die Preistafel fest, damit eine Aenderung an ihr auffaellt.

import test from "node:test";
import assert from "node:assert/strict";

import {
  ermittleBetrag,
  GERAETE_TAGESSATZ,
  HOECHSTBETRAG,
  miettage,
  PODCAST_SETUP_ANZAHLUNG,
  pruefeGemeldetenBetrag,
} from "./preise.ts";

/** Kuerzt die Testfaelle ab: liefert den Betrag oder wirft mit dem Grund. */
function betrag(buchung: Parameters<typeof ermittleBetrag>[0]): number {
  const e = ermittleBetrag(buchung);
  if (!e.ok) throw new Error(`unerwartet abgelehnt: ${e.code} -- ${e.grund}`);
  return e.betrag;
}

/** Liefert den Ablehnungsgrund oder wirft, wenn nicht abgelehnt wurde. */
function ablehnung(buchung: Parameters<typeof ermittleBetrag>[0]): string {
  const e = ermittleBetrag(buchung);
  if (e.ok) {
    throw new Error(`haette abgelehnt werden muessen, ergab ${e.betrag} THB`);
  }
  return e.code;
}

// ═══════════════════════════════════════════════════════════════════════════
// Manipulierter Betrag -- der Grund, warum es diese Datei gibt (T-1)
// ═══════════════════════════════════════════════════════════════════════════

test("manipulierter Betrag: der Browser-Wert wird ignoriert", () => {
  // Vier Stunden Studio = 800 THB. Der Angreifer meldet 1 THB.
  const buchung = { service_type: "studio_rental", duration_hours: 4 };

  const { ergebnis, abweichung } = pruefeGemeldetenBetrag(buchung, 1);

  assert.equal(ergebnis.ok, true);
  assert.equal(ergebnis.ok && ergebnis.betrag, 800);
  assert.match(abweichung ?? "", /Es gilt der errechnete Betrag/);
});

test("manipulierter Betrag: auch 0 und negative Werte ziehen nicht", () => {
  const buchung = { service_type: "studio_rental", duration_hours: 2 };
  for (const versuch of [0, -5, 0.01, 1e-9]) {
    const { ergebnis } = pruefeGemeldetenBetrag(buchung, versuch);
    assert.equal(ergebnis.ok && ergebnis.betrag, 400, `bei ${versuch}`);
  }
});

test("manipulierter Betrag: auch ein zu HOHER Wert zieht nicht", () => {
  // Nicht nur der Betrug am Betreiber zaehlt -- ein ueberhoehter Einzug beim
  // Kunden waere genauso falsch.
  const buchung = { service_type: "equipment", equipment_items: ["neo"],
    equipment_start_date: "2026-08-01", equipment_end_date: "2026-08-01" };
  const { ergebnis } = pruefeGemeldetenBetrag(buchung, 999999);
  assert.equal(ergebnis.ok && ergebnis.betrag, 700);
});

test("manipulierter Betrag: gefaelschtes total_price bleibt wirkungslos", () => {
  // `total_price` steht in der Datenbank, ist aber ueber die RPC
  // `create_booking` genauso vom Browser gesetzt. Die Preisquelle darf das
  // Feld deshalb nicht einmal ansehen.
  const echt = { service_type: "studio_rental", duration_hours: 8 };
  const gefaelscht = { ...echt, total_price: 1 } as typeof echt;
  assert.equal(betrag(gefaelscht), betrag(echt));
  assert.equal(betrag(gefaelscht), 1600);
});

test("manipulierter Betrag: gefaelschte rental_days bleiben wirkungslos", () => {
  // Der Preis haengt am gesperrten Zeitraum, nicht an der mitgeschickten
  // Tageszahl.
  const buchung = {
    service_type: "equipment",
    equipment_items: ["pocket3"],
    equipment_start_date: "2026-08-01",
    equipment_end_date: "2026-08-05",   // 5 Tage
    rental_days: 1,                      // Luege
  } as Parameters<typeof ermittleBetrag>[0];
  // 500 x 5 Tage, ab 3 Tagen 10 % Rabatt = 2250
  assert.equal(betrag(buchung), 2250);
});

// ═══════════════════════════════════════════════════════════════════════════
// Fail-closed: was nicht sicher berechenbar ist, wird abgelehnt
// ═══════════════════════════════════════════════════════════════════════════

test("fail-closed: Drohne hat keinen Preis und wird abgelehnt", () => {
  assert.equal(
    ablehnung({ service_type: "drone", service_subtype: "premium" }),
    "KEINE_ZAHLUNG_VORGESEHEN",
  );
});

test("fail-closed: unbekannter Dienst wird abgelehnt", () => {
  assert.equal(ablehnung({ service_type: "helikopter" }), "DIENST_UNBEKANNT");
  assert.equal(ablehnung({ service_type: "" }), "DIENST_UNBEKANNT");
  assert.equal(ablehnung({}), "DIENST_UNBEKANNT");
});

test("fail-closed: unbekanntes Geraet wird abgelehnt", () => {
  assert.equal(
    ablehnung({
      service_type: "equipment",
      equipment_items: ["pocket3", "goldbarren"],
      equipment_start_date: "2026-08-01",
      equipment_end_date: "2026-08-02",
    }),
    "GERAET_UNBEKANNT",
  );
});

test("fail-closed: geerbte Eigenschaften gelten nicht als Geraet", () => {
  // `'constructor' in GERAETE_TAGESSATZ` waere `true` -- deshalb steht dort
  // hasOwnProperty.
  assert.equal(
    ablehnung({
      service_type: "equipment",
      equipment_items: ["constructor"],
      equipment_start_date: "2026-08-01",
      equipment_end_date: "2026-08-02",
    }),
    "GERAET_UNBEKANNT",
  );
});

test("fail-closed: fehlende oder unsinnige Dauer wird abgelehnt", () => {
  for (const dauer of [null, undefined, 0, -3, 2.5, 13, "4"]) {
    assert.equal(
      ablehnung({ service_type: "studio_rental", duration_hours: dauer as never }),
      "ANGABEN_UNVOLLSTAENDIG",
      `bei Dauer ${JSON.stringify(dauer)}`,
    );
  }
});

test("fail-closed: verdrehter Mietzeitraum wird abgelehnt", () => {
  assert.equal(
    ablehnung({
      service_type: "equipment",
      equipment_items: ["neo"],
      equipment_start_date: "2026-08-10",
      equipment_end_date: "2026-08-01",
    }),
    "ANGABEN_UNVOLLSTAENDIG",
  );
});

test("fail-closed: Geraetemiete ohne Geraete wird abgelehnt", () => {
  assert.equal(
    ablehnung({
      service_type: "equipment",
      equipment_items: [],
      equipment_start_date: "2026-08-01",
      equipment_end_date: "2026-08-02",
    }),
    "ANGABEN_UNVOLLSTAENDIG",
  );
});

test("fail-closed: Reel ist serverseitig nicht nachrechenbar", () => {
  assert.equal(ablehnung({ service_type: "reel" }), "KEIN_PREIS_HINTERLEGT");
});

test("fail-closed: bereits bezahlte Buchung bekommt keinen zweiten Zahlweg", () => {
  assert.equal(
    ablehnung({
      service_type: "studio_rental",
      duration_hours: 2,
      payment_status: "paid",
    }),
    "SCHON_BEZAHLT",
  );
});

test("fail-closed: Obergrenze greift", () => {
  const tage = Math.ceil(HOECHSTBETRAG / GERAETE_TAGESSATZ.neo) + 10;
  const bis = new Date(Date.UTC(2026, 7, 1) + (tage - 1) * 86400000)
    .toISOString()
    .slice(0, 10);
  assert.equal(
    ablehnung({
      service_type: "equipment",
      equipment_items: ["neo"],
      equipment_start_date: "2026-08-01",
      equipment_end_date: bis,
    }),
    "ANGABEN_UNVOLLSTAENDIG", // greift schon an MAX_MIETTAGE -- auch recht
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// Die Preistafel -- muss zu booking.html passen (docs/todo.md T-8)
// ═══════════════════════════════════════════════════════════════════════════

test("Studio: 200 THB je Stunde", () => {
  assert.equal(betrag({ service_type: "studio_rental", duration_hours: 1 }), 200);
  assert.equal(betrag({ service_type: "studio_rental", duration_hours: 8 }), 1600);
});

test("Podcast-Aufnahme: 200 THB/h + 1000 THB Aufbau", () => {
  assert.equal(
    betrag({
      service_type: "podcast",
      service_subtype: "podcast_recording",
      duration_hours: 2,
    }),
    1400,
  );
  assert.equal(
    betrag({
      service_type: "podcast",
      service_subtype: "podcast_editing",
      duration_hours: 4,
    }),
    1800,
  );
});

test("Podcast, reiner Schnitt: 1000 THB je Folge", () => {
  assert.equal(
    betrag({
      service_type: "podcast",
      service_subtype: "editing_only",
      duration_hours: 3,
    }),
    3000,
  );
});

test("Podcast-Setup: feste Anzahlung, unabhaengig von der Ausstattung", () => {
  // Kameraanzahl, Videograf und Reel-Zusatz stehen nur in `notes`. Der
  // eingezogene Betrag ist trotzdem eindeutig, weil er fest ist.
  assert.equal(
    betrag({ service_type: "podcast_setup", duration_hours: 8 }),
    PODCAST_SETUP_ANZAHLUNG,
  );
  assert.equal(
    betrag({ service_type: "podcast_setup" }),
    PODCAST_SETUP_ANZAHLUNG,
  );
});

test("Geraete: Tagessatz mal Tage, ab 3 Tagen 10 Prozent Rabatt", () => {
  const zeitraum = (von: string, bis: string) => ({
    service_type: "equipment",
    equipment_items: ["pocket3", "neo"],   // 500 + 700 = 1200/Tag
    equipment_start_date: von,
    equipment_end_date: bis,
  });
  assert.equal(betrag(zeitraum("2026-08-01", "2026-08-01")), 1200);
  assert.equal(betrag(zeitraum("2026-08-01", "2026-08-02")), 2400);
  // 3 Tage: 1200 x 3 x 0,9 = 3240
  assert.equal(betrag(zeitraum("2026-08-01", "2026-08-03")), 3240);
});

test("Miettage zaehlen beide Randtage und ueberstehen Zeitumstellungen", () => {
  assert.equal(miettage("2026-08-01", "2026-08-01"), 1);
  assert.equal(miettage("2026-08-01", "2026-08-03"), 3);
  // Ende der europaeischen Sommerzeit -- mit lokaler Zeitrechnung waere hier
  // 2,958... herausgekommen und nach dem Runden zufaellig richtig gewesen.
  assert.equal(miettage("2026-10-24", "2026-10-26"), 3);
  assert.equal(miettage("kein-datum", "2026-08-01"), null);
});
