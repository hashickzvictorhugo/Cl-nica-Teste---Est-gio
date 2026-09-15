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
--> statement-breakpoint
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
