-- 007_teklif_siparis_durum_yeniden_yapilanma.sql
-- Satış portalı teklif/sipariş durumları yeniden yapılandırma
-- Teklif: Gönderildi→İletildi, Siparişe Aktarıldı→Siparişe Dönüştü, İptal Edildi→Reddedildi
--         Satış portalı Kabul Edildi→İletildi (servis portalı Kabul Edildi saklandı)
-- Sipariş: Yeni Sipariş→Hazırlanıyor, Kısmi Sevkiyat→Kısmi Teslimat, Tamamlandı→Teslim Edildi
-- Yeni alan: order_line_items.faturalanan, invoices.tutar

SET NAMES utf8mb4;

-- ── 1. quotes.durum — geçici olarak tüm eski+yeni değerleri kabul et ──────────
ALTER TABLE quotes MODIFY COLUMN durum
  ENUM(
    'Taslak','Açık Teklif','İletildi','Kabul Edildi',
    'Siparişe Aktarıldı','Siparişe Dönüştü',
    'Gönderildi','Reddedildi','İptal Edildi','Kapandı'
  ) NOT NULL DEFAULT 'Taslak';

-- ── 2. Teklif veri migrasyonu ──────────────────────────────────────────────────
-- Gönderildi (hem portalda var, İletildi ile birleştirildi)
UPDATE quotes SET durum = 'İletildi'        WHERE durum = 'Gönderildi';
-- İptal Edildi kaldırılıyor, Reddedildi'ye eşleniyor
UPDATE quotes SET durum = 'Reddedildi'     WHERE durum = 'İptal Edildi';
-- Siparişe Aktarıldı → Siparişe Dönüştü
UPDATE quotes SET durum = 'Siparişe Dönüştü' WHERE durum = 'Siparişe Aktarıldı';
-- Satış portalındaki Kabul Edildi → İletildi (servis portalı etkilenmez)
UPDATE quotes SET durum = 'İletildi'        WHERE durum = 'Kabul Edildi' AND portal = 'satis';
-- Açık Teklif → Taslak (artık kullanılmıyor)
UPDATE quotes SET durum = 'Taslak'          WHERE durum = 'Açık Teklif';

-- ── 3. quotes.durum — yeni ENUM (Kabul Edildi ve Kapandı servis portalı için saklandı) ──
ALTER TABLE quotes MODIFY COLUMN durum
  ENUM('Taslak','İletildi','Kabul Edildi','Siparişe Dönüştü','Reddedildi','Kapandı')
  NOT NULL DEFAULT 'Taslak';

-- ── 4. orders.durum — geçici olarak eski+yeni değerleri kabul et ──────────────
ALTER TABLE orders MODIFY COLUMN durum
  ENUM(
    'Yeni Sipariş','Hazırlanıyor',
    'Kısmi Sevkiyat','Kısmi Teslimat',
    'Tamamlandı','Teslim Edildi',
    'İptal','Fatura Edildi'
  ) NOT NULL DEFAULT 'Hazırlanıyor';

-- ── 5. Sipariş veri migrasyonu ─────────────────────────────────────────────────
UPDATE orders SET durum = 'Hazırlanıyor'   WHERE durum = 'Yeni Sipariş';
UPDATE orders SET durum = 'Kısmi Teslimat' WHERE durum = 'Kısmi Sevkiyat';
UPDATE orders SET durum = 'Teslim Edildi'  WHERE durum = 'Tamamlandı';

-- ── 6. orders.durum — yeni ENUM ───────────────────────────────────────────────
ALTER TABLE orders MODIFY COLUMN durum
  ENUM('Hazırlanıyor','Kısmi Teslimat','Teslim Edildi','İptal','Fatura Edildi')
  NOT NULL DEFAULT 'Hazırlanıyor';

-- ── 7. order_line_items — faturalanan alanı ekle (IF NOT EXISTS: MySQL 8.0+) ──
ALTER TABLE order_line_items
  ADD COLUMN IF NOT EXISTS faturalanan DECIMAL(15,3) NOT NULL DEFAULT 0 AFTER gonderilen;

-- ── 8. Mevcut Fatura Edildi siparişlerinin faturalanan backfill ────────────────
UPDATE order_line_items oli
  JOIN orders o ON o.id = oli.order_id
  SET oli.faturalanan = oli.miktar
  WHERE o.durum = 'Fatura Edildi';

-- ── 9. invoices — tutar alanı ekle ───────────────────────────────────────────
ALTER TABLE invoices
  ADD COLUMN tutar DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER siparis_id;

-- ── 10. Mevcut faturaların tutarını backfill ──────────────────────────────────
UPDATE invoices i
  JOIN (
    SELECT order_id, COALESCE(SUM(miktar * birim_fiyat), 0) AS toplam
    FROM order_line_items
    GROUP BY order_id
  ) t ON t.order_id = i.siparis_id
  SET i.tutar = t.toplam;
