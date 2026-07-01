import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
  const body = await req.text();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
  try {
    if (event.type === 'checkout.session.completed') {
      // Card payments via Stripe Checkout
      const session = event.data.object;
      const bookingId = session.metadata?.booking_id;
      if (bookingId) {
        await supabase.from('bookings').update({
          booking_status: 'paid', payment_status: 'paid', status: 'confirmed',
          stripe_session_id: session.id, stripe_payment_intent: session.payment_intent,
          stripe_customer_id: session.customer, paid_at: new Date().toISOString()
        }).eq('id', bookingId);
        await supabase.rpc('cancel_competing_pending_bookings', { p_booking_id: bookingId });
      }
    } else if (event.type === 'payment_intent.succeeded') {
      // PromptPay QR payments
      const intent = event.data.object;
      const bookingId = intent.metadata?.booking_id;
      if (bookingId && intent.payment_method_types?.includes('promptpay')) {
        await supabase.from('bookings').update({
          booking_status: 'paid', payment_status: 'paid', status: 'confirmed',
          stripe_payment_intent: intent.id, paid_at: new Date().toISOString()
        }).eq('id', bookingId);
        await supabase.rpc('cancel_competing_pending_bookings', { p_booking_id: bookingId });
      }
    } else if (event.type === 'checkout.session.expired') {
      const session = event.data.object;
      const bookingId = session.metadata?.booking_id;
      if (bookingId) {
        await supabase.from('bookings').update({
          booking_status: 'cancelled', payment_status: 'expired', status: 'cancelled'
        }).eq('id', bookingId).eq('booking_status', 'pending_payment');
      }
    } else if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object;
      await supabase.from('bookings').update({
        booking_status: 'failed', payment_status: 'failed', status: 'cancelled'
      }).eq('stripe_payment_intent', intent.id);
    } else if (event.type === 'charge.refunded') {
      const charge = event.data.object;
      if (charge.payment_intent) {
        await supabase.from('bookings').update({
          booking_status: 'refunded', payment_status: 'refunded', status: 'cancelled',
          refunded_at: new Date().toISOString()
        }).eq('stripe_payment_intent', charge.payment_intent);
      }
    }
  } catch (err) {
    return new Response(`Handler error: ${err.message}`, { status: 500 });
  }
  return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
