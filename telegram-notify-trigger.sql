-- Zentraler Telegram-Alarm bei bestaetigten Buchungen.
--
-- Vorher rief nur der Stripe-Webhook Telegram direkt auf -- Cash-Buchungen
-- (update_booking_payment, stripe-migration.sql) und kuenftige neue
-- Zahlwege blieben stumm. Dieser Trigger sitzt auf der Tabelle selbst:
-- er feuert bei jedem Uebergang von booking_status nach 'paid' oder
-- 'cash_on_pickup', egal welcher Code-Pfad ihn ausgeloest hat.
--
-- Enthaelt keine Geheimnisse -- net.http_post ruft nur die URL der Edge
-- Function notify-booking-webhook auf, die TELEGRAM_BOT_TOKEN und
-- TELEGRAM_CHAT_ID selbst aus den Supabase-Secrets liest.

create extension if not exists pg_net;

create or replace function public.notify_booking_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.booking_status in ('paid', 'cash_on_pickup')
     and (tg_op = 'INSERT' or old.booking_status is distinct from new.booking_status) then
    perform net.http_post(
      url     := 'https://nghsyxwhczvwaorssgoh.supabase.co/functions/v1/notify-booking-webhook',
      body    := to_jsonb(new),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_notify_paid on public.bookings;
create trigger bookings_notify_paid
after insert or update on public.bookings
for each row
execute function public.notify_booking_paid();
