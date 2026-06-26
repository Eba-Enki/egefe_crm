-- Migration 009: quotes tablosuna kdv_oran kolonu eklendi
-- 0 = KDV yok, 10 = %10 KDV, 20 = %20 KDV
ALTER TABLE quotes ADD COLUMN kdv_oran TINYINT NOT NULL DEFAULT 0 AFTER vade;
