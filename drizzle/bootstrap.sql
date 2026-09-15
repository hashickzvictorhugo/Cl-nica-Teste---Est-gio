CREATE TABLE IF NOT EXISTS `appointments` (
  `id` text PRIMARY KEY NOT NULL,
  `appointment_date` text NOT NULL,
  `start_time` text NOT NULL,
  `provider_id` text NOT NULL DEFAULT 'ana-martins',
  `patient_name` text NOT NULL,
  `patient_phone` text,
  `status` text NOT NULL DEFAULT 'CONFIRMED',
  `created_at` text NOT NULL,
  `updated_at` text,
  `cancelled_at` text,
  `completed_at` text,
  CONSTRAINT "appointments_start_time_check" CHECK("appointments"."start_time" IN ('08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00')),
  CONSTRAINT "appointments_status_check" CHECK("appointments"."status" IN ('CONFIRMED', 'COMPLETED', 'CANCELLED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS `appointments_active_provider_date_start_time_unique`
ON `appointments` (`provider_id`, `appointment_date`, `start_time`)
WHERE `status` <> 'CANCELLED';

CREATE TRIGGER IF NOT EXISTS appointments_validate_insert
BEFORE INSERT ON appointments
BEGIN
  SELECT CASE
    WHEN length(trim(NEW.patient_name)) < 2 OR length(trim(NEW.patient_name)) > 80
    THEN RAISE(ABORT, 'invalid patient name')
  END;
  SELECT CASE
    WHEN NEW.patient_phone IS NOT NULL AND (
      length(NEW.patient_phone) < 8 OR
      length(NEW.patient_phone) > 13 OR
      NEW.patient_phone GLOB '*[^0-9]*'
    )
    THEN RAISE(ABORT, 'invalid patient phone')
  END;
  SELECT CASE
    WHEN NEW.provider_id NOT IN ('ana-martins', 'lucas-ferreira', 'camila-rocha', 'beatriz-lima')
    THEN RAISE(ABORT, 'invalid provider')
  END;
  SELECT CASE
    WHEN length(NEW.appointment_date) <> 10 OR substr(NEW.appointment_date, 1, 5) <> '2026-'
    THEN RAISE(ABORT, 'invalid appointment date')
  END;
END;

CREATE TRIGGER IF NOT EXISTS appointments_validate_update
BEFORE UPDATE OF appointment_date, provider_id, patient_name, patient_phone ON appointments
BEGIN
  SELECT CASE
    WHEN length(trim(NEW.patient_name)) < 2 OR length(trim(NEW.patient_name)) > 80
    THEN RAISE(ABORT, 'invalid patient name')
  END;
  SELECT CASE
    WHEN NEW.patient_phone IS NOT NULL AND (
      length(NEW.patient_phone) < 8 OR
      length(NEW.patient_phone) > 13 OR
      NEW.patient_phone GLOB '*[^0-9]*'
    )
    THEN RAISE(ABORT, 'invalid patient phone')
  END;
  SELECT CASE
    WHEN NEW.provider_id NOT IN ('ana-martins', 'lucas-ferreira', 'camila-rocha', 'beatriz-lima')
    THEN RAISE(ABORT, 'invalid provider')
  END;
  SELECT CASE
    WHEN length(NEW.appointment_date) <> 10 OR substr(NEW.appointment_date, 1, 5) <> '2026-'
    THEN RAISE(ABORT, 'invalid appointment date')
  END;
END;

PRAGMA optimize;
