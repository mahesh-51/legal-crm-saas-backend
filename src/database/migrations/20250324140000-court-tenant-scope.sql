-- Court types / names: tenant scope (firm, individual, or global defaults).
-- MySQL 8+. Idempotent where possible. Run when not using TypeORM synchronize.

-- court_types: tenant_scope, firm_id, user_id; unique (tenant_scope, name)
SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'court_types'
     AND COLUMN_NAME = 'tenant_scope') = 0,
  'ALTER TABLE court_types ADD COLUMN tenant_scope VARCHAR(64) NOT NULL DEFAULT ''global'' AFTER id',
  'SELECT 1'
);
PREPARE migrate_ct_ts FROM @sql;
EXECUTE migrate_ct_ts;
DEALLOCATE PREPARE migrate_ct_ts;

SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'court_types'
     AND COLUMN_NAME = 'firm_id') = 0,
  'ALTER TABLE court_types ADD COLUMN firm_id CHAR(36) NULL',
  'SELECT 1'
);
PREPARE migrate_ct_f FROM @sql;
EXECUTE migrate_ct_f;
DEALLOCATE PREPARE migrate_ct_f;

SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'court_types'
     AND COLUMN_NAME = 'user_id') = 0,
  'ALTER TABLE court_types ADD COLUMN user_id CHAR(36) NULL',
  'SELECT 1'
);
PREPARE migrate_ct_u FROM @sql;
EXECUTE migrate_ct_u;
DEALLOCATE PREPARE migrate_ct_u;

-- Drop old unique on name if present (name may have been UNIQUE)
SET @idx := (
  SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'court_types'
    AND COLUMN_NAME = 'name' AND NON_UNIQUE = 0 AND SEQ_IN_INDEX = 1
  LIMIT 1
);
SET @sql := IF(
  @idx IS NOT NULL AND @idx <> 'PRIMARY',
  CONCAT('ALTER TABLE court_types DROP INDEX `', @idx, '`'),
  'SELECT 1'
);
PREPARE migrate_ct_drop_uq FROM @sql;
EXECUTE migrate_ct_drop_uq;
DEALLOCATE PREPARE migrate_ct_drop_uq;

SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'court_types'
     AND INDEX_NAME = 'uq_court_types_scope_name') = 0,
  'ALTER TABLE court_types ADD UNIQUE KEY uq_court_types_scope_name (tenant_scope, name)',
  'SELECT 1'
);
PREPARE migrate_ct_uq FROM @sql;
EXECUTE migrate_ct_uq;
DEALLOCATE PREPARE migrate_ct_uq;

-- FKs (ignore if already exist — run once in clean migration)
-- ALTER TABLE court_types ADD CONSTRAINT fk_court_types_firm FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE CASCADE;
-- ALTER TABLE court_types ADD CONSTRAINT fk_court_types_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- court_names: same pattern
SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'court_names'
     AND COLUMN_NAME = 'tenant_scope') = 0,
  'ALTER TABLE court_names ADD COLUMN tenant_scope VARCHAR(64) NOT NULL DEFAULT ''global'' AFTER id',
  'SELECT 1'
);
PREPARE migrate_cn_ts FROM @sql;
EXECUTE migrate_cn_ts;
DEALLOCATE PREPARE migrate_cn_ts;

SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'court_names'
     AND COLUMN_NAME = 'firm_id') = 0,
  'ALTER TABLE court_names ADD COLUMN firm_id CHAR(36) NULL',
  'SELECT 1'
);
PREPARE migrate_cn_f FROM @sql;
EXECUTE migrate_cn_f;
DEALLOCATE PREPARE migrate_cn_f;

SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'court_names'
     AND COLUMN_NAME = 'user_id') = 0,
  'ALTER TABLE court_names ADD COLUMN user_id CHAR(36) NULL',
  'SELECT 1'
);
PREPARE migrate_cn_u FROM @sql;
EXECUTE migrate_cn_u;
DEALLOCATE PREPARE migrate_cn_u;

SET @idx := (
  SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'court_names'
    AND COLUMN_NAME = 'name' AND NON_UNIQUE = 0 AND SEQ_IN_INDEX = 1
  LIMIT 1
);
SET @sql := IF(
  @idx IS NOT NULL AND @idx <> 'PRIMARY',
  CONCAT('ALTER TABLE court_names DROP INDEX `', @idx, '`'),
  'SELECT 1'
);
PREPARE migrate_cn_drop_uq FROM @sql;
EXECUTE migrate_cn_drop_uq;
DEALLOCATE PREPARE migrate_cn_drop_uq;

SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'court_names'
     AND INDEX_NAME = 'uq_court_names_scope_name') = 0,
  'ALTER TABLE court_names ADD UNIQUE KEY uq_court_names_scope_name (tenant_scope, name)',
  'SELECT 1'
);
PREPARE migrate_cn_uq FROM @sql;
EXECUTE migrate_cn_uq;
DEALLOCATE PREPARE migrate_cn_uq;

UPDATE court_types SET tenant_scope = 'global' WHERE tenant_scope IS NULL OR tenant_scope = '';
UPDATE court_names SET tenant_scope = 'global' WHERE tenant_scope IS NULL OR tenant_scope = '';
