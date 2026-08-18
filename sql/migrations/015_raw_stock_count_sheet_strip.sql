-- Migration 015: Sayim kalemlerinde Sheet ve serbest Strip miktarini ayri ayri sakla
-- Fiziki sayim genellikle Sheet olarak yapiliyor, ama bazi stoklar zaten kesilmis
-- (serbest) Strip halinde de olabiliyor. sayilan_miktar toplam strip karsiligi olarak
-- (sayilan_sheet * kategori donusum orani + sayilan_strip) kaydedilmeye devam eder.
ALTER TABLE raw_stock_count_items
  ADD COLUMN sayilan_sheet INT NOT NULL DEFAULT 0 AFTER sistem_miktar,
  ADD COLUMN sayilan_strip INT NOT NULL DEFAULT 0 AFTER sayilan_sheet;
