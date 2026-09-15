-- ============================================================
-- RENT ME BANGKOK — No-Show-Sicherung bei Barzahlung (2026-09-15)
-- Ausgefuehrt am 2026-09-15 (Andy). Nicht erneut laufen lassen.
--
-- Andy: Barzahlung bei Abholung bleibt, aber wer reserviert und nicht kommt,
-- zahlt 50 %. Absicherung: der Kunde unterschreibt online die
-- Reservierungsbedingungen (vertrag.js, Version R1) und hinterlegt seine
-- Karte bei Stripe (Checkout im Modus "setup", nichts wird abgebucht).
-- Bei No-Show bucht ein Admin die 50 % ab (Function stripe-noshow-charge).
--
-- Gilt fuer Dienste MIT Termin: studio_rental, equipment
-- (preise.ts DIENSTE_MIT_NO_SHOW_SICHERUNG). Cut Only und Reel haben keinen
-- Termin und bleiben bei der alten Barzahlung.
-- ============================================================

-- 1) Karte und No-Show an der Buchung ---------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS card_setup_session_id   text,
  ADD COLUMN IF NOT EXISTS card_payment_method     text,
  ADD COLUMN IF NOT EXISTS card_saved_at           timestamptz,
  ADD COLUMN IF NOT EXISTS noshow_fee_amount       numeric(10,2),
  ADD COLUMN IF NOT EXISTS noshow_charged_at       timestamptz,
  ADD COLUMN IF NOT EXISTS noshow_payment_intent   text;

-- 2) Die online unterschriebene Reservierung ---------------------------------
CREATE TABLE IF NOT EXISTS public.reservation_agreements (
  booking_id   uuid PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE,
  version      text NOT NULL,
  signed_name  text NOT NULL,
  signature    text NOT NULL,
  signed_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reservation_agreements ENABLE ROW LEVEL SECURITY;

-- Lesen nur Admins. Schreiben ausschliesslich ueber sign_reservation (unten),
-- darum keine INSERT-Policy: RLS verweigert direkte Schreibzugriffe.
CREATE POLICY "Admin read reservation agreements"
  ON public.reservation_agreements FOR SELECT USING ( public.is_admin() );

-- 3) Unterschreiben ohne Anmeldung, aber nur fuer die eigene frische Buchung --
-- Die Buchungs-ID ist eine UUID, die nur der Browser kennt, der die Buchung
-- gerade angelegt hat. Zusaetzlich: noch unbezahlt, hoechstens 2 h alt, noch
-- nicht unterschrieben, Dienst mit Termin, plausibler Name und eine
-- PNG-Unterschrift in vernuenftiger Groesse.
CREATE OR REPLACE FUNCTION public.sign_reservation(
  p_booking_id uuid, p_name text, p_signature text, p_version text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  b bookings;
BEGIN
  SELECT * INTO b FROM bookings WHERE id = p_booking_id;
  IF b.id IS NULL
     OR b.booking_status <> 'pending_payment'
     OR b.created_at < now() - interval '2 hours'
     OR b.service_type NOT IN ('studio_rental', 'equipment') THEN
    RETURN false;
  END IF;
  IF EXISTS (SELECT 1 FROM reservation_agreements WHERE booking_id = p_booking_id) THEN
    RETURN true;  -- schon unterschrieben (z. B. zweiter Klick): kein Fehler, nichts ueberschreiben
  END IF;
  IF length(trim(coalesce(p_name, ''))) NOT BETWEEN 2 AND 120
     OR coalesce(p_signature, '') NOT LIKE 'data:image/png;base64,%'
     OR length(p_signature) > 400000
     OR coalesce(p_version, '') !~ '^R[0-9]+$' THEN
    RETURN false;
  END IF;
  INSERT INTO reservation_agreements (booking_id, version, signed_name, signature)
  VALUES (p_booking_id, p_version, trim(p_name), p_signature);
  RETURN true;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.sign_reservation(uuid, text, text, text) TO anon, authenticated;

-- 4) Barzahlung nur noch MIT hinterlegter Karte (bei Diensten mit Termin) ----
-- Grundlage ist die LIVE-Fassung vom 2026-09-15 (pg_get_functiondef).
-- Neu ist nur die letzte WHERE-Bedingung. Ohne sie koennte jeder die Karte
-- umgehen, indem er diese Funktion direkt aufruft -- sie ist fuer anon
-- freigegeben. Die Karte setzt ausschliesslich stripe-webhook (Service-Rolle).
CREATE OR REPLACE FUNCTION public.update_booking_payment(p_booking_id uuid, p_payment_method text)
 RETURNS bookings
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
    AND (p_payment_method <> 'cash'
         OR service_type NOT IN ('studio_rental', 'equipment')
         OR card_payment_method IS NOT NULL)
  RETURNING * INTO updated_row;

  IF updated_row.id IS NOT NULL AND p_payment_method = 'cash' THEN
    PERFORM public.cancel_competing_pending_bookings(updated_row.id);
  END IF;

  RETURN updated_row;
END;
$function$;
