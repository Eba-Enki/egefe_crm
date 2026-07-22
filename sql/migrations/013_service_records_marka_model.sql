-- 013_service_records_marka_model.sql
-- Servis kaydı (cihaz) formunda marka/model seçimi için kolon ekler.

ALTER TABLE service_records
  ADD COLUMN marka VARCHAR(150) NULL AFTER urun_adi,
  ADD COLUMN model VARCHAR(150) NULL AFTER marka;
