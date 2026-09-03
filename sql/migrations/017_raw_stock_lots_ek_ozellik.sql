-- EGEFE CRM - Migration 017
-- raw_stock_lots tablosuna "ek_ozellik" (yarı mamul giriş kalemi bazında kısa özellik/not) kolonu ekler.
-- Boş girilirse uygulama katmanı "Standart" değerini yazar.
-- Bu betiği mevcut cromtest_egefe_crm veritabanında bir kez phpMyAdmin üzerinden çalıştırın.

ALTER TABLE raw_stock_lots
  ADD COLUMN ek_ozellik VARCHAR(150) NULL AFTER cutoff;
