-- Invite acceptance audit fields + REVOKED status.
-- MySQL 8+ idempotent migration.

UPDATE invites
SET status = 'REVOKED'
WHERE status = 'CANCELLED';

SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invites'
     AND COLUMN_NAME = 'accepted_at') = 0,
  'ALTER TABLE invites ADD COLUMN accepted_at TIMESTAMP NULL AFTER expires_at',
  'SELECT 1'
);
PREPARE migrate_invites_accepted_at FROM @sql;
EXECUTE migrate_invites_accepted_at;
DEALLOCATE PREPARE migrate_invites_accepted_at;

SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invites'
     AND COLUMN_NAME = 'accepted_by_user_id') = 0,
  'ALTER TABLE invites ADD COLUMN accepted_by_user_id CHAR(36) NULL AFTER accepted_at',
  'SELECT 1'
);
PREPARE migrate_invites_accepted_by FROM @sql;
EXECUTE migrate_invites_accepted_by;
DEALLOCATE PREPARE migrate_invites_accepted_by;

-- Ensure enum values include REVOKED and no CANCELLED.
ALTER TABLE invites
MODIFY COLUMN status ENUM('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED') NOT NULL DEFAULT 'PENDING';

-- Optional FK: run once if missing in your environment.
-- ALTER TABLE invites
--   ADD CONSTRAINT fk_invites_accepted_by_user
--   FOREIGN KEY (accepted_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
