-- ============================================================
-- RENT ME BANGKOK — Unterschriebene Mietvertraege (2026-09-15)
-- Ausgefuehrt am 2026-09-15 (Andy, supabase db query --linked). Nicht erneut laufen lassen.
--
-- Eine eigene Tabelle statt Spalten an `bookings`: die Zeile traegt
-- Unterschriften und zwei Fotos (Ausweis, Kunde) als Daten-URLs, zusammen
-- einige hundert KB. `admin.html` laedt `bookings` komplett und alle 60 s neu;
-- diese Last gehoert nicht dorthin. Und Ausweisfotos sind nur fuer Admins --
-- `bookings` darf ein angemeldeter Kunde fuer die eigene Buchung lesen.
--
-- Der Vertragstext selbst liegt NICHT hier, sondern versioniert in
-- `vertrag.js`; gespeichert werden nur die Daten und die Version.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rental_contracts (
  booking_id  uuid PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE,
  version     text NOT NULL,
  signed_at   timestamptz NOT NULL DEFAULT now(),
  data        jsonb NOT NULL,
  created_by  uuid DEFAULT auth.uid()
);

ALTER TABLE public.rental_contracts ENABLE ROW LEVEL SECURITY;

-- Nur Admins: lesen, anlegen, ersetzen. Kein Gastzugriff, auch nicht lesend.
CREATE POLICY "Admin read contracts"
  ON public.rental_contracts FOR SELECT USING ( public.is_admin() );
CREATE POLICY "Admin insert contracts"
  ON public.rental_contracts FOR INSERT WITH CHECK ( public.is_admin() );
CREATE POLICY "Admin update contracts"
  ON public.rental_contracts FOR UPDATE USING ( public.is_admin() );
