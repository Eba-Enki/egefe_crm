-- EGEFE CRM - Migration 021
-- "Mevcut Sheet" artik mevcut_strip'ten (round hatasiyla) turetilmiyor,
-- kendi basina tam/yuvarlamasiz takip ediliyor. Giriste sheet_giren ile
-- baslar, cikista kesilen sheet miktari kadar (fire dahil) duser.
--
-- Mevcut LOT'lar icin baslangic degeri, sheet_giren'den o LOT'un simdiye
-- kadarki tum cikislarindaki gercek (yuvarlamasiz) sheet_cikis toplami
-- dusulerek dolduruluyor (migration 019'dan beri sheet_cikis zaten tam
-- deger olarak kaydediliyordu). Hic cikisi olmayan LOT'larda bu deger
-- zaten sheet_giren'e esit olur.
-- Bu betiği mevcut cromtest_egefe_crm veritabanında bir kez phpMyAdmin üzerinden çalıştırın.

ALTER TABLE raw_stock_lots
  ADD COLUMN mevcut_sheet DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER sheet_giren;

UPDATE raw_stock_lots l
LEFT JOIN (
  SELECT lot_id, SUM(sheet_cikis) AS toplam_sheet_cikis
  FROM raw_stock_exit_items
  WHERE lot_id IS NOT NULL
  GROUP BY lot_id
) x ON x.lot_id = l.id
SET l.mevcut_sheet = GREATEST(0, ROUND(l.sheet_giren - COALESCE(x.toplam_sheet_cikis, 0), 2));
