-- EGEFE CRM - Migration 019
-- Ham stok cikislarinda artik sheet bazinda giris yapiliyor (strip otomatik hesaplaniyor)
-- ve kesim sirasinda olusan beklenmedik fire (deforme strip) miktari kaydedilebiliyor.
-- strip_cikis stoktan dusulen gercek miktari tutmaya devam eder (sheet'ten turetilen tam miktar);
-- fire_strip bunun ne kadarinin kullanilamaz oldugunu (kite sayilmadigini) gosterir.
-- Bu betiği mevcut cromtest_egefe_crm veritabanında bir kez phpMyAdmin üzerinden çalıştırın.

ALTER TABLE raw_stock_exit_items
  ADD COLUMN sheet_cikis DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER lot_id,
  ADD COLUMN fire_strip INT NOT NULL DEFAULT 0 AFTER strip_cikis;
