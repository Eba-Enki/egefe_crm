-- EGEFE CRM - Migration 035
-- Tedarik mal kabulü: giriş LOT'ları geldikleri tedarik kalemine bağlanır.
-- Kalemin "kabul edilen" miktarı bu LOT'ların giriş miktarlarının toplamıdır
-- (yarı mamulde sheet, hazır üründe adet) ve giriş eklenip/düzenlenip/silindikçe
-- API tarafından yeniden hesaplanır.
-- 034'ten SONRA, bir kez phpMyAdmin üzerinden çalıştırın.

ALTER TABLE raw_stock_lots
  ADD COLUMN tedarik_kalem_id INT NULL AFTER kategori_id,
  ADD KEY idx_rsl_tedarik (tedarik_kalem_id),
  ADD CONSTRAINT fk_rsl_tedarik FOREIGN KEY (tedarik_kalem_id) REFERENCES stock_purchase_order_items(id) ON DELETE SET NULL;

ALTER TABLE finished_stock_lots
  ADD COLUMN tedarik_kalem_id INT NULL AFTER kategori_id,
  ADD KEY idx_fsl_tedarik (tedarik_kalem_id),
  ADD CONSTRAINT fk_fsl_tedarik FOREIGN KEY (tedarik_kalem_id) REFERENCES stock_purchase_order_items(id) ON DELETE SET NULL;

-- Tükendiği için tek tek silinen (temizlenen) LOT'ların kabul miktarı kaybolmasın:
-- silinen LOT'un giriş miktarı kalemde ayrıca tutulur ve kabul toplamına eklenir.
ALTER TABLE stock_purchase_order_items
  ADD COLUMN kabul_silinen DECIMAL(15,3) NOT NULL DEFAULT 0 AFTER kabul_edilen;
