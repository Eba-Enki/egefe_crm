-- 007b_devam.sql
-- 007 migration'ı faturalanan kolonunu zaten mevcut olduğu için 7. adımda durdu.
-- Bu dosya kalan 8-10 adımlarını çalıştırır.

SET NAMES utf8mb4;

-- ── 8. Mevcut Fatura Edildi siparişlerinin faturalanan backfill ────────────────
UPDATE order_line_items oli
  JOIN orders o ON o.id = oli.order_id
  SET oli.faturalanan = oli.miktar
  WHERE o.durum = 'Fatura Edildi';

-- ── 9. invoices — tutar alanı ekle (yoksa) ───────────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS tutar DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER siparis_id;

-- ── 10. Mevcut faturaların tutarını backfill ──────────────────────────────────
UPDATE invoices i
  JOIN (
    SELECT order_id, COALESCE(SUM(miktar * birim_fiyat), 0) AS toplam
    FROM order_line_items
    GROUP BY order_id
  ) t ON t.order_id = i.siparis_id
  SET i.tutar = t.toplam;
