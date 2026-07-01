import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json();
    const { bookingId, bookingRef, amount, currency = 'thb', customerName, customerEmail, description, successUrl, cancelUrl } = body;
    if (!bookingId || !amount || !successUrl || !cancelUrl) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{ price_data: { currency, unit_amount: Math.round(amount * 100), product_data: { name: description || 'Rent Me Bangkok Booking', description: `Booking Ref: ${bookingRef}` } }, quantity: 1 }],
      customer_email: customerEmail || undefined,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { booking_id: bookingId, booking_ref: bookingRef, customer_name: customerName || '' },
    });
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await supabase.from('bookings').update({ stripe_session_id: session.id, payment_status: 'processing', payment_method: 'card' }).eq('id', bookingId);
    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
