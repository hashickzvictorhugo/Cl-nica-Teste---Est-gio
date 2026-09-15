CREATE TABLE IF NOT EXISTS `admin_audit_log` (
  `id` text PRIMARY KEY NOT NULL,
  `appointment_id` text NOT NULL,
  `action` text NOT NULL,
  `actor` text NOT NULL,
  `source` text NOT NULL DEFAULT 'APPLICATION',
  `request_id` text NOT NULL,
  `created_at` text NOT NULL,
  CONSTRAINT "admin_audit_action_check" CHECK(`action` IN ('RESCHEDULED', 'COMPLETED', 'CANCELLED')),
  CONSTRAINT "admin_audit_source_check" CHECK(`source` IN ('DATABASE', 'APPLICATION'))
);

CREATE INDEX IF NOT EXISTS `admin_audit_created_at_idx`
ON `admin_audit_log` (`created_at`);

CREATE INDEX IF NOT EXISTS `admin_audit_appointment_idx`
ON `admin_audit_log` (`appointment_id`);

CREATE TRIGGER IF NOT EXISTS appointments_audit_update
AFTER UPDATE OF appointment_date, start_time, provider_id, status ON appointments
WHEN
  OLD.appointment_date <> NEW.appointment_date OR
  OLD.start_time <> NEW.start_time OR
  OLD.provider_id <> NEW.provider_id OR
  OLD.status <> NEW.status
BEGIN
  INSERT INTO admin_audit_log (
    id,
    appointment_id,
    action,
    actor,
    source,
    request_id,
    created_at
  ) VALUES (
    lower(hex(randomblob(16))),
    NEW.id,
    CASE
      WHEN NEW.status = 'CANCELLED' AND OLD.status <> 'CANCELLED' THEN 'CANCELLED'
      WHEN NEW.status = 'COMPLETED' AND OLD.status <> 'COMPLETED' THEN 'COMPLETED'
      ELSE 'RESCHEDULED'
    END,
    'database-enforced',
    'DATABASE',
    'database-trigger',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  );
END;

CREATE TRIGGER IF NOT EXISTS admin_audit_log_no_update
BEFORE UPDATE ON admin_audit_log
BEGIN
  SELECT RAISE(ABORT, 'admin audit log is immutable');
END;

CREATE TRIGGER IF NOT EXISTS admin_audit_log_no_delete
BEFORE DELETE ON admin_audit_log
BEGIN
  SELECT RAISE(ABORT, 'admin audit log is immutable');
END;

PRAGMA optimize;
