-- ============================================================
-- RENT ME BANGKOK — Zustimmung zu den Mietbedingungen + unveraenderliche
-- Vertraege (2026-09-15). Ausgefuehrt am 2026-09-15 (Andy). Nicht erneut laufen lassen.
--
-- 1) `bookings` merkt sich, welche Bedingungen beim Buchen angehakt wurden.
--    Die Version kommt vom Browser (vertrag.js), der ZEITPUNKT aus der
--    Datenbank -- einer Browseruhr glaubt man im Streitfall nicht.
-- 2) `create_booking` uebernimmt beides. Grundlage ist die LIVE-Fassung,
--    am 2026-09-15 per pg_get_functiondef gelesen (identisch mit
--    stripe-migration.sql Z. 79 ff.); geaendert sind nur die zwei Spalten.
-- 3) Unterschriebene Vertraege sind nicht mehr aenderbar: die UPDATE-Policy
--    auf `rental_contracts` entfaellt. Ohne Policy verweigert RLS jedes
--    UPDATE, auch fuer Admins. Korrekturen = neuer Vertrag nur ueber die
--    Datenbankkonsole, bewusst.
-- ============================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS terms_version     text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

CREATE OR REPLACE FUNCTION public.create_booking(payload jsonb)
 RETURNS bookings
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  new_row bookings;
BEGIN
  INSERT INTO bookings (
    user_id, guest_name, guest_email, guest_phone, service_type, service_subtype,
    booking_date, start_time, end_time, duration_hours,
    equipment_start_date, equipment_end_date, rental_days, equipment_items,
    participant_count, total_price, notes, source,
    payment_method, booking_status, status, reservation_expires_at,
    terms_version, terms_accepted_at
  )
  VALUES (
    CASE WHEN payload->>'user_id' IS NOT NULL THEN (payload->>'user_id')::uuid ELSE NULL END,
    payload->>'guest_name', payload->>'guest_email', payload->>'guest_phone',
    payload->>'service_type', payload->>'service_subtype',
    CASE WHEN payload->>'booking_date' IS NOT NULL THEN (payload->>'booking_date')::date ELSE NULL END,
    payload->>'start_time', payload->>'end_time',
    CASE WHEN payload->>'duration_hours' IS NOT NULL THEN (payload->>'duration_hours')::int ELSE NULL END,
    CASE WHEN payload->>'equipment_start_date' IS NOT NULL THEN (payload->>'equipment_start_date')::date ELSE NULL END,
    CASE WHEN payload->>'equipment_end_date' IS NOT NULL THEN (payload->>'equipment_end_date')::date ELSE NULL END,
    CASE WHEN payload->>'rental_days' IS NOT NULL THEN (payload->>'rental_days')::int ELSE NULL END,
    CASE WHEN jsonb_typeof(payload->'equipment_items') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(payload->'equipment_items')) ELSE NULL END,
    CASE WHEN payload->>'participant_count' IS NOT NULL THEN (payload->>'participant_count')::int ELSE NULL END,
    CASE WHEN payload->>'total_price' IS NOT NULL THEN (payload->>'total_price')::numeric ELSE NULL END,
    payload->>'notes', payload->>'source',
    payload->>'payment_method',
    coalesce(payload->>'booking_status', 'pending_payment'),
    coalesce(payload->>'status', 'pending'),
    CASE WHEN payload->>'reservation_expires_at' IS NOT NULL THEN (payload->>'reservation_expires_at')::timestamptz ELSE NULL END,
    payload->>'terms_version',
    CASE WHEN payload->>'terms_version' IS NOT NULL THEN now() ELSE NULL END
  )
  RETURNING * INTO new_row;
  RETURN new_row;
END;
$function$;

DROP POLICY IF EXISTS "Admin update contracts" ON public.rental_contracts;
