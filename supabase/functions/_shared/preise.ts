// Serverseitige Preisquelle -- die einzige Stelle, die entscheidet, was ein
// Kunde zahlt.
//
// Warum es diese Datei gibt
// -------------------------
//
// Bis zum 2026-07-27 nahmen `stripe-checkout` und `stripe-paymentlink` den zu
// zahlenden Betrag unbesehen aus dem Request-Body:
//
//     const { amount } = body;  ...  unit_amount: Math.round(amount * 100)
//
// Wer die Anfrage im Browser abfing und `amount` auf 1 setzte, buchte fuer ein
// Baht. Der Webhook bestaetigte danach als `paid`, weil er nur auf das
// Stripe-Ereignis schaut (`docs/todo.md` T-1).
//
// Der naheliegende Fix waere gewesen, `total_price` aus der Datenbank zu
// lesen. **Das haette die Luecke nicht geschlossen.** Der Buchungssatz wird
// ueber die RPC `create_booking` angelegt (`stripe-migration.sql` Z. 79 ff.),
// die `SECURITY DEFINER` laeuft, fuer `anon` freigegeben ist und
// `payload->>'total_price'` **wortwoertlich** uebernimmt. Der Wert in der
// Datenbank ist also genauso vom Browser gesetzt wie der im Body -- nur einen
// Schritt frueher.
//
// Deshalb rechnet diese Datei den Betrag aus dem **reservierten Umfang** neu:
// Dienst, Unterart, Dauer, Miettage, Geraete. Das sind genau die Felder, die
// bestimmen, was der Kunde tatsaechlich bekommt und was der Kalender sperrt.
// Wer sie faelscht, faelscht seine eigene Buchung mit -- er bekommt dann
// wirklich nur die eine Stunde, fuer die er zahlt. Damit ist der Preis an die
// Leistung gebunden, und das ist die Eigenschaft, auf die es ankommt.
//
// Fail-closed
// -----------
//
// Laesst sich ein Betrag nicht sicher bestimmen, gibt es **keinen** Rueckfall
// auf den Browser-Wert. Dann wird abgelehnt. Eine Buchung, die nicht zustande
// kommt, ist behebbar; eine Buchung ueber 10 THB ist es nicht.
//
// Die Zahlen unten sind aus `booking.html` (Stand 2026-07-27) uebernommen und
// muessen mit den dortigen Konstanten uebereinstimmen -- siehe `docs/todo.md`
// T-8 (doppelte Preisfuehrung). Bis diese Schuld getilgt ist, gilt: **wer eine
// Zahl in `booking.html` aendert, aendert sie hier mit.**

// ── Preistafel ────────────────────────────────────────────────────────────
// Alle Betraege in ganzen Baht (THB).

/**
 * Die Waehrung. **Fest verdrahtet, nicht aus dem Request.**
 *
 * Zweiter Befund vom 2026-07-27: Beide Functions uebernahmen auch
 * `currency` aus dem Body (`const { currency = 'thb' } = body`). Ein
 * serverseitig richtig errechneter Betrag von 800 haette damit als 800 IDR
 * eingezogen werden koennen -- rund 1,70 THB. Ein sauberer Preis in der
 * falschen Waehrung ist derselbe Schaden wie ein falscher Preis.
 */
export const WAEHRUNG = "thb";

/** Studio je angefangener Stunde. `booking.html` updateStudioPrice(). */
export const STUDIO_STUNDENSATZ = 200;

/** Aufbaupauschale bei Podcast-Aufnahme. `booking.html` updatePodcastPrice(). */
export const PODCAST_AUFBAU = 1000;

/** Reiner Schnitt, je Folge. `booking.html` updatePodcastPrice(). */
export const PODCAST_SCHNITT_JE_FOLGE = 1000;

