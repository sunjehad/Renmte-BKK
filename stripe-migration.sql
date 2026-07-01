-- ============================================================
-- RENT ME BANGKOK — Stripe Payment Integration Migration
-- ============================================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_method       text DEFAULT 'card',
  ADD COLUMN IF NOT EXISTS payment_status       text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS booking_status       text DEFAULT 'pending_payment',
  ADD COLUMN IF NOT EXISTS stripe_session_id    text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id   text,
  ADD COLUMN IF NOT EXISTS stripe_payment_link  text,
  ADD COLUMN IF NOT EXISTS payment_qr_code      text,
  ADD COLUMN IF NOT EXISTS reservation_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at              timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_at          timestamptz;

CREATE INDEX IF NOT EXISTS bookings_payment_status_idx  ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS bookings_stripe_session_idx  ON bookings(stripe_session_id);
CREATE INDEX IF NOT EXISTS bookings_booking_status_idx  ON bookings(booking_status);
CREATE INDEX IF NOT EXISTS bookings_expires_idx         ON bookings(reservation_expires_at);

CREATE OR REPLACE VIEW public.availability AS
  SELECT
    booking_date,
    start_time,
    end_time,
    duration_hours,
    service_type,
    equipment_start_date,
    equipment_end_date,
    status,
    booking_status
  FROM bookings
  WHERE status <> 'cancelled'
    AND booking_status IN ('confirmed', 'cash_on_pickup', 'paid');

ALTER VIEW public.availability SET (security_invoker = false);
GRANT SELECT ON public.availability TO anon, authenticated;

CREATE OR REPLACE FUNCTION expire_pending_bookings()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE bookings
  SET
    booking_status = 'cancelled',
    status         = 'cancelled',
    payment_status = 'expired'
  WHERE
    booking_status = 'pending_payment'
    AND reservation_expires_at IS NOT NULL
    AND reservation_expires_at < now();
END;
$$;

