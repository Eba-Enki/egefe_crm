-- EGEFE CRM - Migration 032
-- Kategori kesim ölçüsü (sheet boyu / kesim böleni / fire) değiştirildiğinde eski
-- LOT'ların strip değerleri eski oranla kalıyordu; sayımda sheet doğru girilse de
-- strip farkı çıkıyordu. Artık kategori güncellenince API ilgili LOT'ları otomatik
-- yeniden hesaplıyor. Bu betik, düzeltme öncesinde bozulmuş mevcut veriyi TÜM
-- yarı mamul kategorileri için bir kez güncel orana göre yeniden kurar.
-- Fiziksel gerçek sheet miktarıdır; strip'ler sheet'ten türetilir.
-- Bu betiği mevcut cromtest_egefe_crm veritabanında bir kez phpMyAdmin üzerinden çalıştırın.

-- 0) LOT başına güncel strip/sheet oranı
DROP TEMPORARY TABLE IF EXISTS tmp_lot_sps;
CREATE TEMPORARY TABLE tmp_lot_sps AS
SELECT rsl.id AS lot_id,
  CASE
    WHEN sc.sheet_boyu IS NULL OR sc.kesim_boleni IS NULL OR sc.kesim_boleni = 0 THEN 90
    ELSE ROUND((sc.sheet_boyu / sc.kesim_boleni) * (1 - COALESCE(sc.fire_pct, 0) / 100))
  END AS sps
FROM raw_stock_lots rsl
LEFT JOIN stock_categories sc ON sc.id = rsl.kategori_id;

-- 1) Giriş strip'i
UPDATE raw_stock_lots l
JOIN tmp_lot_sps s ON s.lot_id = l.id
SET l.strip_giren = ROUND(l.sheet_giren * s.sps);

-- 2) Çıkış (kesilen) ve fire strip'leri
UPDATE raw_stock_exit_items i
JOIN tmp_lot_sps s ON s.lot_id = i.lot_id
SET i.strip_cikis = LEAST(ROUND(i.sheet_cikis * s.sps), ROUND((i.sheet_cikis + i.fire_sheet) * s.sps)),
    i.fire_strip  = ROUND((i.sheet_cikis + i.fire_sheet) * s.sps)
                  - LEAST(ROUND(i.sheet_cikis * s.sps), ROUND((i.sheet_cikis + i.fire_sheet) * s.sps));

-- 3) Mevcut stok = giriş − tüm çıkışlar (kesilen + fire)
UPDATE raw_stock_lots l
LEFT JOIN (
  SELECT lot_id,
         SUM(strip_cikis + fire_strip) AS toplam_strip,
         SUM(sheet_cikis + fire_sheet) AS toplam_sheet
  FROM raw_stock_exit_items
  WHERE lot_id IS NOT NULL
  GROUP BY lot_id
) x ON x.lot_id = l.id
SET l.mevcut_strip = GREATEST(0, l.strip_giren - COALESCE(x.toplam_strip, 0)),
    l.mevcut_sheet = GREATEST(0, ROUND(l.sheet_giren - COALESCE(x.toplam_sheet, 0), 2));

DROP TEMPORARY TABLE IF EXISTS tmp_lot_sps;
