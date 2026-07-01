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
    const { bookingId, bookingRef, amount, currency = 'thb', description, customerEmail, customerName } = body;

    // Step 1: Create PaymentIntent with PromptPay
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      payment_method_types: ['promptpay'],
      metadata: { booking_id: bookingId, booking_ref: bookingRef },
      description: description || `Rent Me Bangkok — ${bookingRef}`,
    });

    // Step 2: Create PromptPay PaymentMethod with required billing email
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'promptpay',
      billing_details: {
        email: customerEmail || 'guest@rentme-bkk.com',
        name: customerName || 'Guest',
      },
    });

    // Step 3: Confirm to get QR code
    const confirmed = await stripe.paymentIntents.confirm(paymentIntent.id, {
      payment_method: paymentMethod.id,
    });

    const qrData = (confirmed.next_action as any)?.promptpay_display_qr_code;
    if (!qrData) {
      throw new Error('PromptPay QR code not returned by Stripe');
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await supabase.from('bookings').update({
      stripe_payment_intent: confirmed.id,
      payment_qr_code: qrData.image_url_png,
      stripe_payment_link: null,
      payment_status: 'processing',
      payment_method: 'qr',
    }).eq('id', bookingId);

    return new Response(JSON.stringify({
      paymentIntentId: confirmed.id,
      qrImageUrl: qrData.image_url_png,
      qrRawData: qrData.data,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
