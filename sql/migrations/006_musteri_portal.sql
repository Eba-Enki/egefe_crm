-- Migration 006: customers tablosuna portal kolonu eklendi
-- Her portal kendi müşteri listesini bağımsız tutar (servis / satis)
-- Mevcut tüm kayıtlar 'servis' portalına atanıyor (servis portalında oluşturulmuş)

ALTER TABLE customers
  ADD COLUMN portal VARCHAR(10) NOT NULL DEFAULT 'servis' AFTER kayit_no;

-- Mevcut kayıtları servis portalına ata
UPDATE customers SET portal = 'servis' WHERE portal = 'servis' OR portal IS NULL OR portal = '';
