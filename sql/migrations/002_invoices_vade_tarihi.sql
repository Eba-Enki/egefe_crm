-- EGEFE CRM - Migration 002
-- invoices tablosuna "vade_tarihi" (Fatura Vade tarihi) kolonu ekler.
-- Bu betiği mevcut cromtest_egefe_crm veritabanında bir kez phpMyAdmin üzerinden çalıştırın.

ALTER TABLE invoices
  ADD COLUMN vade_tarihi DATE NULL AFTER fatura_tarihi;
