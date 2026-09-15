CREATE TABLE IF NOT EXISTS `admin_audit_log` (
  `id` text PRIMARY KEY NOT NULL,
  `appointment_id` text NOT NULL,
  `action` text NOT NULL,
  `actor` text NOT NULL,
  `request_id` text NOT NULL,
  `created_at` text NOT NULL,
  CONSTRAINT "admin_audit_action_check" CHECK(`action` IN ('RESCHEDULED', 'COMPLETED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS `admin_audit_created_at_idx`
ON `admin_audit_log` (`created_at`);

CREATE INDEX IF NOT EXISTS `admin_audit_appointment_idx`
ON `admin_audit_log` (`appointment_id`);

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