/**
 * Podcast-Setup wird **nicht** voll abgerechnet, sondern mit einer festen
 * Anzahlung; der Rest wird vor Ort beglichen. `booking.html` setupStep5():
 * `const chargeAmount = isSetup ? 1000 : state.totalPrice`.
 *
 * Das ist hier ein Gluecksfall: Der Gesamtpreis haengt an Kameraanzahl,
 * Videograf und Reel-Zusatz -- und **keine** dieser Angaben steht in einer
 * eigenen Spalte, sie landen nur als Fliesstext in `notes`. Der Gesamtpreis
 * ist serverseitig daher gar nicht nachrechenbar. Der einzuziehende Betrag
 * sehr wohl, denn er ist fest.
 */
export const PODCAST_SETUP_ANZAHLUNG = 1000;

/** Geraetemiete je Tag. `booking.html` EQUIP_PRICES. */
export const GERAETE_TAGESSATZ: Record<string, number> = {
  pocket3: 500,
  neo: 700,
  nano: 500,
};

/** Ab dieser Mietdauer greift der Rabatt. `booking.html` calcEquipPrice(). */
export const GERAETE_RABATT_AB_TAGEN = 3;

/** Hoehe des Rabatts. `booking.html` calcEquipPrice(). */
export const GERAETE_RABATT_SATZ = 0.1;

/**
 * Drohnenpakete. **Bewusst alle `null`** -- die Preise liegen nicht vor
 * (`docs/todo.md` T-10, nur Andy kann sie liefern). Solange hier `null` steht,
 * lehnt diese Datei jede Drohnen-Zahlung ab, statt eine Zahl zu erfinden.
 *
 * Die Buchungsstrecke fuehrt Drohne heute ohnehin als reine **Anfrage**
 * (`booking_status: 'enquiry'`, kein Zahlschritt). Der Eintrag hier ist die
 * zweite Sperre fuer den Fall, dass jemand die Function trotzdem aufruft.
 */
export const DROHNEN_PAKETPREIS: Record<string, number | null> = {
  basic: null,
  standard: null,
  premium: null,
};

// ── Plausibilitaetsgrenzen ────────────────────────────────────────────────
// Keine Preisregel, sondern ein Gelaender. Was ausserhalb liegt, ist kein
// Geschaeftsvorfall, den diese Seite kennt -- also wird es abgelehnt, nicht
// berechnet.

/** Die Seite bietet hoechstens "Full day (8h)" an. 12 laesst Luft. */
export const MAX_STUNDEN = 12;

/** Mietdauer in Tagen. */
export const MAX_MIETTAGE = 90;

/** Obergrenze je Zahlung. Alles darueber ist ein Rechenfehler, kein Umsatz. */
export const HOECHSTBETRAG = 200000;

// ── Typen ─────────────────────────────────────────────────────────────────

/** Die Felder des Buchungssatzes, die fuer den Preis zaehlen. */
export type Buchung = {
  service_type?: string | null;
  service_subtype?: string | null;
  duration_hours?: number | null;
  equipment_start_date?: string | null;
  equipment_end_date?: string | null;
  equipment_items?: string[] | null;
  booking_status?: string | null;
  payment_status?: string | null;
};

/**
 * Ergebnis der Preisermittlung. Bewusst kein `number | null`: Der Aufrufer
 * soll den Fehlerfall nicht versehentlich als 0 weiterreichen koennen.
 */
export type Preisergebnis =
  | { ok: true; betrag: number; grundlage: string }
  | { ok: false; code: Ablehnungsgrund; grund: string };

export type Ablehnungsgrund =
  | "DIENST_UNBEKANNT"
  | "KEIN_PREIS_HINTERLEGT"
  | "ANGABEN_UNVOLLSTAENDIG"
  | "GERAET_UNBEKANNT"
  | "KEINE_ZAHLUNG_VORGESEHEN"
  | "BETRAG_UNPLAUSIBEL"
  | "SCHON_BEZAHLT";

function ablehnen(code: Ablehnungsgrund, grund: string): Preisergebnis {
  return { ok: false, code, grund };
}

/**
 * Was der Kunde zu sehen bekommt.
 *
 * `grund` ist Fachdeutsch fuer das Protokoll -- die Buchungsstrecke zeigt den
 * Text der Antwort aber ungefiltert an (`booking.html`: `'Error: ' +
 * err.message`). Ein Gast auf einer englischsprachigen Seite soll weder
 * Deutsch lesen muessen noch erfahren, welche Spalte fehlt.
 */
