// Called by the `bookings_notify_paid` Postgres trigger (see
// telegram-notify-trigger.sql), not by the client or Stripe directly. Fires
// whenever a booking's `booking_status` transitions into 'paid' or
// 'cash_on_pickup' -- covers the Stripe webhook, the cash RPC, and any
// future payment path, from one place instead of one call per path.
//
// Deployed with --no-verify-jwt: pg_net's net.http_post has no Supabase
// session to attach a JWT to. Worst case if the URL leaks is spam alerts on
// Andy's Telegram, not a financial or data risk, so no shared secret guards
// this endpoint.
//
// 2026-09-14: Die Nachricht traegt jetzt alles, was man zum Handeln braucht
// (Kontakt, Uhrzeit bis, Personen, Betrag, Anzahlung, Notizen), statt nur
// Service, Name, Datum und Ref. Der Trigger schickt die ganze Zeile
// (`to_jsonb(new)`), es wird also nichts nachgeladen. Bis dahin kam dieser
// Code nur aus dem Zweig `telegram-alerts-db-trigger` (live seit 13.08.).

import { nachricht } from '../_shared/telegram.ts';

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const booking = payload.record ?? payload; // supports raw row or {record: row}
    const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
    if (!token || !chatId || !booking) return new Response('ok');

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: nachricht(booking) }),
    });
  } catch (_err) {
    // Best-effort. The trigger fired fire-and-forget via pg_net; nothing to retry here.
  }
  return new Response('ok');
});
