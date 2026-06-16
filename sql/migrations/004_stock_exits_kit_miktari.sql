-- EGEFE CRM - Migration 004 (003 ile birleştirildi)
-- raw_stock_exits ve finished_stock_exits tablolarına "notlar" ve "kit_miktari" kolonlarını ekler.
-- Bu betiği mevcut cromtest_egefe_crm veritabanında bir kez phpMyAdmin üzerinden çalıştırın.

ALTER TABLE raw_stock_exits
  ADD COLUMN notlar TEXT NULL AFTER aciklama,
  ADD COLUMN kit_miktari DECIMAL(15,3) NULL AFTER notlar;

ALTER TABLE finished_stock_exits
  ADD COLUMN notlar TEXT NULL AFTER aciklama;
