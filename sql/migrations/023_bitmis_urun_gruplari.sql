-- EGEFE CRM - Migration 023
-- Hazır ürün (bitmiş ürün) kategorilerini gruplandırma: Test Kitleri / Cihazlar /
-- Sarflar ana grupları ve altında serbestçe eklenip silinebilen alt tipler
-- (ör. Test Kitleri > İdrar, Cihazlar > Alkolmetre). Her ana grup ve ona bağlı
-- alt tipler bir "grup_tipi" taşır; bu değer hazır ürün giriş formunda hangi
-- alanların (parametre+cutoff / marka-model-seri no / sade) gösterileceğini
-- belirler. Mevcut düz "ticari" kategoriler (parent_id ve grup_tipi NULL)
-- olduğu gibi kalır; kullanıcı bunları daha sonra manuel olarak yeni yapıya
-- taşıyacaktır.
-- Bu betiği mevcut cromtest_egefe_crm veritabanında bir kez phpMyAdmin üzerinden çalıştırın.

ALTER TABLE stock_categories
  ADD COLUMN parent_id VARCHAR(40) NULL AFTER tip,
  ADD COLUMN grup_tipi ENUM('test_kiti','cihaz','sarf') NULL AFTER parent_id,
  ADD KEY idx_sc_parent (parent_id),
  ADD CONSTRAINT fk_sc_parent FOREIGN KEY (parent_id) REFERENCES stock_categories(id) ON DELETE CASCADE;

ALTER TABLE finished_stock_lots
  ADD COLUMN marka VARCHAR(150) NULL AFTER urun_adi,
  ADD COLUMN model VARCHAR(150) NULL AFTER marka,
  ADD COLUMN seri_no VARCHAR(150) NULL AFTER model;

-- Sabit 3 ana grup (Test Kitleri / Cihazlar / Sarflar). Alt tipler (ör. İdrar,
-- Alkolmetre) Ayarlar > Hazır Ürün Kategorileri ekranından serbestçe eklenir.
INSERT INTO stock_categories (id, tip, parent_id, grup_tipi, ad) VALUES
  ('tkat_test_kiti', 'ticari', NULL, 'test_kiti', 'Test Kitleri'),
  ('tkat_cihaz',     'ticari', NULL, 'cihaz',     'Cihazlar'),
  ('tkat_sarf',      'ticari', NULL, 'sarf',      'Sarflar');
