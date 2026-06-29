-- Migration 010: Teklif revizyon sistemi
-- 1) quotes tablosuna parent_id ve revizyon_no kolonları eklenir (zaten eklendiyse atla)
-- 2) durum ENUM'una 'Revize Edildi' değeri eklenir

ALTER TABLE quotes
  MODIFY COLUMN durum ENUM('Taslak','İletildi','Kabul Edildi','Siparişe Dönüştü','Reddedildi','Kapandı','Revize Edildi') NOT NULL DEFAULT 'Taslak';
