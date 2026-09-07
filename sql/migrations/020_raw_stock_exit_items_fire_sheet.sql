-- EGEFE CRM - Migration 020
-- Fire artik strip degil sheet cinsinden giriliyor (ondalikli, ör. 0.6 sheet).
-- fire_strip bu degerden turetilip stoktan dusulen miktara dahil edilir (fire_sheet ham girisi saklar).
-- Bu betiği mevcut cromtest_egefe_crm veritabanında bir kez phpMyAdmin üzerinden çalıştırın.

ALTER TABLE raw_stock_exit_items
  ADD COLUMN fire_sheet DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER strip_cikis;
