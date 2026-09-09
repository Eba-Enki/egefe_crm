-- EGEFE CRM - Migration 024
-- Hazir urun lotlarina (kalem bazinda) not alani eklenir. Bu, giris belgesi
-- seviyesindeki finished_stock_entries.notlar alanindan farklidir; her kaleme
-- ozel bir not dusulebilmesini saglar (orn. "Bu LOT'ta ambalaj hasari var").
-- Bu betiği mevcut cromtest_egefe_crm veritabaninda bir kez phpMyAdmin uzerinden calistirin.

ALTER TABLE finished_stock_lots
  ADD COLUMN notlar TEXT NULL AFTER seri_no;
