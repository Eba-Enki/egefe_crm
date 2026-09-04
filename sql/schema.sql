-- EGEFE CRM - MySQL/MariaDB şeması (Faz 2)
-- Hedef: cromtest_egefe_crm veritabanı (phpMyAdmin üzerinden içe aktarılacak)
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ───────────────────────── KULLANICILAR & YETKİLER ─────────────────────────

CREATE TABLE users (
  id            VARCHAR(40) PRIMARY KEY,
  ad            VARCHAR(150) NOT NULL,
  username      VARCHAR(100) NOT NULL UNIQUE,
  sifre_hash    VARCHAR(255) NOT NULL,
  sifre_salt    VARCHAR(255) NULL,
  email         VARCHAR(150) NULL,
  rol           ENUM('yonetici','kullanici','izleyici') NOT NULL DEFAULT 'kullanici',
  son_giris     DATETIME NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

CREATE TABLE user_permissions (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  user_id   VARCHAR(40) NOT NULL,
  portal    ENUM('servis','satis','stok') NOT NULL,
  erisim    TINYINT(1) NOT NULL DEFAULT 0,
  sayfalar  JSON NULL,
  UNIQUE KEY uniq_user_portal (user_id, portal),
  CONSTRAINT fk_perm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- ───────────────────────────── MÜŞTERİLER ──────────────────────────────────

CREATE TABLE customers (
  id          VARCHAR(40) PRIMARY KEY,
  kayit_no    VARCHAR(30) NULL,
  portal      VARCHAR(10) NOT NULL DEFAULT 'servis',
  kurum       VARCHAR(255) NOT NULL,
  kisi        VARCHAR(150) NULL,
  tel         VARCHAR(50) NULL,
  email       VARCHAR(150) NULL,
  sehir       VARCHAR(100) NULL,
  adres       TEXT NULL,
  notlar      TEXT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_customers_kurum (kurum),
  KEY idx_customers_kayit_no (kayit_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- ────────────────────────────── ÜRÜNLER ────────────────────────────────────

CREATE TABLE product_categories (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  portal  ENUM('servis','satis') NOT NULL,
  ad      VARCHAR(100) NOT NULL,
  UNIQUE KEY uniq_portal_ad (portal, ad)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

CREATE TABLE products (
  id          VARCHAR(40) PRIMARY KEY,
  portal      ENUM('servis','satis') NOT NULL,
  urun_kodu   VARCHAR(100) NULL,
  urun_adi    VARCHAR(255) NOT NULL,
  marka       VARCHAR(150) NULL,
  model       VARCHAR(150) NULL,
  kategori    VARCHAR(100) NULL,
  fiyat       DECIMAL(15,2) NOT NULL DEFAULT 0,
  para_birimi ENUM('TRY','USD','EUR','GBP') NOT NULL DEFAULT 'TRY',
  aciklama    TEXT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_products_portal_kategori (portal, kategori)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- ─────────────────────────── SERVİS KAYITLARI ──────────────────────────────

CREATE TABLE service_records (
  id                  VARCHAR(40) PRIMARY KEY,
  kayit_no            VARCHAR(30) UNIQUE,
  musteri_id          VARCHAR(40) NULL,
  kurum_adi           VARCHAR(255) NOT NULL,
  ilgili_kisi         VARCHAR(150) NULL,
  telefon             VARCHAR(50) NULL,
  email               VARCHAR(150) NULL,
  urun_adi            VARCHAR(255) NULL,
  marka               VARCHAR(150) NULL,
  model               VARCHAR(150) NULL,
  seri_no             VARCHAR(255) NULL,
  aksesuarlar         JSON NULL,
  aksesuar_diger      VARCHAR(255) NULL,
  gelis_tarihi        DATE NULL,
  garanti_durumu      ENUM('Evet','Hayır') NOT NULL DEFAULT 'Hayır',
  durum               ENUM('Cihaz Kabul','Arıza Tespitinde','Yanıt Bekleniyor','Onarımda','Teslim Edildi','Reddedildi','İşlemsiz İade') NOT NULL DEFAULT 'Cihaz Kabul',
  kargo_tarihi        DATE NULL,
  kargo_firmasi       VARCHAR(150) NULL,
  teslim_alan         VARCHAR(150) NULL,
  notlar              TEXT NULL,
  olusturan_kullanici VARCHAR(40) NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_servis_durum (durum),
  KEY idx_servis_musteri (musteri_id),
  CONSTRAINT fk_servis_musteri FOREIGN KEY (musteri_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_servis_user FOREIGN KEY (olusturan_kullanici) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- ──────────────────────────────── TEKLİFLER ────────────────────────────────

CREATE TABLE quotes (
  id                  VARCHAR(40) PRIMARY KEY,
  portal              ENUM('servis','satis') NOT NULL,
  teklif_no           VARCHAR(30) UNIQUE,
  musteri_id          VARCHAR(40) NULL,
  servis_id           VARCHAR(40) NULL,
  kayit_no            VARCHAR(30) NULL,
  seri_no             VARCHAR(255) NULL,
  kurum               VARCHAR(255) NULL,
  ilgili_kisi         VARCHAR(150) NULL,
  telefon             VARCHAR(50) NULL,
  email               VARCHAR(150) NULL,
  teklif_tarihi       DATE NULL,
  gecerlilik_tarihi   DATE NULL,
  notlar              TEXT NULL,
  para_birimi         ENUM('TRY','USD','EUR','GBP') NOT NULL DEFAULT 'TRY',
  odeme_kosulu        VARCHAR(100) NULL,
  vade                VARCHAR(100) NULL,
  teslimat            VARCHAR(150) NULL,
  sorumlu             VARCHAR(150) NULL,
  durum               ENUM('Taslak','İletildi','Kabul Edildi','Siparişe Dönüştü','Reddedildi','Kapandı') NOT NULL DEFAULT 'Taslak',
  red_nedeni          VARCHAR(255) NULL,
  olusturan_kullanici VARCHAR(40) NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_quotes_durum (durum),
  KEY idx_quotes_musteri (musteri_id),
  CONSTRAINT fk_quotes_musteri FOREIGN KEY (musteri_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_quotes_servis FOREIGN KEY (servis_id) REFERENCES service_records(id) ON DELETE SET NULL,
  CONSTRAINT fk_quotes_user FOREIGN KEY (olusturan_kullanici) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

CREATE TABLE quote_line_items (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  quote_id              VARCHAR(40) NOT NULL,
  sira                  INT NOT NULL DEFAULT 0,
  aciklama              TEXT NULL,
  miktar                DECIMAL(15,3) NOT NULL DEFAULT 0,
  birim                 ENUM('Adet','Saat','Gün','Parça') NOT NULL DEFAULT 'Adet',
  birim_fiyat           DECIMAL(15,2) NOT NULL DEFAULT 0,
  secili_parametreler   JSON NULL,
  CONSTRAINT fk_qli_quote FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- ──────────────────────────────── SİPARİŞLER ───────────────────────────────

CREATE TABLE orders (
  id                  VARCHAR(40) PRIMARY KEY,
  siparis_no          VARCHAR(30) UNIQUE,
  teklif_id           VARCHAR(40) NULL,
  teklif_no           VARCHAR(30) NULL,
  kurum               VARCHAR(255) NULL,
  ilgili_kisi         VARCHAR(150) NULL,
  telefon             VARCHAR(50) NULL,
  email               VARCHAR(150) NULL,
  sorumlu             VARCHAR(150) NULL,
  satis_temsilcisi    VARCHAR(150) NULL,
  para_birimi         ENUM('TRY','USD','EUR','GBP') NOT NULL DEFAULT 'TRY',
  odeme_kosulu        VARCHAR(100) NULL,
  vade                VARCHAR(100) NULL,
  teslimat            VARCHAR(150) NULL,
  teklif_tarihi       DATE NULL,
  siparis_tarihi      DATE NULL,
  tahmini_teslimat    DATE NULL,
  notlar              TEXT NULL,
  durum               ENUM('Hazırlanıyor','Kısmi Teslimat','Teslim Edildi','İptal','Fatura Edildi') NOT NULL DEFAULT 'Hazırlanıyor',
  olusturan_kullanici VARCHAR(40) NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_orders_durum (durum),
  KEY idx_orders_teklif (teklif_id),
  CONSTRAINT fk_orders_teklif FOREIGN KEY (teklif_id) REFERENCES quotes(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_user FOREIGN KEY (olusturan_kullanici) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

CREATE TABLE order_line_items (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  order_id              VARCHAR(40) NOT NULL,
  sira                  INT NOT NULL DEFAULT 0,
  aciklama              TEXT NULL,
  miktar                DECIMAL(15,3) NOT NULL DEFAULT 0,
  gonderilen            DECIMAL(15,3) NOT NULL DEFAULT 0,
  faturalanan           DECIMAL(15,3) NOT NULL DEFAULT 0,
  birim                 ENUM('Adet','Saat','Gün','Parça') NOT NULL DEFAULT 'Adet',
  birim_fiyat           DECIMAL(15,2) NOT NULL DEFAULT 0,
  secili_parametreler   JSON NULL,
  CONSTRAINT fk_oli_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- ──────────────────────────────── FATURALAR ────────────────────────────────

CREATE TABLE invoices (
  id              VARCHAR(40) PRIMARY KEY,
  fatura_no       VARCHAR(50) NULL,
  siparis_id      VARCHAR(40) NULL,
  tutar           DECIMAL(15,2) NOT NULL DEFAULT 0,
  fatura_tarihi   DATE NULL,
  vade_tarihi     DATE NULL,
  durum           ENUM('Ödendi','Ödenmedi') NOT NULL DEFAULT 'Ödenmedi',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_fatura_no (fatura_no),
  CONSTRAINT fk_invoices_order FOREIGN KEY (siparis_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- ─────────────────────────────── TUTANAKLAR ────────────────────────────────

CREATE TABLE delivery_protocols (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  protokol_no   VARCHAR(30) UNIQUE,
  tarih         DATE NULL,
  olusturan     VARCHAR(150) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

CREATE TABLE delivery_protocol_items (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  protocol_id     INT NOT NULL,
  servis_id       VARCHAR(40) NULL,
  kayit_no        VARCHAR(30) NULL,
  kurum_adi       VARCHAR(255) NULL,
  seri_no         VARCHAR(255) NULL,
  garanti_durumu  ENUM('Evet','Hayır') NULL,
  aksesuarlar     VARCHAR(255) NULL,
  urun_adi        VARCHAR(255) NULL,
  gelis_tarihi    DATE NULL,
  CONSTRAINT fk_dpi_protocol FOREIGN KEY (protocol_id) REFERENCES delivery_protocols(id) ON DELETE CASCADE,
  CONSTRAINT fk_dpi_servis FOREIGN KEY (servis_id) REFERENCES service_records(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- ───────────────────────────────── STOK ────────────────────────────────────

CREATE TABLE stock_categories (
  id              VARCHAR(40) PRIMARY KEY,
  tip             ENUM('ham','ticari') NOT NULL,
  ad              VARCHAR(150) NOT NULL,
  sheet_boyu      INT NULL,
  kesim_boleni    INT NULL,
  fire_pct        DECIMAL(5,2) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

CREATE TABLE stock_parameters (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  ad        VARCHAR(150) NOT NULL,
  kisaltma  VARCHAR(50) NULL,
  aktif     TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- Ham madde girişleri
CREATE TABLE raw_stock_entries (
  id                  VARCHAR(40) PRIMARY KEY,
  evrak_no            VARCHAR(50) NULL,
  tarih               DATE NULL,
  notlar              TEXT NULL,
  olusturan_kullanici VARCHAR(40) NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rse_user FOREIGN KEY (olusturan_kullanici) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- Ham madde lotları
CREATE TABLE raw_stock_lots (
  id                  VARCHAR(40) PRIMARY KEY,
  giris_id            VARCHAR(40) NULL,
  evrak_no            VARCHAR(50) NULL,
  lot_no              VARCHAR(100) NULL,
  tarih               DATE NULL,
  parametre_ad        VARCHAR(150) NULL,
  cutoff              VARCHAR(50) NULL,
  ek_ozellik          VARCHAR(150) NULL,
  kategori_id         VARCHAR(40) NULL,
  sheet_giren         DECIMAL(10,2) NOT NULL DEFAULT 0,
  strip_giren         INT NOT NULL DEFAULT 0,
  mevcut_strip        INT NOT NULL DEFAULT 0,
  skt_tarih           VARCHAR(7) NULL,
  olusturan_kullanici VARCHAR(40) NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_rsl_kategori (kategori_id),
  KEY idx_rsl_parametre (parametre_ad),
  KEY idx_rsl_skt (skt_tarih),
  CONSTRAINT fk_rsl_giris FOREIGN KEY (giris_id) REFERENCES raw_stock_entries(id) ON DELETE SET NULL,
  CONSTRAINT fk_rsl_kategori FOREIGN KEY (kategori_id) REFERENCES stock_categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_rsl_user FOREIGN KEY (olusturan_kullanici) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- Ham madde çıkışları
CREATE TABLE raw_stock_exits (
  id                  VARCHAR(40) PRIMARY KEY,
  evrak_no            VARCHAR(50) NULL,
  tarih               DATE NULL,
  kategori_id         VARCHAR(40) NULL,
  aciklama            TEXT NULL,
  notlar              TEXT NULL,
  kit_miktari         DECIMAL(15,3) NULL,
  olusturan_kullanici VARCHAR(40) NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rsx_kategori FOREIGN KEY (kategori_id) REFERENCES stock_categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_rsx_user FOREIGN KEY (olusturan_kullanici) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

CREATE TABLE raw_stock_exit_items (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  exit_id       VARCHAR(40) NOT NULL,
  lot_id        VARCHAR(40) NULL,
  strip_cikis   INT NOT NULL DEFAULT 0,
  parametre_ad  VARCHAR(150) NULL,
  CONSTRAINT fk_rsxi_exit FOREIGN KEY (exit_id) REFERENCES raw_stock_exits(id) ON DELETE CASCADE,
  CONSTRAINT fk_rsxi_lot FOREIGN KEY (lot_id) REFERENCES raw_stock_lots(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- Ham madde fiziki stok sayimi kayitlari (sayim, kaydedildiginde stok miktarini degistirmez)
CREATE TABLE raw_stock_counts (
  id                  VARCHAR(40) PRIMARY KEY,
  evrak_no            VARCHAR(50) NULL,
  tarih               DATE NULL,
  kategori_id         VARCHAR(40) NULL,
  notlar              TEXT NULL,
  olusturan_kullanici VARCHAR(40) NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rsc_kategori FOREIGN KEY (kategori_id) REFERENCES stock_categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_rsc_user FOREIGN KEY (olusturan_kullanici) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

CREATE TABLE raw_stock_count_items (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  count_id       VARCHAR(40) NOT NULL,
  lot_id         VARCHAR(40) NULL,
  parametre_ad   VARCHAR(150) NULL,
  sistem_miktar  INT NOT NULL DEFAULT 0,
  sayilan_sheet  DECIMAL(10,2) NOT NULL DEFAULT 0,
  sayilan_strip  INT NOT NULL DEFAULT 0,
  sayilan_miktar INT NOT NULL DEFAULT 0,
  duzeltme_evrak_no VARCHAR(50) NULL,
  CONSTRAINT fk_rsci_count FOREIGN KEY (count_id) REFERENCES raw_stock_counts(id) ON DELETE CASCADE,
  CONSTRAINT fk_rsci_lot FOREIGN KEY (lot_id) REFERENCES raw_stock_lots(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- Bitmiş ürün girişleri
CREATE TABLE finished_stock_entries (
  id                  VARCHAR(40) PRIMARY KEY,
  evrak_no            VARCHAR(50) NULL,
  tarih               DATE NULL,
  notlar              TEXT NULL,
  olusturan_kullanici VARCHAR(40) NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fse_user FOREIGN KEY (olusturan_kullanici) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- Bitmiş ürün lotları
CREATE TABLE finished_stock_lots (
  id                  VARCHAR(40) PRIMARY KEY,
  giris_id            VARCHAR(40) NULL,
  evrak_no            VARCHAR(50) NULL,
  lot_no              VARCHAR(100) NULL,
  tarih               DATE NULL,
  urun_adi            VARCHAR(255) NULL,
  kategori_id         VARCHAR(40) NULL,
  parametreler        JSON NULL,
  miktar              DECIMAL(15,3) NOT NULL DEFAULT 0,
  mevcut_miktar       DECIMAL(15,3) NOT NULL DEFAULT 0,
  skt_tarih           VARCHAR(7) NULL,
  olusturan_kullanici VARCHAR(40) NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_fsl_kategori (kategori_id),
  KEY idx_fsl_urun (urun_adi),
  KEY idx_fsl_skt (skt_tarih),
  CONSTRAINT fk_fsl_giris FOREIGN KEY (giris_id) REFERENCES finished_stock_entries(id) ON DELETE SET NULL,
  CONSTRAINT fk_fsl_kategori FOREIGN KEY (kategori_id) REFERENCES stock_categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_fsl_user FOREIGN KEY (olusturan_kullanici) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- Bitmiş ürün çıkışları
CREATE TABLE finished_stock_exits (
  id                  VARCHAR(40) PRIMARY KEY,
  evrak_no            VARCHAR(50) NULL,
  tarih               DATE NULL,
  kategori_id         VARCHAR(40) NULL,
  aciklama            TEXT NULL,
  notlar              TEXT NULL,
  olusturan_kullanici VARCHAR(40) NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fsx_kategori FOREIGN KEY (kategori_id) REFERENCES stock_categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_fsx_user FOREIGN KEY (olusturan_kullanici) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

CREATE TABLE finished_stock_exit_items (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  exit_id       VARCHAR(40) NOT NULL,
  lot_id        VARCHAR(40) NULL,
  miktar_cikis  DECIMAL(15,3) NOT NULL DEFAULT 0,
  CONSTRAINT fk_fsxi_exit FOREIGN KEY (exit_id) REFERENCES finished_stock_exits(id) ON DELETE CASCADE,
  CONSTRAINT fk_fsxi_lot FOREIGN KEY (lot_id) REFERENCES finished_stock_lots(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- Hazır ürün fiziki stok sayımı kayıtları (sayım, kaydedildiğinde stok miktarını değiştirmez)
CREATE TABLE finished_stock_counts (
  id                  VARCHAR(40) PRIMARY KEY,
  evrak_no            VARCHAR(50) NULL,
  tarih               DATE NULL,
  kategori_id         VARCHAR(40) NULL,
  notlar              TEXT NULL,
  olusturan_kullanici VARCHAR(40) NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fsc_kategori FOREIGN KEY (kategori_id) REFERENCES stock_categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_fsc_user FOREIGN KEY (olusturan_kullanici) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

CREATE TABLE finished_stock_count_items (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  count_id         VARCHAR(40) NOT NULL,
  lot_id           VARCHAR(40) NULL,
  urun_adi         VARCHAR(255) NULL,
  sistem_miktar    DECIMAL(15,3) NOT NULL DEFAULT 0,
  sayilan_miktar   DECIMAL(15,3) NOT NULL DEFAULT 0,
  duzeltme_evrak_no VARCHAR(50) NULL,
  CONSTRAINT fk_fsci_count FOREIGN KEY (count_id) REFERENCES finished_stock_counts(id) ON DELETE CASCADE,
  CONSTRAINT fk_fsci_lot FOREIGN KEY (lot_id) REFERENCES finished_stock_lots(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- ────────────────────────────────── AYARLAR ────────────────────────────────
-- Portal başına genel ayarlar (firma bilgileri, numaralandırma önekleri,
-- stok modülü için çıkış nedenleri / global eşik vb.) JSON olarak saklanır.

CREATE TABLE settings (
  portal  VARCHAR(20) PRIMARY KEY,
  data    JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

SET FOREIGN_KEY_CHECKS = 1;
