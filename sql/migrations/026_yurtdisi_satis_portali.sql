-- EGEFE CRM - Migration 026
-- Yurtdışı Satış Portalı ('ihracat'): yurtdışı projeler için müşteri ve teklif yönetimi.
-- Müşteriler ve teklifler mevcut tablolarda portal = 'ihracat' ile ayrı tutulur.
-- Bu betiği mevcut cromtest_egefe_crm veritabanında bir kez phpMyAdmin üzerinden çalıştırın.

SET NAMES utf8mb4;

-- ── 1. Portal enum'larına 'ihracat' eklenir ─────────────────────────────────
ALTER TABLE user_permissions
  MODIFY portal ENUM('servis','satis','stok','ihracat') NOT NULL;

ALTER TABLE quotes
  MODIFY portal ENUM('servis','satis','ihracat') NOT NULL;

-- ── 2. Müşteri: ülke ────────────────────────────────────────────────────────
ALTER TABLE customers
  ADD COLUMN ulke VARCHAR(100) NULL AFTER sehir;

-- ── 3. Teklif: Incoterms, teslim yeri, banka hesabı (teklif anındaki kopya) ──
-- Teslim süresi mevcut `teslimat`, ödeme koşulları mevcut `odeme_kosulu` alanında tutulur.
ALTER TABLE quotes
  ADD COLUMN incoterm     VARCHAR(10)  NULL AFTER teslimat,
  ADD COLUMN teslim_yeri  VARCHAR(150) NULL AFTER incoterm,
  ADD COLUMN banka_hesabi JSON         NULL AFTER teslim_yeri;

-- ── 4. Teklif kalemleri: ürün kodu, marka, model; birim serbest metin ───────
-- Yurtdışı tekliflerinde birimler İngilizce (Pcs, Set, Box...) olduğundan enum kaldırılır.
ALTER TABLE quote_line_items
  ADD COLUMN urun_kodu VARCHAR(100) NULL AFTER sira,
  ADD COLUMN marka     VARCHAR(100) NULL AFTER aciklama,
  ADD COLUMN model     VARCHAR(100) NULL AFTER marka,
  MODIFY birim VARCHAR(20) NOT NULL DEFAULT 'Adet';
