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
    const { bookingId, description, customerEmail, customerName } = body;
    const gemeldeterBetrag = body.amount;

    if (!bookingId) {
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
      console.error('stripe-paymentlink: Buchung nicht lesbar', bookingId, leseFehler.message);
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
      // Fail-closed: lieber kein QR-Code als ein QR-Code ueber 1 THB.
      console.error(
        `stripe-paymentlink: abgelehnt (${ergebnis.code}) fuer Buchung ` +
        `${bookingId}: ${ergebnis.grund}`,
      );
      return antwort({ error: kundentext(ergebnis.code), code: ergebnis.code }, 422);
    }

    if (abweichung) {
      console.warn(`stripe-paymentlink: Betragsabweichung bei ${bookingId}: ${abweichung}`);
    }

    const buchungsNr = buchung.booking_ref ?? '';

    // Schritt 1: PaymentIntent fuer PromptPay
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(ergebnis.betrag * 100),
      currency: WAEHRUNG,
      payment_method_types: ['promptpay'],
      metadata: {
        booking_id: bookingId,
        booking_ref: buchungsNr,
        preis_grundlage: ergebnis.grundlage,
      },
      description: description || `Rent Me Bangkok — ${buchungsNr}`,
    });

    // Schritt 2: PromptPay-Zahlungsmittel mit Rechnungsanschrift
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'promptpay',
      billing_details: {
        email: buchung.guest_email || customerEmail || 'guest@rentme-bkk.com',
        name: buchung.guest_name || customerName || 'Guest',
      },
    });

    // Schritt 3: Bestaetigen, um den QR-Code zu erhalten
    const confirmed = await stripe.paymentIntents.confirm(paymentIntent.id, {
      payment_method: paymentMethod.id,
    });

    const qrData = (confirmed.next_action as any)?.promptpay_display_qr_code;
    if (!qrData) {
      throw new Error('PromptPay QR code not returned by Stripe');
    }

    await supabase.from('bookings').update({
      stripe_payment_intent: confirmed.id,
      payment_qr_code: qrData.image_url_png,
      stripe_payment_link: null,
      payment_status: 'processing',
      payment_method: 'qr',
    }).eq('id', bookingId);

    return antwort({
      paymentIntentId: confirmed.id,
      qrImageUrl: qrData.image_url_png,
      qrRawData: qrData.data,
    });

  } catch (err) {
    console.error('stripe-paymentlink: unerwarteter Fehler', err);
    return antwort({ error: err.message }, 500);
  }
});