export function kundentext(code: Ablehnungsgrund): string {
  switch (code) {
    case "SCHON_BEZAHLT":
      return "This booking has already been paid.";
    case "KEINE_ZAHLUNG_VORGESEHEN":
      return "This service is handled as an enquiry — we will contact you " +
        "with a quote. No online payment is needed.";
    default:
      return "We could not confirm the price for this booking, so we did " +
        "not charge you. Please contact us with your booking reference " +
        "and we will complete it by hand.";
  }
}

// ── Hilfen ────────────────────────────────────────────────────────────────

/**
 * Ganze Zahl im erlaubten Bereich -- oder `null`.
 *
 * Nimmt bewusst **keine** Zeichenketten an: `Number("3 ")` waere 3, und eine
 * Preisquelle ist der falsche Ort fuer Nachsicht. Postgres liefert `int`
 * ohnehin als Zahl.
 */
function ganzzahl(wert: unknown, min: number, max: number): number | null {
  if (typeof wert !== "number" || !Number.isInteger(wert)) return null;
  if (wert < min || wert > max) return null;
  return wert;
}

/**
 * Miettage einschliesslich beider Randtage -- dieselbe Rechnung wie
 * `calcEquipPrice()` in `booking.html`.
 *
 * Gerechnet wird auf **UTC-Mitternacht**, damit keine Sommerzeitumstellung
 * einen halben Tag erzeugt.
 */
export function miettage(von: string, bis: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(von) || !/^\d{4}-\d{2}-\d{2}$/.test(bis)) {
    return null;
  }
  const a = Date.parse(von + "T00:00:00Z");
  const b = Date.parse(bis + "T00:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.round((b - a) / 86400000) + 1;
}

// ── Die eigentliche Rechnung ──────────────────────────────────────────────

/**
 * Ermittelt, was fuer diese Buchung einzuziehen ist.
 *
 * Der Wert, den der Browser geschickt hat, geht hier **nicht** ein -- er ist
 * gar kein Parameter. Das ist Absicht: Was nicht hereinkommt, kann auch nicht
 * versehentlich benutzt werden.
 */
export function ermittleBetrag(buchung: Buchung): Preisergebnis {
  // Eine bereits bezahlte Buchung darf keinen zweiten Zahlvorgang bekommen.
  if (buchung.payment_status === "paid" || buchung.booking_status === "paid") {
    return ablehnen("SCHON_BEZAHLT", "Diese Buchung ist bereits bezahlt.");
  }

  const dienst = buchung.service_type;
  if (typeof dienst !== "string" || dienst === "") {
    return ablehnen("DIENST_UNBEKANNT", "Der Buchung fehlt der Dienst.");
  }

  const ergebnis = nachDienst(dienst, buchung);
  if (!ergebnis.ok) return ergebnis;

  // Letztes Gelaender: auch ein richtiger Rechenweg darf keinen unsinnigen
  // Betrag ausliefern.
  if (!Number.isFinite(ergebnis.betrag) || ergebnis.betrag <= 0) {
    return ablehnen(
      "BETRAG_UNPLAUSIBEL",
      `Errechneter Betrag ${ergebnis.betrag} ist kein gueltiger Zahlbetrag.`,
    );
  }
  if (ergebnis.betrag > HOECHSTBETRAG) {
    return ablehnen(
      "BETRAG_UNPLAUSIBEL",
      `Errechneter Betrag ${ergebnis.betrag} THB liegt ueber der Obergrenze ` +
        `von ${HOECHSTBETRAG} THB.`,
    );
  }
  return ergebnis;
}

