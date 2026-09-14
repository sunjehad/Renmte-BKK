-- Telegram-Alarm auch fuer Anfragen und Buchungen ohne Preis (2026-09-14).
--
-- Bis dahin feuerte `bookings_notify_paid` (telegram-notify-trigger.sql) nur
-- bei 'paid' und 'cash_on_pickup'. Anfragen fuer Drohne und Full Podcast
-- Service ('enquiry') und preisfreie Buchungen ('confirmed') kamen auf
-- Telegram nie an.
--
-- **'pending_payment' bleibt bewusst draussen**: jede angefangene und
-- abgebrochene Kartenzahlung legt eine solche Zeile an; der Alarm wuerde
-- mit Buchungen fluten, die nie zustande kommen. Wird sie bezahlt, meldet
-- sie sich ueber 'paid'.
--
-- Nur die Funktion wird ersetzt; der Trigger selbst bleibt, wie er ist.
-- Reihenfolge: ERST notify-booking-webhook deployen (kennt 'enquiry'),
-- DANN diese Datei ausfuehren.

create or replace function public.notify_booking_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.booking_status in ('paid', 'cash_on_pickup', 'enquiry', 'confirmed')
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
