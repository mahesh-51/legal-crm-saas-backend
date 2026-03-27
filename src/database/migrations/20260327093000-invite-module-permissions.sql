-- Invite module/action permissions for firm users.
-- MySQL 8+ idempotent migration.

SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invites'
     AND COLUMN_NAME = 'module_permissions') = 0,
  'ALTER TABLE invites ADD COLUMN module_permissions JSON NULL AFTER token',
  'SELECT 1'
);
PREPARE migrate_invite_mod_perm FROM @sql;
EXECUTE migrate_invite_mod_perm;
DEALLOCATE PREPARE migrate_invite_mod_perm;

SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'firm_users'
     AND COLUMN_NAME = 'module_permissions') = 0,
  'ALTER TABLE firm_users ADD COLUMN module_permissions JSON NULL AFTER role',
  'SELECT 1'
);
PREPARE migrate_firm_user_mod_perm FROM @sql;
EXECUTE migrate_firm_user_mod_perm;
DEALLOCATE PREPARE migrate_firm_user_mod_perm;