-- ============================================================
-- RLS WORKAROUND — SECURITY DEFINER RPCs for guest bookings
-- ------------------------------------------------------------
-- The existing RLS policies on `bookings` are:
--   INSERT: WITH CHECK (true)                     → anyone can insert
--   SELECT: USING (is_admin() OR user_id=auth.uid()) → guests (user_id IS NULL,
--           auth.uid() IS NULL) can NEVER read their own row back
--   UPDATE: USING (is_admin())                      → guests can NEVER update
--
-- This means `.insert(payload).select().single()` (used throughout
-- booking.html) has ALWAYS failed for guest bookings with
-- "new row violates row-level security policy" — confirmed live
-- against production on 2026-06-28. It also means the new payment
-- flow's client-side status updates (cash confirm, card/qr method
-- tagging, QR payment polling) would fail the same way.
--
-- We do NOT relax the table-level SELECT/UPDATE policies (that would
-- make every guest's name/email/phone publicly readable via the
-- REST API). Instead these three SECURITY DEFINER functions expose
-- only the narrow operations the booking flow actually needs.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_booking(payload jsonb)
RETURNS bookings
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_row bookings;
BEGIN
  INSERT INTO bookings (
    user_id, guest_name, guest_email, guest_phone, service_type, service_subtype,
    booking_date, start_time, end_time, duration_hours,
    equipment_start_date, equipment_end_date, rental_days, equipment_items,
    participant_count, total_price, notes, source,
    payment_method, booking_status, status, reservation_expires_at
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
    CASE WHEN payload->>'reservation_expires_at' IS NOT NULL THEN (payload->>'reservation_expires_at')::timestamptz ELSE NULL END
  )
  RETURNING * INTO new_row;
  RETURN new_row;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_booking(jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_booking_payment(p_booking_id uuid, p_payment_method text)
RETURNS bookings
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  updated_row bookings;
BEGIN
  UPDATE bookings
  SET
    payment_method = p_payment_method,
    booking_status  = CASE WHEN p_payment_method = 'cash' THEN 'cash_on_pickup' ELSE booking_status END,
    status          = CASE WHEN p_payment_method = 'cash' THEN 'confirmed' ELSE status END,
    paid_at         = CASE WHEN p_payment_method = 'cash' THEN now() ELSE paid_at END,
    reservation_expires_at = CASE WHEN p_payment_method = 'cash' THEN NULL ELSE reservation_expires_at END
  WHERE id = p_booking_id
    AND booking_status = 'pending_payment'
  RETURNING * INTO updated_row;
  RETURN updated_row;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_booking_payment(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_booking_payment_status(p_booking_id uuid)
RETURNS TABLE(id uuid, booking_ref text, booking_status text, payment_qr_code text, stripe_payment_link text)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT id, booking_ref, booking_status, payment_qr_code, stripe_payment_link
  FROM bookings WHERE id = p_booking_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_booking_payment_status(uuid) TO anon, authenticated;

-- ============================================================
-- DOUBLE-BOOKING GUARD + AUTO-CLEANUP (added 2026-06-28)
-- ------------------------------------------------------------
-- Pending (unpaid) reservations intentionally do NOT block the
-- calendar — see the `availability` view above. That means two
-- guests can both be mid-checkout for the same slot at once.
-- This function cancels every other still-pending booking for
-- the same slot (room time-overlap, or shared equipment item +
-- date overlap) the moment one of them actually gets paid/confirmed.
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancel_competing_pending_bookings(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  b bookings;
BEGIN
  SELECT * INTO b FROM bookings WHERE id = p_booking_id;
  IF b.id IS NULL THEN RETURN; END IF;

  IF b.service_type IN ('studio_rental','podcast','podcast_setup') THEN
    UPDATE bookings o
    SET booking_status = 'cancelled', status = 'cancelled', payment_status = 'expired'
    WHERE o.id <> b.id
      AND o.booking_status = 'pending_payment'
      AND o.service_type IN ('studio_rental','podcast','podcast_setup')
      AND o.booking_date = b.booking_date
      AND o.start_time IS NOT NULL AND o.end_time IS NOT NULL
      AND b.start_time IS NOT NULL AND b.end_time IS NOT NULL
      AND NOT (o.end_time <= b.start_time OR o.start_time >= b.end_time);
  ELSIF b.service_type = 'equipment' THEN
    UPDATE bookings o
    SET booking_status = 'cancelled', status = 'cancelled', payment_status = 'expired'
    WHERE o.id <> b.id
      AND o.booking_status = 'pending_payment'
      AND o.service_type = 'equipment'
      AND o.equipment_start_date IS NOT NULL AND o.equipment_end_date IS NOT NULL
      AND b.equipment_start_date IS NOT NULL AND b.equipment_end_date IS NOT NULL
      AND NOT (o.equipment_end_date < b.equipment_start_date OR o.equipment_start_date > b.equipment_end_date)
      AND o.equipment_items && b.equipment_items;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.cancel_competing_pending_bookings(uuid) TO anon, authenticated, service_role;

-- update_booking_payment now also fires the guard above when a cash
-- booking is confirmed (the Stripe webhook calls the same guard for
-- card/QR payments — see stripe-webhook/index.ts).
CREATE OR REPLACE FUNCTION public.update_booking_payment(p_booking_id uuid, p_payment_method text)
RETURNS bookings
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  updated_row bookings;
BEGIN
  UPDATE bookings
  SET
    payment_method = p_payment_method,
    booking_status  = CASE WHEN p_payment_method = 'cash' THEN 'cash_on_pickup' ELSE booking_status END,
    status          = CASE WHEN p_payment_method = 'cash' THEN 'confirmed' ELSE status END,
    paid_at         = CASE WHEN p_payment_method = 'cash' THEN now() ELSE paid_at END,
    reservation_expires_at = CASE WHEN p_payment_method = 'cash' THEN NULL ELSE reservation_expires_at END
  WHERE id = p_booking_id
    AND booking_status = 'pending_payment'
  RETURNING * INTO updated_row;

  IF updated_row.id IS NOT NULL AND p_payment_method = 'cash' THEN
    PERFORM public.cancel_competing_pending_bookings(updated_row.id);
  END IF;

  RETURN updated_row;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_booking_payment(uuid, text) TO anon, authenticated;

-- Auto-expire stale pending_payment reservations every 10 minutes
-- (the function existed before but was never actually scheduled).
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.unschedule('expire-pending-bookings') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='expire-pending-bookings');
SELECT cron.schedule('expire-pending-bookings', '*/10 * * * *', $$SELECT expire_pending_bookings();$$);

-- expire_pending_bookings now also catches pre-Stripe-feature rows that
-- have no reservation_expires_at at all (anything pending_payment older
-- than 24h gets swept too, not just rows with an explicit expiry).
CREATE OR REPLACE FUNCTION expire_pending_bookings()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE bookings
  SET
    booking_status = 'cancelled',
    status         = 'cancelled',
    payment_status = 'expired'
  WHERE
    booking_status = 'pending_payment'
    AND (
      (reservation_expires_at IS NOT NULL AND reservation_expires_at < now())
      OR (reservation_expires_at IS NULL AND created_at < now() - interval '24 hours')
    );
END;
$$;
