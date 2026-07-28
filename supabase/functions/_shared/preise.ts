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

/**
 * Schnittdienst "We cut your podcast" -- Preistafel aus der Werbung
 * (Aushang, Launch Offer 50%).
 *
 * Der Preis haengt an der **Zahl der Kameraperspektiven** im Rohmaterial, denn
 * die bestimmt den Schnittaufwand. Die erste Stunde kostet den vollen
 * Promo-Satz, jede weitere die Haelfte davon.
 *
 *   Kameras | normal/h | promo/h | jede weitere Stunde
 *   --------+----------+---------+--------------------
 *      1    |   3.000  |  1.500  |   750
 *      2    |   4.000  |  2.000  | 1.000
 *      3    |   6.000  |  3.000  | 1.500
 *
 * Bis zum 2026-07-28 rechnete diese Datei `1.000 THB x Folgenzahl`. Das war
 * gleich doppelt falsch: die falsche Bezugsgroesse (Folgen statt Material) und
 * die falsche Zahl. Sie haette fail-closed-konform und voellig unauffaellig
 * einen Bruchteil des vereinbarten Preises eingezogen.
 *
 * `booking.html` cutOnlyPreis(). Nur die Promo-Saetze werden eingezogen; die
 * Normalpreise stehen hier, damit die Seite sie durchgestrichen zeigen kann
 * und beide Zahlen an **einer** Stelle gepflegt werden.
 */
export const CUT_ERSTE_STUNDE: Record<number, number> = { 1: 1500, 2: 2000, 3: 3000 };
export const CUT_NORMAL_ERSTE_STUNDE: Record<number, number> = { 1: 3000, 2: 4000, 3: 6000 };
export const CUT_WEITERE_STUNDE: Record<number, number> = { 1: 750, 2: 1000, 3: 1500 };

/**
 * Podcast-Setup wird **nicht** voll abgerechnet, sondern mit einer festen
 * Anzahlung; der Rest wird vor Ort beglichen. `booking.html` setupStep5():
 * `const chargeAmount = isSetup ? PODCAST_AUFBAU : state.totalPrice`.
 *
 * Das ist hier ein Gluecksfall: Der Gesamtpreis haengt an Kameraanzahl,
 * Videograf und Reel-Zusatz -- und **keine** dieser Angaben steht in einer
 * eigenen Spalte, sie landen nur als Fliesstext in `notes`. Der Gesamtpreis
 * ist serverseitig daher gar nicht nachrechenbar. Der einzuziehende Betrag
 * sehr wohl, denn er ist fest.
 */
export const PODCAST_SETUP_ANZAHLUNG = 1500;

/** Geraetemiete je Tag. `booking.html` EQUIP_PRICES. */
export const GERAETE_TAGESSATZ: Record<string, number> = {
  pocket3: 500,
  neo: 700,
  nano: 500,
};

/**
 * Satz fuer jeden Tag **ab dem dritten** -- gilt nur fuer die zusaetzlichen
 * Tage, nicht rueckwirkend fuer die ganze Miete.
 *
 * Zwei Anlaeufe waren vorher noetig:
 *
 * 1. Bis zum 2026-07-28 rechnete die Seite `10 % ab 3 Tagen`, waehrend die
 *    Startseite eine feste Staffel bewarb. Bei 3 Tagen Pocket 3 versprach sie
 *    900 THB und buchte 1.350 ab.
 * 2. Der Staffelsatz galt dann rueckwirkend fuer alle Tage -- damit kostete
 *    eine Dreitagesmiete (900) **weniger als zwei Tage** (1.000). Das passiert
 *    zwangslaeufig, sobald ein rueckwirkender Satz unter dem Grundsatz liegt;
 *    eine hoehere Zahl verschiebt den Sprung nur.
 *
 * Andys Entscheidung vom 2026-07-28: Die ersten beiden Tage kosten den vollen
 * Satz, **jeder weitere** den Zusatzsatz. Damit steigt die Reihe streng
 * monoton, und der Nachlass landet bei den langen Mieten. Es ist dieselbe
 * Logik wie beim Schnittdienst (erste Stunde voll, jede weitere zur Haelfte) --
 * ein Kunde, der beides bucht, findet dasselbe Muster wieder.
 */
export const GERAETE_ZUSATZTAG: Record<string, number> = {
  pocket3: 300,
  neo: 500,
  nano: 300,
};

/** Ab diesem Tag gilt der Zusatzsatz. `booking.html` calcEquipPrice(). */
export const GERAETE_ZUSATZTAG_AB = 3;

/**
 * Reel-Pakete. Preis je Paket, **nicht** je Reel mal Anzahl.
 *
 * Bis zum 2026-07-28 kosteten alle drei Pakete 200 THB je Reel -- die Karte in
 * der Buchungsstrecke sagte es selbst: "5-reel package - save 0 THB per reel".
 * Ein Paket ohne Ersparnis ist schlechter als gar kein Paket. Andys Entscheidung
 * vom 2026-07-28: Einzelreel auf 300 THB, Pakete mit echtem Nachlass.
 *
 *   1 Reel  -> 300 THB je Reel   (kein Nachlass)
 *   5 Reels -> 240 THB je Reel   (20 %)
 *  10 Reels -> 210 THB je Reel   (30 %)
 *
 * `booking.html` REEL_PAKETE.
 */
