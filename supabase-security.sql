-- ============================================================
-- RENT ME BANGKOK — Security Lockdown
-- Run this ONCE in the Supabase SQL editor.
-- Locks down bookings + profiles so only an admin can read all
-- data, while keeping guest booking and public availability working.
-- ============================================================

-- ── 1. ADMIN FLAG ─────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Helper: is the currently logged-in user an admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  );
$$;

-- ── 2. BOOKINGS POLICIES ──────────────────────────────────
DROP POLICY IF EXISTS "Anyone can insert booking" ON bookings;
DROP POLICY IF EXISTS "Anyone can read bookings"  ON bookings;
DROP POLICY IF EXISTS "Anyone can update bookings" ON bookings;

-- Anyone (guest or logged-in) may CREATE a booking
CREATE POLICY "Insert booking"
  ON bookings FOR INSERT WITH CHECK (true);

-- Read: admins see everything, customers see only their own
CREATE POLICY "Read own or admin"
  ON bookings FOR SELECT
  USING ( public.is_admin() OR user_id = auth.uid() );

-- Update / cancel: admins only
CREATE POLICY "Admin update bookings"
  ON bookings FOR UPDATE
  USING ( public.is_admin() );

-- ── 3. PROFILES POLICIES ──────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read profiles"  ON profiles;
DROP POLICY IF EXISTS "Anyone can insert profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Read own profile or admin"
  ON profiles FOR SELECT
  USING ( public.is_admin() OR id = auth.uid() );

CREATE POLICY "Insert own profile"
  ON profiles FOR INSERT WITH CHECK ( id = auth.uid() );

CREATE POLICY "Update own profile or admin"
  ON profiles FOR UPDATE
  USING ( public.is_admin() OR id = auth.uid() );

-- ── 4. PUBLIC AVAILABILITY VIEW (no customer data) ────────
-- The booking page needs to know which dates/times are taken,
-- but must NOT expose names, emails or phone numbers.
-- This view exposes only scheduling columns and bypasses the
-- bookings RLS, so anonymous visitors can read availability.
CREATE OR REPLACE VIEW public.availability AS
  SELECT
    booking_date,
    start_time,
    end_time,
    duration_hours,
    service_type,
    equipment_start_date,
    equipment_end_date,
    status
  FROM bookings
  WHERE status <> 'cancelled';

-- Run the view with the owner's rights so RLS on bookings
-- does not hide rows from anonymous visitors.
ALTER VIEW public.availability SET (security_invoker = false);

GRANT SELECT ON public.availability TO anon, authenticated;

-- ── 5. MAKE YOURSELF ADMIN ────────────────────────────────
-- Replace the email below with the account you log in to the
-- admin dashboard with, then this promotes it to admin.
UPDATE profiles
  SET is_admin = true
  WHERE email = 'rentmebkk@gmail.com';

-- ── DONE ──────────────────────────────────────────────────
