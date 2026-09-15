-- ============================================================
-- RENT ME BANGKOK — Rueckgabe von Mietgeraeten (2026-09-15)
-- EINMAL ausfuehren. Noch NICHT ausgefuehrt.
--
-- Wann kam das Geraet zurueck, in welchem Zustand, wie viel Kaution wurde
-- zurueckgegeben oder einbehalten, was wurde zusaetzlich berechnet.
-- Eigene Tabelle, weil rental_contracts nach der Unterschrift unveraenderlich
-- ist. Eine Rueckgabe je Buchung; wie der Vertrag nachtraeglich nicht
-- aenderbar (keine UPDATE-Policy).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rental_returns (
  booking_id        uuid PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE,
  returned_at       timestamptz NOT NULL,
  condition         text NOT NULL CHECK (condition IN ('ok', 'schaden', 'fehlt')),
  notes             text,
  deposit_kept      numeric(10,2) NOT NULL DEFAULT 0 CHECK (deposit_kept >= 0),
  deposit_returned  numeric(10,2) NOT NULL DEFAULT 0 CHECK (deposit_returned >= 0),
  extra_charge      numeric(10,2) NOT NULL DEFAULT 0 CHECK (extra_charge >= 0),
  recorded_at       timestamptz NOT NULL DEFAULT now(),
  recorded_by       uuid DEFAULT auth.uid()
);

ALTER TABLE public.rental_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read returns"
  ON public.rental_returns FOR SELECT USING ( public.is_admin() );
CREATE POLICY "Admin insert returns"
  ON public.rental_returns FOR INSERT WITH CHECK ( public.is_admin() );
