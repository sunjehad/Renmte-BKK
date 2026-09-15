// No-Show-Gebuehr abbuchen (seit 2026-09-15).
//
// Aufgerufen NUR aus admin.html von einem angemeldeten Admin. Bucht 50 % des
// serverseitig ermittelten Preises (preise.ts noShowGebuehr) von der Karte ab,
// die der Kunde beim Reservieren hinterlegt hat (stripe-card-guarantee).
//
// Sperren, alle serverseitig:
//   - Aufrufer ist Admin (JWT pruefen, profiles.is_admin)
//   - Buchung ist cash_on_pickup, nicht storniert, Karte hinterlegt
//   - noch nicht abgebucht (kein zweites Mal)
//   - der Termin plus 30 Minuten Kulanz ist vorbei (Bangkok-Zeit) -- so steht
//     es in den Reservierungsbedingungen R1
//   - Reservierungsbedingungen wurden unterschrieben
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  ermittleBetrag,
  kundentext,
  noShowGebuehr,
  WAEHRUNG,
  type Buchung,
} from '../_shared/preise.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KULANZ_MINUTEN = 30;

function antwort(inhalt: unknown, status = 200) {
  return new Response(JSON.stringify(inhalt), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Terminbeginn als Zeitpunkt, Bangkok (UTC+7, keine Sommerzeit). */
function terminBeginn(b: Record<string, unknown>): Date | null {
  const tag = (b.service_type === 'equipment' ? b.equipment_start_date : b.booking_date) as string | null;
  const zeit = String(b.start_time ?? '').slice(0, 5);
  if (!tag || !/^\d{2}:\d{2}$/.test(zeit)) return null;
  const d = new Date(`${tag}T${zeit}:00+07:00`);
  return isNaN(d.getTime()) ? null : d;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const dienst = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // ── Admin? ────────────────────────────────────────────────────────────
    const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: nutzer } = await dienst.auth.getUser(jwt);
    if (!nutzer?.user) return antwort({ error: 'Not logged in.' }, 401);
    const { data: profil } = await dienst
      .from('profiles').select('is_admin').eq('id', nutzer.user.id).maybeSingle();
    if (!profil?.is_admin) return antwort({ error: 'Admins only.' }, 403);

    const { bookingId } = await req.json();
    if (!bookingId) return antwort({ error: 'Missing bookingId' }, 400);

    const { data: b, error } = await dienst.from('bookings').select('*').eq('id', bookingId).maybeSingle();
    if (error) return antwort({ error: 'Could not load the booking.' }, 500);
    if (!b) return antwort({ error: 'Booking not found.' }, 404);

    if (b.noshow_charged_at) return antwort({ error: 'The no-show fee was already charged.' }, 409);
    if (b.booking_status !== 'cash_on_pickup' || b.status === 'cancelled') {
      return antwort({ error: 'Only open cash bookings can be charged as no-show.' }, 409);
    }
    if (!b.card_payment_method || !b.stripe_customer_id) {
      return antwort({ error: 'No card on file for this booking.' }, 409);
    }
    const beginn = terminBeginn(b);
    if (!beginn) return antwort({ error: 'Booking has no start time.' }, 409);
    if (Date.now() < beginn.getTime() + KULANZ_MINUTEN * 60_000) {
      return antwort({ error: `Too early: a no-show counts only ${KULANZ_MINUTEN} minutes after the booking time.` }, 409);
    }
    const { data: vereinbarung } = await dienst
      .from('reservation_agreements').select('version').eq('booking_id', bookingId).maybeSingle();
    if (!vereinbarung) return antwort({ error: 'No signed reservation terms for this booking.' }, 409);

    const ergebnis = ermittleBetrag(b as Buchung);
    if (!ergebnis.ok) {
      return antwort({ error: kundentext(ergebnis.code), code: ergebnis.code }, 422);
    }
    const gebuehr = noShowGebuehr(ergebnis.betrag);

    let intent;
    try {
      intent = await stripe.paymentIntents.create({
        amount: noShowGebuehr(ergebnis.betrag) * 100,
        currency: WAEHRUNG,
        customer: b.stripe_customer_id,
        payment_method: b.card_payment_method,
        off_session: true,
        confirm: true,
        description: `No-show fee (50%) for booking ${b.booking_ref ?? ''}`,
        metadata: { booking_id: bookingId, booking_ref: b.booking_ref ?? '', zweck: 'noshow_fee' },
      }, { idempotencyKey: `noshow-${bookingId}` });
    } catch (e) {
      // Haeufigster Fall in Thailand: die Bank verlangt 3-D Secure, das ohne
      // den Kunden nicht geht (authentication_required), oder die Karte ist
      // abgelehnt. Nichts wird gespeichert, der Admin sieht den Grund.
      const code = (e as { code?: string }).code ?? '';
      console.error(`stripe-noshow-charge: abgelehnt fuer ${bookingId}: ${code}`, e);
      const text = code === 'authentication_required'
        ? 'The bank requires the customer to confirm this payment (3-D Secure). It cannot be charged without them — please contact the customer.'
        : `The card was declined (${code || 'unknown reason'}).`;
      return antwort({ error: text, code }, 402);
    }

    if (intent.status !== 'succeeded') {
      return antwort({ error: `Payment not completed (status ${intent.status}).` }, 402);
    }

    await dienst.from('bookings').update({
      noshow_charged_at: new Date().toISOString(),
      noshow_fee_amount: gebuehr,
      noshow_payment_intent: intent.id,
      booking_status: 'no_show',
      payment_status: 'noshow_fee_paid',
      status: 'cancelled',
    }).eq('id', bookingId);

    return antwort({ ok: true, charged: gebuehr, paymentIntent: intent.id });
  } catch (err) {
    console.error('stripe-noshow-charge: unerwarteter Fehler', err);
    return antwort({ error: err.message }, 500);
  }
});
