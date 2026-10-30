-- 028_referans_standartlar.sql
-- Stok portalı: Referans standart (ana stok) takibi — Faz 1
-- Hacimler µL, konsantrasyonlar µg/mL olarak tutulur.
-- Kalan hacim ref_hareketler toplamından türetilir; ref_ana_stoklar.kalan_hacim
-- her harekette aynı transaction içinde güncellenen önbellek değerdir.

SET NAMES utf8mb4;

CREATE TABLE ref_ana_stoklar (
  id                  VARCHAR(40) PRIMARY KEY,
  kod                 VARCHAR(20) NOT NULL,
  grup                VARCHAR(30) NULL,            -- test parametresi kısaltması (AMP, BZD, COC...)
  standart_adi        VARCHAR(200) NOT NULL,       -- analit / stok adı
  katalog_no          VARCHAR(100) NULL,
  lot_no              VARCHAR(100) NULL,
  uretici             VARCHAR(150) NULL,
  konsantrasyon       DECIMAL(15,6) NULL,          -- µg/mL; bilinmiyorsa NULL
  cozucu              VARCHAR(50) NULL,
  ilk_hacim           DECIMAL(12,3) NOT NULL DEFAULT 0,  -- µL
  kalan_hacim         DECIMAL(12,3) NOT NULL DEFAULT 0,  -- µL
  durum               ENUM('Kapalı Ambalaj','Açık Ambalaj','Tükendi','İmha') NOT NULL DEFAULT 'Kapalı Ambalaj',
  acilis_tarihi       DATE NULL,
  skt                 DATE NULL,                   -- açılmış standart için geçerli SKT
  konum_tipi          VARCHAR(50) NULL,            -- Ampul Kutusu / Siyah Rack / Mor Rack ...
  konum_pozisyon      VARCHAR(30) NULL,
  dogrulanmadi        TINYINT(1) NOT NULL DEFAULT 0,
  notlar              TEXT NULL,
  olusturan_kullanici VARCHAR(40) NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ref_ana_kod (kod),
  KEY idx_ref_ana_grup (grup),
  KEY idx_ref_ana_durum (durum),
  CONSTRAINT fk_ref_ana_user FOREIGN KEY (olusturan_kullanici) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- Hacim hareketleri. stok_tipi ileride 'ara' ve 'kontrol' için de kullanılacak (Faz 2).
CREATE TABLE ref_hareketler (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  stok_tipi     ENUM('ana','ara','kontrol') NOT NULL,
  stok_id       VARCHAR(40) NOT NULL,
  tip           ENUM('Giriş','Açılış','Kullanım','Müşteriye Verildi','İç Test','Sayım Düzeltme','İmha') NOT NULL,
  miktar        DECIMAL(12,3) NOT NULL DEFAULT 0,  -- µL; giriş +, tüketim -, düzeltme ±
  kalan_sonra   DECIMAL(12,3) NOT NULL DEFAULT 0,
  tarih         DATE NOT NULL,
  aciklama      VARCHAR(255) NULL,
  ilgili_id     VARCHAR(40) NULL,                  -- hazırlanan çözelti vb. (Faz 2)
  kullanici_id  VARCHAR(40) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ref_har_stok (stok_tipi, stok_id),
  KEY idx_ref_har_ilgili (ilgili_id),
  CONSTRAINT fk_ref_har_user FOREIGN KEY (kullanici_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;
