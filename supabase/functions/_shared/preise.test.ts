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
  // 5 Tage: 500 x 2 volle Tage + 300 x 3 weitere = 1900.
  // Die gemeldete 1 bleibt folgenlos.
  assert.equal(betrag(buchung), 1900);
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

test("fail-closed: Reel ohne bekannte Paketgroesse wird abgelehnt", () => {
  for (const art of ["reel", "reel_3", "reel_99", null, undefined]) {
    assert.equal(
      ablehnung({
        service_type: "reel",
        service_subtype: art as string | null | undefined,
      }),
      "ANGABEN_UNVOLLSTAENDIG",
      `unerwartet angenommen: ${JSON.stringify(art)}`,
    );
  }
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

test("Schnitt: erste Stunde voll, jede weitere zur Haelfte -- je Kameraanzahl", () => {
  const schnitt = (kameras: number, stunden: number) =>
    betrag({
      service_type: "podcast",
      service_subtype: `editing_only_${kameras}cam`,
      duration_hours: stunden,
    });

  // Die drei Promo-Saetze der Werbung, erste Stunde.
  assert.equal(schnitt(1, 1), 1500);
  assert.equal(schnitt(2, 1), 2000);
  assert.equal(schnitt(3, 1), 3000);

  // Jede weitere Stunde 50% des Promo-Satzes.
  assert.equal(schnitt(1, 2), 1500 + 750);
  assert.equal(schnitt(2, 3), 2000 + 2 * 1000);
  assert.equal(schnitt(3, 4), 3000 + 3 * 1500);

  // Und einmal weit aussen, damit die Staffel nicht irgendwo kippt.
  assert.equal(schnitt(1, 8), 1500 + 7 * 750);
});

test("Schnitt: ohne Kameraangabe wird abgelehnt, nicht geraten", () => {
  // Aufnahme laeuft seit dem 2026-07-28 ueber `podcast_setup`, und die
  // Kameraanzahl steckt in `service_subtype`. Fehlt sie oder steht dort eine
  // alte Unterart, darf die Preisquelle keinen Betrag erfinden.
  for (
    const art of [
      "podcast_recording",
      "podcast_editing",
      "editing_only", // die alte Form ohne Kameraangabe
      "editing_only_4cam", // Kameraanzahl gibt es nicht
      "editing_only_0cam",
      null,
      undefined,
    ]
  ) {
    assert.equal(
      ablehnung({
        service_type: "podcast",
        service_subtype: art as string | null | undefined,
        duration_hours: 2,
      }),
      "ANGABEN_UNVOLLSTAENDIG",
      `unerwartet angenommen: ${JSON.stringify(art)}`,
    );
  }
});

test("Full Podcast Service: Anfrage, kein Zahlbetrag", () => {
  // Die 19.000 THB auf der Seite sind eine Hausnummer. Wer die Function
  // trotzdem aufruft, bekommt keinen Betrag.
  assert.equal(
    ablehnung({ service_type: "full_podcast", duration_hours: 2 }),
    "KEINE_ZAHLUNG_VORGESEHEN",
  );
});

test("Podcast-Setup: die Anzahlung ist die Einrichtungsgebuehr (1500 THB)", () => {
  // Nagelt die Zahl selbst fest, nicht nur die Konstante -- sonst zoege ein
  // Vertipper in `preise.ts` den Test stillschweigend mit.
  assert.equal(PODCAST_SETUP_ANZAHLUNG, 1500);
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

test("Geraete: erste zwei Tage voll, jeder weitere zum Zusatzsatz", () => {
  const miete = (teile: string[], von: string, bis: string) =>
    betrag({
      service_type: "equipment",
      equipment_items: teile,
      equipment_start_date: von,
      equipment_end_date: bis,
    });
  const tage = (n: number) => `2026-08-${String(n).padStart(2, "0")}`;

  // Pocket 3: 500 fuer die ersten zwei Tage, danach 300 je Tag.
  assert.equal(miete(["pocket3"], tage(1), tage(1)), 500);
  assert.equal(miete(["pocket3"], tage(1), tage(2)), 1000);
  assert.equal(miete(["pocket3"], tage(1), tage(3)), 1300);
  assert.equal(miete(["pocket3"], tage(1), tage(4)), 1600);
  assert.equal(miete(["pocket3"], tage(1), tage(7)), 2500);

  // Neo: 700 / 500.
  assert.equal(miete(["neo"], tage(1), tage(3)), 1900);

  // Mehrere Geraete zaehlen ihre Saetze zusammen.
  assert.equal(miete(["pocket3", "neo"], tage(1), tage(5)), 4800);
});

test("Geraete: der Preis steigt mit jedem Tag -- nie faellt er", () => {
  // Der Grund fuer die ganze Umstellung: Ein rueckwirkender Staffelsatz machte
  // drei Tage (900) billiger als zwei (1.000). Wer laenger mietet, darf nie
  // weniger zahlen -- sonst bucht der Kunde den laengeren Zeitraum, und das
  // Geraet ist unnoetig aus dem Haus.
  for (const teil of ["pocket3", "neo", "nano"]) {
    let vorher = 0;
    for (let n = 1; n <= 30; n++) {
      const jetzt = betrag({
        service_type: "equipment",
        equipment_items: [teil],
        equipment_start_date: "2026-08-01",
        equipment_end_date: new Date(Date.UTC(2026, 7, n)).toISOString().slice(0, 10),
      });
      assert.ok(jetzt > vorher, `${teil}: ${n} Tage kosten ${jetzt}, vorher ${vorher}`);
      vorher = jetzt;
    }
  }
});

test("Reel-Pakete: 300 einzeln, echter Nachlass im Paket", () => {
  const paket = (n: number) =>
    betrag({ service_type: "reel", service_subtype: `reel_${n}` });

  assert.equal(paket(1), 300);
  assert.equal(paket(5), 1200);   // 240 je Reel
  assert.equal(paket(10), 2100);  // 210 je Reel

  // Der Punkt der ganzen Aenderung: das Paket muss billiger sein als die
  // gleiche Zahl einzeln gekaufter Reels.
  assert.ok(paket(5) < 5 * paket(1));
  assert.ok(paket(10) < 10 * paket(1));
  assert.ok(paket(10) / 10 < paket(5) / 5);
});

test("Miettage zaehlen beide Randtage und ueberstehen Zeitumstellungen", () => {
  assert.equal(miettage("2026-08-01", "2026-08-01"), 1);
  assert.equal(miettage("2026-08-01", "2026-08-03"), 3);
  // Ende der europaeischen Sommerzeit -- mit lokaler Zeitrechnung waere hier
  // 2,958... herausgekommen und nach dem Runden zufaellig richtig gewesen.
  assert.equal(miettage("2026-10-24", "2026-10-26"), 3);
  assert.equal(miettage("kein-datum", "2026-08-01"), null);
});
