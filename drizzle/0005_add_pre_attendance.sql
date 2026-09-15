-- As colunas desta etapa são adicionadas individualmente e de forma idempotente
-- por scripts/migrate-production.mjs antes da criação dos triggers abaixo.

CREATE TRIGGER IF NOT EXISTS appointments_validate_pre_attendance_insert
BEFORE INSERT ON appointments
BEGIN
  SELECT CASE
    WHEN NEW.patient_phone IS NULL OR length(NEW.patient_phone) < 8 OR length(NEW.patient_phone) > 13 OR NEW.patient_phone GLOB '*[^0-9]*'
    THEN RAISE(ABORT, 'invalid required patient phone')
  END;
  SELECT CASE
    WHEN NEW.visit_reason IS NULL OR length(trim(NEW.visit_reason)) < 5 OR length(trim(NEW.visit_reason)) > 300
    THEN RAISE(ABORT, 'invalid visit reason')
  END;
  SELECT CASE
    WHEN NEW.symptom_duration IS NOT NULL AND NEW.symptom_duration NOT IN ('TODAY', 'FEW_DAYS', 'WEEKS', 'MONTHS', 'NOT_APPLICABLE')
    THEN RAISE(ABORT, 'invalid symptom duration')
  END;
  SELECT CASE
    WHEN NEW.visit_type IS NULL OR NEW.visit_type NOT IN ('FIRST_VISIT', 'RETURN')
    THEN RAISE(ABORT, 'invalid visit type')
  END;
  SELECT CASE
    WHEN NEW.patient_notes IS NOT NULL AND length(NEW.patient_notes) > 500
    THEN RAISE(ABORT, 'invalid patient notes')
  END;
END;

CREATE TRIGGER IF NOT EXISTS appointments_validate_pre_attendance_update
BEFORE UPDATE OF patient_phone, visit_reason, symptom_duration, visit_type, patient_notes ON appointments
BEGIN
  SELECT CASE
    WHEN NEW.patient_phone IS NULL OR length(NEW.patient_phone) < 8 OR length(NEW.patient_phone) > 13 OR NEW.patient_phone GLOB '*[^0-9]*'
    THEN RAISE(ABORT, 'invalid required patient phone')
  END;
  SELECT CASE
    WHEN NEW.visit_reason IS NULL OR length(trim(NEW.visit_reason)) < 5 OR length(trim(NEW.visit_reason)) > 300
    THEN RAISE(ABORT, 'invalid visit reason')
  END;
  SELECT CASE
    WHEN NEW.symptom_duration IS NOT NULL AND NEW.symptom_duration NOT IN ('TODAY', 'FEW_DAYS', 'WEEKS', 'MONTHS', 'NOT_APPLICABLE')
    THEN RAISE(ABORT, 'invalid symptom duration')
  END;
  SELECT CASE
    WHEN NEW.visit_type IS NULL OR NEW.visit_type NOT IN ('FIRST_VISIT', 'RETURN')
    THEN RAISE(ABORT, 'invalid visit type')
  END;
  SELECT CASE
    WHEN NEW.patient_notes IS NOT NULL AND length(NEW.patient_notes) > 500
    THEN RAISE(ABORT, 'invalid patient notes')
  END;
END;

PRAGMA optimize;
