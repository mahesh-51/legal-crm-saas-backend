-- Cloudinary metadata for matter documents (delete + raw/video handling)
ALTER TABLE documents
  ADD COLUMN cloudinary_public_id VARCHAR(512) NULL,
  ADD COLUMN cloudinary_resource_type VARCHAR(20) NULL;