function nachDienst(dienst: string, buchung: Buchung): Preisergebnis {
  switch (dienst) {
    case "studio_rental":
      return studio(buchung);
    case "podcast":
      return podcast(buchung);
    case "podcast_setup":
      return {
        ok: true,
        betrag: PODCAST_SETUP_ANZAHLUNG,
        grundlage: `Podcast-Setup: feste Anzahlung ${PODCAST_SETUP_ANZAHLUNG} THB ` +
          `(Restbetrag vor Ort)`,
      };
    case "equipment":
      return geraete(buchung);
    case "drone":
      // Drohne ist eine Anfrage, kein Verkauf: Termin und Preis werden erst
      // abgestimmt. Selbst wenn spaeter Preise in DROHNEN_PAKETPREIS stehen,
      // gehoert die Freigabe nicht in einen unbeaufsichtigten Zahlungsweg.
      return ablehnen(
        "KEINE_ZAHLUNG_VORGESEHEN",
        "Drohnenfluege werden als Anfrage aufgenommen; ein Preis wird " +
          "individuell abgestimmt (docs/todo.md T-10).",
      );
    case "reel":
      // Die Paketgroesse steht nur als Fliesstext in `notes`, in keiner
      // Spalte. Damit ist der Preis serverseitig nicht nachrechenbar.
      // Der Weg ist in der Buchungsstrecke derzeit ohnehin nicht erreichbar
      // (`state.service` wird nirgends auf 'reel' gesetzt).
      return ablehnen(
        "KEIN_PREIS_HINTERLEGT",
        "Reel-Pakete sind serverseitig nicht nachrechenbar: die Paketgroesse " +
          "steht nur in `notes`, nicht in einer eigenen Spalte.",
      );
    default:
      return ablehnen(
        "DIENST_UNBEKANNT",
        `Fuer den Dienst '${dienst}' ist kein Preis hinterlegt.`,
      );
  }
}

/**
 * Wie `ermittleBetrag`, meldet zusaetzlich, ob der vom Browser geschickte
 * Betrag abweicht.
 *
 * Der gemeldete Wert wird **ausschliesslich** fuer diese Meldung benutzt. Er
 * fliesst nicht in `betrag` ein -- auch dann nicht, wenn die Ermittlung
 * scheitert. Genau das ist die Eigenschaft, die der Test festnagelt.
 */
export function pruefeGemeldetenBetrag(
  buchung: Buchung,
  gemeldet: unknown,
): { ergebnis: Preisergebnis; abweichung: string | null } {
  const ergebnis = ermittleBetrag(buchung);
  if (!ergebnis.ok) return { ergebnis, abweichung: null };
  if (typeof gemeldet !== "number" || gemeldet === ergebnis.betrag) {
    return { ergebnis, abweichung: null };
  }
  return {
    ergebnis,
    abweichung: `Der Browser meldete ${gemeldet} THB, serverseitig errechnet ` +
      `sind ${ergebnis.betrag} THB. Es gilt der errechnete Betrag.`,
  };
}

function studio(buchung: Buchung): Preisergebnis {
  const stunden = ganzzahl(buchung.duration_hours, 1, MAX_STUNDEN);
  if (stunden === null) {
    return ablehnen(
      "ANGABEN_UNVOLLSTAENDIG",
      `Studiomiete braucht eine Dauer von 1 bis ${MAX_STUNDEN} Stunden, ` +
        `angegeben war: ${JSON.stringify(buchung.duration_hours)}.`,
    );
  }
  return {
    ok: true,
    betrag: STUDIO_STUNDENSATZ * stunden,
    grundlage: `Studio: ${STUDIO_STUNDENSATZ} THB x ${stunden} h`,
  };
}

