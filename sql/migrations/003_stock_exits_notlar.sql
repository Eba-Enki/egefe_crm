-- EGEFE CRM - Migration 003
-- raw_stock_exits ve finished_stock_exits tablolarına "notlar" (serbest not) kolonu ekler.
-- Bu betiği mevcut cromtest_egefe_crm veritabanında bir kez phpMyAdmin üzerinden çalıştırın.

ALTER TABLE raw_stock_exits
  ADD COLUMN notlar TEXT NULL AFTER aciklama;

ALTER TABLE finished_stock_exits
  ADD COLUMN notlar TEXT NULL AFTER aciklama;
