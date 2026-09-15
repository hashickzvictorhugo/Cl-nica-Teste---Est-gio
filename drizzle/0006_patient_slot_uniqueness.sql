CREATE UNIQUE INDEX IF NOT EXISTS `appointments_active_patient_date_start_time_unique`
ON `appointments` (`patient_phone`, `appointment_date`, `start_time`)
WHERE `status` <> 'CANCELLED' AND `patient_phone` IS NOT NULL;

PRAGMA optimize;
