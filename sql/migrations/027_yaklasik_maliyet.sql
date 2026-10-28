-- EGEFE CRM - Migration 027
-- Yaklaşık Maliyet (Yurtdışı Satış Portalı): teklif öncesi fiyat araştırması.
-- Kalem alış fiyatı + navlun % + gümrük % + kâr % → teklif birim fiyatı; sonuç taslak teklife aktarılır.
-- Bu betiği mevcut cromtest_egefe_crm veritabanında bir kez phpMyAdmin üzerinden çalıştırın.

SET NAMES utf8mb4;

-- ── 1. Yaklaşık maliyet belgesi ─────────────────────────────────────────────
-- Durum saklanmaz: teklif_id yoksa Taslak, bağlı teklif Taslak ise "Teklife aktarıldı", değilse Kilitli.
-- Teklif silinirse teklif_id NULL olur ve belge kendiliğinden yeniden Taslak sayılır.
CREATE TABLE cost_estimates (
  id                  VARCHAR(40) PRIMARY KEY,
  numara              VARCHAR(30) NOT NULL,
  tarih               DATE NULL,
  para_birimi         ENUM('TRY','USD','EUR','GBP') NOT NULL DEFAULT 'USD',
  musteri_id          VARCHAR(40) NULL,
  musteri             JSON NULL,           -- {firma, kisi, email, tel, adres} — seçim anındaki kopya
  oranlar             JSON NULL,           -- varsayılan oranlar {frt, cus, mar}; boş = ''
  notlar              TEXT NULL,
  teklif_id           VARCHAR(40) NULL,
  olusturan_kullanici VARCHAR(40) NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_ce_numara (numara),
  UNIQUE KEY uniq_ce_teklif (teklif_id),
  CONSTRAINT fk_ce_musteri FOREIGN KEY (musteri_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_ce_teklif  FOREIGN KEY (teklif_id)  REFERENCES quotes(id)    ON DELETE SET NULL,
  CONSTRAINT fk_ce_user    FOREIGN KEY (olusturan_kullanici) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- ── 2. Kalemler ─────────────────────────────────────────────────────────────
-- Alış fiyatı ve oranlarda NULL = "henüz girilmedi" (satır eksik sayılır), 0 = geçerli değer.
-- satir_id kalıcıdır; teklife aktarımda teklif kalemiyle eşleştirmek için kullanılır.
CREATE TABLE cost_estimate_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  estimate_id VARCHAR(40) NOT NULL,
  satir_id    VARCHAR(40) NOT NULL,
  sira        INT NOT NULL DEFAULT 0,
  kategori    VARCHAR(100) NULL,
  aciklama    TEXT NULL,
  marka       VARCHAR(100) NULL,
  model       VARCHAR(100) NULL,
  birim       VARCHAR(20) NULL,
  adet        DECIMAL(15,3) NULL,
  alis        DECIMAL(15,4) NULL,
  navlun      DECIMAL(9,4) NULL,
  gumruk      DECIMAL(9,4) NULL,
  kar         DECIMAL(9,4) NULL,
  kaynak      TEXT NULL,
  KEY idx_cei_estimate (estimate_id),
  CONSTRAINT fk_cei_estimate FOREIGN KEY (estimate_id) REFERENCES cost_estimates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- ── 3. Teklif kalemleri: kategori + yaklaşık maliyet satır bağlantısı ───────
ALTER TABLE quote_line_items
  ADD COLUMN kategori    VARCHAR(100) NULL AFTER model,
  ADD COLUMN ym_satir_id VARCHAR(40)  NULL AFTER secili_parametreler;
