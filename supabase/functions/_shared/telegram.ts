// Text der Telegram-Nachricht bei bestaetigter Buchung.
// Aufrufer: notify-booking-webhook. Getestet in telegram.test.ts.
// Eingabe ist die ganze `bookings`-Zeile, wie der Trigger sie schickt.

const svcLabel: Record<string, string> = {
  studio_rental: 'Photo Studio Rental',
  podcast: 'We Cut Your Podcast',
  podcast_setup: 'Record Your Podcast',
  full_podcast: 'Full Podcast Service',
  equipment: 'Equipment Rental',
  reel: 'Reel Editing',
  drone: 'Aerial / Drone Filming',
};

const methodLabel: Record<string, string> = {
  paid: '💳 paid online',
  cash_on_pickup: '💵 cash on pick-up',
};

const equipNames: Record<string, string> = {
  pocket3: 'DJI Pocket 3', neo: 'DJI Neo', nano: 'DJI Osmo Nano',
};

// Gleicher Wert wie PODCAST_AUFBAU in booking.html: bei `podcast_setup` wird
// online nur die Einrichtungsgebuehr eingezogen, der Rest am Tag im Studio.
const PODCAST_AUFBAU = 1500;

const WOCHENTAG = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function datum(iso?: string | null): string {
  if (!iso) return '';
  const [j, m, t] = iso.slice(0, 10).split('-').map(Number);
  if (!j || !m || !t) return iso;
  const tag = WOCHENTAG[new Date(Date.UTC(j, m - 1, t)).getUTCDay()];
  return `${tag} ${String(t).padStart(2, '0')}.${String(m).padStart(2, '0')}.${j}`;
}

function uhr(t?: string | null): string {
  return t ? String(t).slice(0, 5) : '';
}

function baht(n: unknown): string {
  const z = Number(n);
  return Number.isFinite(z) ? '฿' + Math.round(z).toLocaleString('en-US') : '';
}

function bangkokZeit(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// Paketdetails, die booking.html in `service_subtype` kodiert (siehe dort
// und `preise.ts`). Unbekannte Codes werden roh gezeigt statt verschluckt.
function paket(b: any): string {
  const s = b.service_subtype;
  if (!s) return '';
  let m = /^editing_only_(\d+)cam$/.exec(s);
  if (m) return `cut only · ${m[1]} camera${m[1] === '1' ? '' : 's'}`;
  m = /^reel_(\d+)$/.exec(s);
  if (m) return `${m[1]} reel${m[1] === '1' ? '' : 's'}`;
  return s.replace(/_/g, ' ');
}

// deno-lint-ignore no-explicit-any
export function nachricht(b: any): string {
  const z: string[] = [];
  const anfrage = b.booking_status === 'enquiry';
  z.push(anfrage ? '📨 NEW ENQUIRY' : '🔔 NEW BOOKING');
  z.push('');

  // WAS
  const detail = paket(b);
  z.push(`📋 ${svcLabel[b.service_type] || b.service_type}${detail ? ' — ' + detail : ''}`);
  const geraete = Array.isArray(b.equipment_items) ? b.equipment_items : [];
  if (geraete.length) {
    z.push(`🎥 ${geraete.map((g: string) => equipNames[g] || g).join(', ')}`);
  }
  if (b.participant_count) z.push(`👥 ${b.participant_count} people`);

  // WANN — von bis
  if (b.booking_date) {
    const von = uhr(b.start_time), bis = uhr(b.end_time);
    const zeit = von && bis ? `${von} – ${bis}` : von;
    const dauer = b.duration_hours ? ` (${b.duration_hours} h)` : '';
    z.push(`📅 ${datum(b.booking_date)}${zeit ? ', ' + zeit : ''}${dauer}`);
  } else if (b.equipment_start_date) {
    const tage = b.rental_days ? ` (${b.rental_days} day${b.rental_days == 1 ? '' : 's'})` : '';
    z.push(`📅 ${datum(b.equipment_start_date)} – ${datum(b.equipment_end_date)}${tage}`);
  } else {
    z.push('📅 no date');
  }

  // BEZAHLT?
  const preis = Number(b.total_price) || 0;
  if (b.booking_status === 'cash_on_pickup') {
    z.push(`⏳ NOT PAID YET — ${preis ? baht(preis) + ' ' : ''}cash at pick-up`);
  } else if (b.service_type === 'podcast_setup' && preis > PODCAST_AUFBAU) {
    z.push(`🟡 DEPOSIT PAID ${baht(PODCAST_AUFBAU)} — ${baht(preis - PODCAST_AUFBAU)} still open (at the studio)`);
  } else if (anfrage) {
    // Drohne und Full Podcast Service: kein Preis, kein Zahlschritt. Datum
    // und Umfang sind Wunsch des Kunden, nicht gebucht.
    z.push('📨 NO PRICE YET — reply with a quote');
  } else if (b.booking_status === 'confirmed' && !preis) {
    z.push('✅ CONFIRMED — no payment needed');
  } else if (b.booking_status === 'paid') {
    z.push(`✅ PAID${preis ? ' ' + baht(preis) : ''} (online)`);
  } else {
    z.push(`❔ payment: ${b.booking_status}`);
  }
  if (b.service_type === 'equipment') z.push('   + ฿1,000 refundable deposit at pick-up');

  // WER
  z.push('');
  z.push(`👤 ${b.guest_name || 'unknown'}`);
  if (b.guest_phone) z.push(`📞 ${b.guest_phone}`);
  if (b.guest_email) z.push(`✉️ ${b.guest_email}`);

  if (b.notes) {
    z.push('');
    z.push(`📝 ${b.notes}`);
  }

  z.push('');
  const wann = bangkokZeit(b.paid_at || b.created_at);
  z.push(`🔖 ${b.booking_ref}${wann ? ' · booked ' + wann : ''}`);

  // Telegram erlaubt 4096 Zeichen je Nachricht; lange Notizen kuerzen.
  const text = z.join('\n');
  return text.length > 4000 ? text.slice(0, 3990) + '…' : text;
}
