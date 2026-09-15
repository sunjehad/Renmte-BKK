// Karte als No-Show-Sicherheit hinterlegen (seit 2026-09-15).
//
// Barzahlung bei Abholung bleibt. Fuer Dienste mit Termin (Studio, Geraete)
// hinterlegt der Kunde vorher seine Karte: Stripe Checkout im Modus "setup"
// -- es wird NICHTS abgebucht. Bestaetigt wird die Buchung erst, wenn
// stripe-webhook den abgeschlossenen Setup meldet (checkout.session.completed,
// mode "setup"). Bei No-Show bucht stripe-noshow-charge 50 % ab.
//
// Voraussetzungen, alle serverseitig geprueft:
//   - Buchung existiert, ist noch pending_payment
//   - Dienst mit Termin (DIENSTE_MIT_NO_SHOW_SICHERUNG)
//   - Reservierungsbedingungen unterschrieben (reservation_agreements)
//   - Preis serverseitig ermittelbar -- die angezeigte Gebuehr kommt aus
//     preise.ts, nie aus dem Browser (R-010)
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  DIENSTE_MIT_NO_SHOW_SICHERUNG,
  ermittleBetrag,
  kundentext,
  noShowGebuehr,
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

const SPALTEN =
  'id, booking_ref, service_type, service_subtype, duration_hours, ' +
  'equipment_start_date, equipment_end_date, equipment_items, ' +
  'booking_status, payment_status, guest_name, guest_email, stripe_customer_id';

function antwort(inhalt: unknown, status = 200) {
  return new Response(JSON.stringify(inhalt), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { bookingId, successUrl, cancelUrl } = await req.json();
    if (!bookingId || !successUrl || !cancelUrl) {
      return antwort({ error: 'Missing required fields' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: buchung, error } = await supabase
      .from('bookings').select(SPALTEN).eq('id', bookingId).maybeSingle();
    if (error) return antwort({ error: 'Could not load the booking.' }, 500);
    if (!buchung) return antwort({ error: 'Booking not found.' }, 404);

    if (buchung.booking_status !== 'pending_payment') {
      return antwort({ error: 'This booking can no longer be reserved. Please start a new booking.' }, 409);
    }
    if (!DIENSTE_MIT_NO_SHOW_SICHERUNG.includes(buchung.service_type)) {
      return antwort({ error: 'No card guarantee is needed for this service.' }, 422);
    }

    const { data: vereinbarung } = await supabase
      .from('reservation_agreements').select('booking_id').eq('booking_id', bookingId).maybeSingle();
    if (!vereinbarung) {
      return antwort({ error: 'Please sign the reservation terms first.' }, 422);
    }

    const ergebnis = ermittleBetrag(buchung as Buchung);
    if (!ergebnis.ok) {
      console.error(`stripe-card-guarantee: kein Preis (${ergebnis.code}) fuer ${bookingId}: ${ergebnis.grund}`);
      return antwort({ error: kundentext(ergebnis.code), code: ergebnis.code }, 422);
    }
    const gebuehr = noShowGebuehr(ergebnis.betrag);

    // Stripe braucht einen Kunden, damit die Karte spaeter ohne den Kunden
    // (off_session) belastet werden kann.
    let kunde = buchung.stripe_customer_id as string | null;
    if (!kunde) {
      const neu = await stripe.customers.create({
        email: buchung.guest_email || undefined,
        name: buchung.guest_name || undefined,
        metadata: { booking_id: bookingId, booking_ref: buchung.booking_ref ?? '' },
      });
      kunde = neu.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'setup',
      payment_method_types: ['card'],
      customer: kunde,
      success_url: successUrl,
      cancel_url: cancelUrl,
      setup_intent_data: {
        description: `No-show guarantee for booking ${buchung.booking_ref ?? ''}`,
        metadata: { booking_id: bookingId, zweck: 'noshow_guarantee' },
      },
      custom_text: {
        submit: {
          message: `Nothing is charged now. You pay in cash when you arrive. ` +
            `Only if you do not show up, a no-show fee of THB ${gebuehr.toLocaleString('en-US')} is charged to this card.`,
        },
      },
      metadata: {
        booking_id: bookingId,
        booking_ref: buchung.booking_ref ?? '',
        zweck: 'noshow_guarantee',
        noshow_gebuehr: String(gebuehr),
      },
    });

    await supabase.from('bookings').update({
      card_setup_session_id: session.id,
      stripe_customer_id: kunde,
      payment_method: 'cash',
      payment_status: 'card_guarantee_pending',
      noshow_fee_amount: gebuehr,
    }).eq('id', bookingId);

    return antwort({ url: session.url, noShowFee: gebuehr });
  } catch (err) {
    console.error('stripe-card-guarantee: unerwarteter Fehler', err);
    return antwort({ error: err.message }, 500);
  }
});
