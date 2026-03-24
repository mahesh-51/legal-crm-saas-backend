-- Client KYC alignment: one document type, separate identifier vs upload URL columns.
-- Idempotent: safe to re-run. Skips ALTER when columns already exist (e.g. TypeORM synchronize).
-- Run manually when not using TypeORM synchronize (e.g. production).
-- MySQL 8+

-- verification_document_type
SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients'
     AND COLUMN_NAME = 'verification_document_type') = 0,
  'ALTER TABLE clients ADD COLUMN verification_document_type ENUM(''aadhaar'', ''pan'', ''driving'') NULL COMMENT ''Which ID type is used for KYC; NULL = not chosen'' AFTER verification_status',
  'SELECT 1'
);
PREPARE migrate_kyc_doc_type FROM @sql;
EXECUTE migrate_kyc_doc_type;
DEALLOCATE PREPARE migrate_kyc_doc_type;

-- aadhaar_document_url
SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients'
     AND COLUMN_NAME = 'aadhaar_document_url') = 0,
  'ALTER TABLE clients ADD COLUMN aadhaar_document_url VARCHAR(1024) NULL AFTER driving_license',
  'SELECT 1'
);
PREPARE migrate_kyc_aadhaar_url FROM @sql;
EXECUTE migrate_kyc_aadhaar_url;
DEALLOCATE PREPARE migrate_kyc_aadhaar_url;

-- pan_document_url
SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients'
     AND COLUMN_NAME = 'pan_document_url') = 0,
  'ALTER TABLE clients ADD COLUMN pan_document_url VARCHAR(1024) NULL AFTER aadhaar_document_url',
  'SELECT 1'
);
PREPARE migrate_kyc_pan_url FROM @sql;
EXECUTE migrate_kyc_pan_url;
DEALLOCATE PREPARE migrate_kyc_pan_url;

-- driving_license_document_url
SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients'
     AND COLUMN_NAME = 'driving_license_document_url') = 0,
  'ALTER TABLE clients ADD COLUMN driving_license_document_url VARCHAR(1024) NULL AFTER pan_document_url',
  'SELECT 1'
);
PREPARE migrate_kyc_dl_url FROM @sql;
EXECUTE migrate_kyc_dl_url;
DEALLOCATE PREPARE migrate_kyc_dl_url;

-- Legacy: uploads were stored in identifier columns; move obvious file paths to *_document_url.
UPDATE clients
SET aadhaar_document_url = aadhaar_card
WHERE aadhaar_card IS NOT NULL
  AND (aadhaar_card LIKE '%kyc%' OR aadhaar_card LIKE '%uploads%');

UPDATE clients SET aadhaar_card = NULL WHERE aadhaar_document_url IS NOT NULL;

UPDATE clients
SET pan_document_url = pan_card
WHERE pan_card IS NOT NULL
  AND (pan_card LIKE '%kyc%' OR pan_card LIKE '%uploads%');

UPDATE clients SET pan_card = NULL WHERE pan_document_url IS NOT NULL;

UPDATE clients
SET driving_license_document_url = driving_license
WHERE driving_license IS NOT NULL
  AND (driving_license LIKE '%kyc%' OR driving_license LIKE '%uploads%');

UPDATE clients SET driving_license = NULL WHERE driving_license_document_url IS NOT NULL;

-- Optional backfill: infer verification_document_type when still NULL but identifiers exist.
UPDATE clients
SET verification_document_type = 'aadhaar'
WHERE verification_document_type IS NULL
  AND aadhaar_card IS NOT NULL;

UPDATE clients
SET verification_document_type = 'pan'
WHERE verification_document_type IS NULL
  AND pan_card IS NOT NULL;

UPDATE clients
SET verification_document_type = 'driving'
WHERE verification_document_type IS NULL
  AND driving_license IS NOT NULL;
