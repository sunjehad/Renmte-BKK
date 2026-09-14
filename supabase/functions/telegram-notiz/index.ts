// Freier Text an Andys Telegram - fuer Wachter ausserhalb der Buchungsstrecke
// (zuerst: stuendlicher Gmail-Waechter als Claude-Cloud-Routine, 2026-09-14).
//
// Der Bot-Token bleibt in den Supabase-Secrets (TELEGRAM_BOT_TOKEN,
// TELEGRAM_CHAT_ID - dieselben wie notify-booking-webhook). Aufrufer kennen
// nur TELEGRAM_NOTIZ_KEY und schicken ihn im Header `x-notiz-key`.
// Schlimmstenfalls, wenn der Schluessel leakt: Spam auf Andys Telegram.
//
// Deployed with --no-verify-jwt: die Routine hat keine Supabase-Sitzung.
//
// Aufruf:  POST {"text": "..."}  mit Header x-notiz-key: <TELEGRAM_NOTIZ_KEY>

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  const key = Deno.env.get('TELEGRAM_NOTIZ_KEY');
  if (!key || req.headers.get('x-notiz-key') !== key) {
    return new Response('forbidden', { status: 403 });
  }
  let text = '';
  try {
    text = String((await req.json()).text ?? '').trim();
  } catch (_e) {
    return new Response('bad json', { status: 400 });
  }
  if (!text) return new Response('empty', { status: 400 });

  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
  if (!token || !chatId) return new Response('not configured', { status: 500 });

  const antwort = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000) }),
  });
  return new Response(antwort.ok ? 'ok' : 'telegram error', { status: antwort.ok ? 200 : 502 });
});
