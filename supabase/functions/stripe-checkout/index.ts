import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  kundentext,
  pruefeGemeldetenBetrag,
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

/** Die Spalten, aus denen sich der Preis ergibt -- mehr wird nicht gelesen. */
const PREIS_SPALTEN =
  'id, booking_ref, service_type, service_subtype, duration_hours, ' +
  'equipment_start_date, equipment_end_date, equipment_items, ' +
  'booking_status, payment_status, guest_name, guest_email';

function antwort(inhalt: unknown, status = 200) {
  return new Response(JSON.stringify(inhalt), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json();
    // `amount` und `currency` werden bewusst NICHT mehr entgegengenommen.
    // `gemeldeterBetrag` dient nur noch dem Protokoll (siehe unten).
    const { bookingId, customerName, customerEmail, description, successUrl, cancelUrl } = body;
    const gemeldeterBetrag = body.amount;

    if (!bookingId || !successUrl || !cancelUrl) {
      return antwort({ error: 'Missing required fields' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Der Preis wird serverseitig ermittelt (docs/todo.md T-1) ──────────
    const { data: buchung, error: leseFehler } = await supabase
      .from('bookings')
      .select(PREIS_SPALTEN)
      .eq('id', bookingId)
      .maybeSingle();

    if (leseFehler) {
      console.error('stripe-checkout: Buchung nicht lesbar', bookingId, leseFehler.message);
      return antwort({ error: 'Could not load the booking.' }, 500);
    }
    if (!buchung) {
      return antwort({ error: 'Booking not found.' }, 404);
    }

    const { ergebnis, abweichung } = pruefeGemeldetenBetrag(
      buchung as Buchung,
      gemeldeterBetrag,
    );

    if (!ergebnis.ok) {
      // Fail-closed: kein Rueckfall auf den Wert aus dem Browser.
      console.error(
        `stripe-checkout: abgelehnt (${ergebnis.code}) fuer Buchung ` +
        `${bookingId}: ${ergebnis.grund}`,
      );
      return antwort({ error: kundentext(ergebnis.code), code: ergebnis.code }, 422);
    }

    if (abweichung) {
      // Kein Abbruch: ein veralteter Browser-Tab oder eine nachtraeglich
      // geaenderte Preistafel erzeugen dieselbe Meldung wie ein Angriff.
      // Eingezogen wird ohnehin der errechnete Betrag -- der Eintrag hier ist
      // die Spur, an der sich ein Angriff erkennen laesst.
      console.warn(`stripe-checkout: Betragsabweichung bei ${bookingId}: ${abweichung}`);
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: WAEHRUNG,
          unit_amount: Math.round(ergebnis.betrag * 100),
          product_data: {
            name: description || 'Rent Me Bangkok Booking',
            description: `Booking Ref: ${buchung.booking_ref ?? ''}`,
          },
        },
        quantity: 1,
      }],
      customer_email: buchung.guest_email || customerEmail || undefined,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        booking_id: bookingId,
        booking_ref: buchung.booking_ref ?? '',
        customer_name: buchung.guest_name || customerName || '',
        // Damit im Nachhinein nachvollziehbar ist, wie der Betrag zustande
        // kam -- ohne Griff in die Datenbank.
        preis_grundlage: ergebnis.grundlage,
      },
    });

    await supabase.from('bookings').update({
      stripe_session_id: session.id,
      payment_status: 'processing',
      payment_method: 'card',
    }).eq('id', bookingId);

    return antwort({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('stripe-checkout: unerwarteter Fehler', err);
    return antwort({ error: err.message }, 500);
  }
});
