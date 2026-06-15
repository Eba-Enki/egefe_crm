-- EGEFE CRM - Migration 001
-- orders tablosuna "tahmini_teslimat" (Tahmini Teslimat tarihi) kolonu ekler.
-- Bu betiği mevcut cromtest_egefe_crm veritabanında bir kez phpMyAdmin üzerinden çalıştırın.

ALTER TABLE orders
  ADD COLUMN tahmini_teslimat DATE NULL AFTER siparis_tarihi;
