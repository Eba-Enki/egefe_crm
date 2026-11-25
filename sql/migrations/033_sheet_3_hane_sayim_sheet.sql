-- EGEFE CRM - Migration 033
-- (1) Yarı mamul sheet miktarları her yerde 3 ondalık haneye (0,001) çıkarıldı.
-- (2) Sayım artık SHEET üzerinden eşitleniyor: sayım kalemine sistemin o anki sheet
--     değeri (sistem_sheet) ve sayılan toplam sheet (sayilan_toplam_sheet = sayılan
--     sheet + ayrıca sayılan strip / oran) yazılıyor; fark ve düzeltme sheet ile yapılıyor.
-- 032'den SONRA, bir kez phpMyAdmin üzerinden çalıştırın.

ALTER TABLE raw_stock_lots
  MODIFY sheet_giren  DECIMAL(10,3) NOT NULL DEFAULT 0,
  MODIFY mevcut_sheet DECIMAL(10,3) NOT NULL DEFAULT 0;

ALTER TABLE raw_stock_exit_items
  MODIFY sheet_cikis DECIMAL(10,3) NOT NULL DEFAULT 0,
  MODIFY fire_sheet  DECIMAL(10,3) NOT NULL DEFAULT 0;

ALTER TABLE raw_stock_count_items
  MODIFY sayilan_sheet DECIMAL(10,3) NOT NULL DEFAULT 0,
  ADD COLUMN sistem_sheet         DECIMAL(10,3) NULL AFTER sistem_miktar,
  ADD COLUMN sayilan_toplam_sheet DECIMAL(10,3) NULL AFTER sayilan_miktar;

-- Eski sayım kalemleri için sheet değerlerini güncel kategori oranından türet.
UPDATE raw_stock_count_items i
JOIN raw_stock_lots l ON l.id = i.lot_id
LEFT JOIN stock_categories sc ON sc.id = l.kategori_id
SET i.sistem_sheet = ROUND(i.sistem_miktar / (
      CASE WHEN sc.sheet_boyu IS NULL OR sc.kesim_boleni IS NULL OR sc.kesim_boleni = 0 THEN 90
           ELSE GREATEST(1, ROUND((sc.sheet_boyu / sc.kesim_boleni) * (1 - COALESCE(sc.fire_pct, 0) / 100))) END), 3),
    i.sayilan_toplam_sheet = ROUND(i.sayilan_sheet + i.sayilan_strip / (
      CASE WHEN sc.sheet_boyu IS NULL OR sc.kesim_boleni IS NULL OR sc.kesim_boleni = 0 THEN 90
           ELSE GREATEST(1, ROUND((sc.sheet_boyu / sc.kesim_boleni) * (1 - COALESCE(sc.fire_pct, 0) / 100))) END), 3);

-- LOT'u silinmiş kalemler: elde sadece strip var, sheet alanlarını 0 bırak.
UPDATE raw_stock_count_items
SET sistem_sheet = COALESCE(sistem_sheet, 0),
    sayilan_toplam_sheet = COALESCE(sayilan_toplam_sheet, sayilan_sheet);
