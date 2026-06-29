-- Migration 010: Teklif revizyon sistemi
-- quotes tablosuna parent_id ve revizyon_no kolonları eklenir

ALTER TABLE quotes
  ADD COLUMN parent_id VARCHAR(50) NULL DEFAULT NULL,
  ADD COLUMN revizyon_no INT NOT NULL DEFAULT 0;
