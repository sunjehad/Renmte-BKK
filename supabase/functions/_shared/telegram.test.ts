// Pruefung des Telegram-Textes bei bestaetigter Buchung.
//
// Aufruf (Node 22+):
//
//     node --test supabase/functions/_shared/telegram.test.ts
//
// Mit VORSCHAU=1 werden die Nachrichten zusaetzlich ausgegeben.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nachricht } from './telegram.ts';

const studio = {
  booking_ref: 'RM-2609-AB12', booking_status: 'paid', service_type: 'studio_rental',
  booking_date: '2026-09-20', start_time: '14:00:00', end_time: '17:00:00', duration_hours: 3,
  guest_name: 'Somchai P.', guest_phone: '+66 81 234 5678', guest_email: 'somchai@example.com',
  participant_count: 2, total_price: 2250, notes: 'Couple shoot, white backdrop please',
  source: 'website', paid_at: '2026-09-14T08:12:00Z',
};

const podcast = {
  ...studio, booking_ref: 'RM-2609-CD34', service_type: 'podcast_setup', total_price: 4500,
  notes: 'Cameras: 3 + Videographer', participant_count: 4,
};

const geraet = {
  booking_ref: 'RM-2609-EF56', booking_status: 'cash_on_pickup', service_type: 'equipment',
  booking_date: null, start_time: null, equipment_start_date: '2026-09-21',
  equipment_end_date: '2026-09-24', rental_days: 3, equipment_items: ['neo', 'pocket3'],
  guest_name: 'Anna K.', guest_phone: '+49 170 1234567', guest_email: null,
  total_price: 2400, notes: null, source: 'website', created_at: '2026-09-14T09:00:00Z',
};

test('Paketcode wird lesbar', () => {
  assert.match(nachricht({ ...studio, service_type: 'podcast', service_subtype: 'editing_only_2cam' }), /We Cut Your Podcast — cut only · 2 cameras/);
  assert.match(nachricht({ ...studio, service_type: 'reel', service_subtype: 'reel_5' }), /Reel Editing — 5 reels/);
});

test('Anfrage: eigener Kopf, kein Bezahlt-Status', () => {
  const t = nachricht({ ...studio, booking_status: 'enquiry', service_type: 'drone',
    service_subtype: 'real_estate', total_price: null, booking_date: null, notes: 'Condo in Sukhumvit' });
  assert.match(t, /📨 NEW ENQUIRY/);
  assert.match(t, /Aerial \/ Drone Filming — real estate/);
  assert.match(t, /NO PRICE YET/);
  assert.doesNotMatch(t, /PAID/);
});

const leer = { booking_ref: 'RM-X', booking_status: 'paid', service_type: 'reel' };

if (process.env.VORSCHAU) {
  for (const b of [studio, podcast, geraet, leer]) console.log(nachricht(b) + '\n────────');
}

test('Studio: Kontakt, Zeitfenster, Personen, Betrag und Notiz stehen drin', () => {
  const t = nachricht(studio);
  assert.match(t, /✅ PAID ฿2,250 \(online\)/);
  assert.match(t, /Photo Studio Rental/);
  assert.match(t, /Sun 20\.09\.2026, 14:00 – 17:00 \(3 h\)/);
  assert.match(t, /\+66 81 234 5678/);
  assert.match(t, /somchai@example\.com/);
  assert.match(t, /2 people/);
  assert.match(t, /Couple shoot/);
  assert.match(t, /RM-2609-AB12 · booked 14\/09, 15:12/); // 08:12 UTC = 15:12 Bangkok
});

test('Podcast-Aufnahme: Anzahlung und Rest getrennt', () => {
  const t = nachricht(podcast);
  assert.match(t, /DEPOSIT PAID ฿1,500 — ฿3,000 still open/);
  assert.doesNotMatch(t, /✅ PAID/);
});

test('Equipment bar: Zeitraum, Geraete, Kaution, kein "paid"', () => {
  const t = nachricht(geraet);
  assert.match(t, /NOT PAID YET — ฿2,400 cash at pick-up/);
  assert.match(t, /Mon 21\.09\.2026 – Thu 24\.09\.2026 \(3 days\)/);
  assert.match(t, /DJI Neo, DJI Pocket 3/);
  assert.match(t, /refundable deposit/);
  assert.doesNotMatch(t, /✉️/); // keine leere Mailzeile
});

test('Fast leere Zeile wirft nicht und nennt die Ref', () => {
  const t = nachricht(leer);
  assert.match(t, /no date/);
  assert.match(t, /RM-X/);
  assert.doesNotMatch(t, /undefined|null|NaN/);
});

test('Ueberlange Notiz bleibt unter dem Telegram-Limit', () => {
  const t = nachricht({ ...studio, notes: 'x'.repeat(6000) });
  assert.ok(t.length <= 4000);
});
