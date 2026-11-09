-- 029_raw_stock_lots_coklu.sql
-- Yarı mamul girişinde Tekli / Çoklu parametre desteği.
-- Çoklu kalemde parametre_ad elle girilen ürün adını, cutoff ise
-- parametrelerin özetini (ör. "AMP:1000 · COC:300") tutar; ayrıntı
-- parametreler JSON sütununda [{ad, deger}] olarak saklanır.

SET NAMES utf8mb4;

ALTER TABLE raw_stock_lots
  ADD COLUMN tip VARCHAR(10) NOT NULL DEFAULT 'tekli' AFTER parametre_ad,
  ADD COLUMN parametreler JSON NULL AFTER tip,
  MODIFY COLUMN cutoff VARCHAR(500) NULL;
