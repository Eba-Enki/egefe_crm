-- EGEFE CRM - Migration 018
-- Sheet miktarlari artik yarim sheet gibi ondalikli degerler alabiliyor (ör. 1.5 sheet).
-- Strip miktarlari (sheet_giren'den turetilen fiziksel strip sayisi) her zaman tam sayidir,
-- bu yuzden strip_giren/mevcut_strip/sistem_miktar/sayilan_strip/sayilan_miktar INT olarak kalir.
-- Bu betiği mevcut cromtest_egefe_crm veritabanında bir kez phpMyAdmin üzerinden çalıştırın.

ALTER TABLE raw_stock_lots
  MODIFY COLUMN sheet_giren DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE raw_stock_count_items
  MODIFY COLUMN sayilan_sheet DECIMAL(10,2) NOT NULL DEFAULT 0;