export const REEL_PAKETE: Record<number, number> = {
  1: 300,
  5: 1200,
  10: 2100,
};

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
    case "full_podcast":
      // Fuenf Folgen ueber Wochen -- Termine und Umfang werden im Gespraech
      // festgelegt. Die 19.000 THB auf der Seite sind eine Hausnummer zur
      // Vorfilterung, kein Zahlbetrag.
      return ablehnen(
        "KEINE_ZAHLUNG_VORGESEHEN",
        "Der Full Podcast Service wird als Anfrage aufgenommen; Umfang und " +
          "Preis werden individuell abgestimmt.",
      );
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
      return reel(buchung);
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

/**
 * `service_type = 'podcast'` heisst seit dem 2026-07-28 **ausschliesslich**
 * "We cut your podcast": Der Kunde schickt Rohmaterial, es gibt keinen
 * Studiotermin. Aufnahme laeuft ueber `podcast_setup`.
 *
 * Die Kameraanzahl steckt in `service_subtype` (`editing_only_2cam`), **nicht**
 * in einer eigenen Spalte. Das ist Absicht: Die Spalte gibt es bereits und sie
 * traegt genau diese Art von Angabe, also braucht der Preis keine
 * Schemaaenderung -- und er bleibt trotzdem serverseitig nachrechenbar. Ein
 * `notes`-Feld waere es nicht gewesen (siehe `reel`).
 *
 * Die frueheren Unterarten `podcast_recording`, `podcast_editing` und das
 * nackte `editing_only` werden **abgelehnt statt weitergerechnet**: Taucht so
 * etwas neu auf, stimmt etwas nicht, und dann soll die Preisquelle stehen
 * bleiben statt zu raten.
 */
function podcast(buchung: Buchung): Preisergebnis {
  const art = buchung.service_subtype;
  const treffer = typeof art === "string"
    ? /^editing_only_([123])cam$/.exec(art)
    : null;

  if (treffer === null) {
    return ablehnen(
      "ANGABEN_UNVOLLSTAENDIG",
      `Unter 'podcast' gibt es nur noch den Schnitt mit Kameraangabe ` +
        `('editing_only_1cam' bis '_3cam'), angegeben war: ` +
        `${JSON.stringify(art)}.`,
    );
  }
  const kameras = Number(treffer[1]) as 1 | 2 | 3;

  // `duration_hours` traegt hier die **Stunden Rohmaterial**, nicht die
  // Studiodauer und nicht die Folgenzahl.
  const stunden = ganzzahl(buchung.duration_hours, 1, MAX_STUNDEN);
  if (stunden === null) {
    return ablehnen(
      "ANGABEN_UNVOLLSTAENDIG",
      `Der Schnitt braucht eine Materialmenge von 1 bis ${MAX_STUNDEN} ` +
        `Stunden, angegeben war: ${JSON.stringify(buchung.duration_hours)}.`,
    );
  }

  const zusatz = stunden - 1;
  return {
    ok: true,
    betrag: CUT_ERSTE_STUNDE[kameras] + zusatz * CUT_WEITERE_STUNDE[kameras],
    grundlage: zusatz === 0
      ? `Schnitt ${kameras} Kamera(s): ${CUT_ERSTE_STUNDE[kameras]} THB erste Stunde`
      : `Schnitt ${kameras} Kamera(s): ${CUT_ERSTE_STUNDE[kameras]} THB erste ` +
        `Stunde + ${CUT_WEITERE_STUNDE[kameras]} THB x ${zusatz} h`,
  };
}

/**
 * Reel-Schnitt. Die Paketgroesse steckt in `service_subtype` (`reel_5`) --
 * bis zum 2026-07-28 stand sie nur als Fliesstext in `notes` und war damit
 * serverseitig nicht nachrechenbar; der Dienst musste deshalb abgelehnt
 * werden. Derselbe Weg wie beim Schnittdienst: vorhandene Spalte, keine
 * Schemaaenderung, trotzdem fail-closed.
 */
function reel(buchung: Buchung): Preisergebnis {
  const art = buchung.service_subtype;
  const treffer = typeof art === "string" ? /^reel_(\d{1,2})$/.exec(art) : null;
  const anzahl = treffer === null ? null : Number(treffer[1]);

  if (
    anzahl === null ||
    !Object.prototype.hasOwnProperty.call(REEL_PAKETE, anzahl)
  ) {
    return ablehnen(
      "ANGABEN_UNVOLLSTAENDIG",
      `Reel-Buchungen brauchen eine bekannte Paketgroesse ` +
        `(${Object.keys(REEL_PAKETE).map((n) => `reel_${n}`).join(", ")}), ` +
        `angegeben war: ${JSON.stringify(art)}.`,
    );
  }

  return {
    ok: true,
    betrag: REEL_PAKETE[anzahl],
    grundlage: `Reel-Paket: ${anzahl} Reel(s) fuer ${REEL_PAKETE[anzahl]} THB`,
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
  let zusatzsatz = 0;
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
    zusatzsatz += GERAETE_ZUSATZTAG[teil];
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
  const volleTage  = Math.min(tage, GERAETE_ZUSATZTAG_AB - 1);
  const zusatzTage = tage - volleTage;
  return {
    ok: true,
    betrag: tagessatz * volleTage + zusatzsatz * zusatzTage,
    grundlage: `Geraete (${teile.join(", ")}): ${tagessatz} THB x ${volleTage} Tag(e)` +
      (zusatzTage > 0 ? ` + ${zusatzsatz} THB x ${zusatzTage} weitere(r) Tag(e)` : ""),
  };
}
