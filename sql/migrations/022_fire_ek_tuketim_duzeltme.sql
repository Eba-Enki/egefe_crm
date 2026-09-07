-- EGEFE CRM - Migration 022
-- Fire modeli düzeltildi: fire, kesilen sheete EK tüketimdir (kesilen + fire
-- toplamı stoktan düşer), önceki modelde ise kesilenin bir PARÇASI sayılıyordu
-- ve stoktan olması gerekenden az düşülüyordu (ör. 2 sheetlik LOT'tan 1.5
-- kesilip 0.5 fire girilince 0 kalması gerekirken 0.5 kalıyordu).
--
-- Bu betik: (1) var olan çıkış kalemlerinin fire_strip değerini yeni modele
-- göre yeniden hesaplar, (2) her LOT'un mevcut_strip / mevcut_sheet değerini
-- giriş ve tüm geçmiş çıkışlarından (düzeltilmiş fire dahil) yeniden türetir.
-- Bu betiği mevcut cromtest_egefe_crm veritabanında bir kez phpMyAdmin üzerinden çalıştırın.

-- 1) fire_strip'i yeni modele göre yeniden hesapla: toplam (kesilen+fire) tek
--    seferde stripe yuvarlanır, kullanılabilir (kesilen) strip bu toplamdan
--    ayrılır (ayrı ayrı yuvarlanan parçaların toplamı gerçek toplamı aşmasın diye).
UPDATE raw_stock_exit_items i
JOIN raw_stock_lots l ON l.id = i.lot_id
JOIN (
  SELECT rsl.id AS lot_id,
    CASE
      WHEN sc.sheet_boyu IS NULL OR sc.kesim_boleni IS NULL OR sc.kesim_boleni = 0 THEN 90
      ELSE ROUND((sc.sheet_boyu / sc.kesim_boleni) * (1 - COALESCE(sc.fire_pct, 0) / 100))
    END AS sps
  FROM raw_stock_lots rsl
  LEFT JOIN stock_categories sc ON sc.id = rsl.kategori_id
) lsps ON lsps.lot_id = l.id
SET i.fire_strip = ROUND((i.sheet_cikis + i.fire_sheet) * lsps.sps)
                  - LEAST(ROUND(i.sheet_cikis * lsps.sps), ROUND((i.sheet_cikis + i.fire_sheet) * lsps.sps))
WHERE i.fire_sheet > 0;

-- 2) Her LOT'un mevcut stok değerlerini giriş miktarından, o LOT'un tüm
--    çıkışlarındaki (kesilen + fire, düzeltilmiş) toplam tüketim düşülerek
--    yeniden hesapla.
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
