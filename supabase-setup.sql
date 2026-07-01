-- ============================================================
-- RENT ME BANGKOK — Supabase Database Setup
-- Paste this entire file into the Supabase SQL editor and run.
-- Safe to run even if tables already exist (drops & recreates).
-- ============================================================

-- ── CLEAN SLATE (drop old tables if they exist) ───────────
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS update_updated_at();

-- ── PROFILES ──────────────────────────────────────────────
CREATE TABLE profiles (
  id         uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  first_name text,
  last_name  text,
  phone      text,
  email      text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read profiles"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Anyone can insert profile"
  ON profiles FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- ── BOOKINGS ──────────────────────────────────────────────
CREATE TABLE bookings (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              uuid REFERENCES profiles(id) ON DELETE SET NULL,

  -- Guest fields
  guest_name           text,
  guest_email          text,
  guest_phone          text,

  -- Booking details
  service_type         text NOT NULL,
  service_subtype      text,
  booking_date         date,
  start_time           text,
  end_time             text,
  duration_hours       int,

  -- Equipment-specific
  equipment_start_date date,
  equipment_end_date   date,
  rental_days          int,
  equipment_items      text[],

  -- Podcast-specific
  participant_count    int,

  -- Pricing
  total_price          numeric(10,2),
  currency             text DEFAULT 'THB',

  -- Status & metadata
  status               text DEFAULT 'confirmed',
  source               text DEFAULT 'website',
  notes                text,
  admin_notes          text,
  booking_ref          text UNIQUE DEFAULT ('RMB-' || upper(substring(gen_random_uuid()::text, 1, 8))),
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert booking"
  ON bookings FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read bookings"
  ON bookings FOR SELECT USING (true);

CREATE POLICY "Anyone can update bookings"
  ON bookings FOR UPDATE USING (true);

-- ── AUTO-UPDATE updated_at ────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── AUTO-CREATE PROFILE ON SIGNUP ─────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO profiles (id, email, first_name, last_name, phone)
    VALUES (
      NEW.id,
      NEW.email,
      NEW.raw_user_meta_data->>'first_name',
      NEW.raw_user_meta_data->>'last_name',
      NEW.raw_user_meta_data->>'phone'
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- never block signup if profile insert fails
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── INDEXES ───────────────────────────────────────────────
CREATE INDEX bookings_date_idx        ON bookings(booking_date);
CREATE INDEX bookings_user_id_idx     ON bookings(user_id);
CREATE INDEX bookings_guest_email_idx ON bookings(guest_email);
CREATE INDEX bookings_status_idx      ON bookings(status);
CREATE INDEX bookings_ref_idx         ON bookings(booking_ref);
CREATE INDEX bookings_created_idx     ON bookings(created_at DESC);

-- ── DONE ─────────────────────────────────────────────────
-- All tables, policies, triggers and indexes are ready.
