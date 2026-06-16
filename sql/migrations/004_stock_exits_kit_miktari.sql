-- EGEFE CRM - Migration 004
-- raw_stock_exits tablosuna "kit_miktari" kolonu ekler.
-- Bu betiği mevcut cromtest_egefe_crm veritabanında bir kez phpMyAdmin üzerinden çalıştırın.

ALTER TABLE raw_stock_exits
  ADD COLUMN kit_miktari DECIMAL(15,3) NULL AFTER notlar;