function podcast(buchung: Buchung): Preisergebnis {
  const art = buchung.service_subtype;

  if (art === "editing_only") {
    const folgen = ganzzahl(buchung.duration_hours, 1, MAX_STUNDEN);
    if (folgen === null) {
      return ablehnen(
        "ANGABEN_UNVOLLSTAENDIG",
        `Reiner Schnitt braucht eine Folgenzahl von 1 bis ${MAX_STUNDEN}, ` +
          `angegeben war: ${JSON.stringify(buchung.duration_hours)}.`,
      );
    }
    return {
      ok: true,
      betrag: PODCAST_SCHNITT_JE_FOLGE * folgen,
      grundlage: `Podcast-Schnitt: ${PODCAST_SCHNITT_JE_FOLGE} THB x ` +
        `${folgen} Folge(n)`,
    };
  }

  // `booking.html` behandelt jede andere Unterart gleich (Aufnahme mit und
  // ohne Schnitt). Trotzdem wird hier auf die bekannten Werte eingegrenzt:
  // eine unbekannte Unterart ist ein Hinweis darauf, dass sich die
  // Buchungsstrecke geaendert hat, und dann soll die Preisquelle stehen
  // bleiben statt zu raten.
  if (art !== "podcast_recording" && art !== "podcast_editing") {
    return ablehnen(
      "ANGABEN_UNVOLLSTAENDIG",
      `Unbekannte Podcast-Unterart: ${JSON.stringify(art)}.`,
    );
  }

  const stunden = ganzzahl(buchung.duration_hours, 1, MAX_STUNDEN);
  if (stunden === null) {
    return ablehnen(
      "ANGABEN_UNVOLLSTAENDIG",
      `Podcast-Aufnahme braucht eine Dauer von 1 bis ${MAX_STUNDEN} Stunden, ` +
        `angegeben war: ${JSON.stringify(buchung.duration_hours)}.`,
    );
  }
  return {
    ok: true,
    betrag: STUDIO_STUNDENSATZ * stunden + PODCAST_AUFBAU,
    grundlage: `Podcast: ${STUDIO_STUNDENSATZ} THB x ${stunden} h + ` +
      `${PODCAST_AUFBAU} THB Aufbau`,
  };
}

function geraete(buchung: Buchung): Preisergebnis {
  const teile = buchung.equipment_items;
  if (!Array.isArray(teile) || teile.length === 0) {
    return ablehnen(
      "ANGABEN_UNVOLLSTAENDIG",
      "Geraetemiete ohne Geraete.",
    );
  }

  let tagessatz = 0;
  for (const teil of teile) {
    // `Object.prototype.hasOwnProperty` statt `in`: sonst waere
    // `equipment_items: ['constructor']` ein "bekanntes" Geraet.
    if (
      typeof teil !== "string" ||
      !Object.prototype.hasOwnProperty.call(GERAETE_TAGESSATZ, teil)
    ) {
      return ablehnen(
        "GERAET_UNBEKANNT",
        `Fuer das Geraet ${JSON.stringify(teil)} ist kein Preis hinterlegt.`,
      );
    }
    tagessatz += GERAETE_TAGESSATZ[teil];
  }

  const von = buchung.equipment_start_date;
  const bis = buchung.equipment_end_date;
  if (typeof von !== "string" || typeof bis !== "string") {
    return ablehnen(
      "ANGABEN_UNVOLLSTAENDIG",
      "Geraetemiete braucht Anfangs- und Enddatum.",
    );
  }
  const tage = miettage(von, bis);
  if (tage === null || tage < 1 || tage > MAX_MIETTAGE) {
    return ablehnen(
      "ANGABEN_UNVOLLSTAENDIG",
      `Mietzeitraum ${von} bis ${bis} ergibt keine gueltige Tageszahl ` +
        `(1 bis ${MAX_MIETTAGE}).`,
    );
  }

  // Bewusst **nicht** aus `rental_days` gelesen: die Spalte kommt aus
  // demselben Browser-Payload wie alles andere und koennte kleiner sein als
  // der Zeitraum, den der Kalender tatsaechlich sperrt.
  const rabatt = tage >= GERAETE_RABATT_AB_TAGEN ? GERAETE_RABATT_SATZ : 0;
  const betrag = Math.round(tagessatz * tage * (1 - rabatt));
  const rabattText = rabatt > 0 ? ` - ${Math.round(rabatt * 100)} % Rabatt` : "";
  return {
    ok: true,
    betrag,
    grundlage: `Geraete (${teile.join(", ")}): ${tagessatz} THB/Tag x ` +
      `${tage} Tag(e)${rabattText}`,
  };
}
