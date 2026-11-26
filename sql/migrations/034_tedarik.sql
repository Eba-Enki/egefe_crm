-- EGEFE CRM - Migration 034
-- Tedarik (satın alma) modülü: tedarik listeleri, kalemleri ve A/B/C sınıflarının
-- elle verilen değerleri. Otomatik sınıflar çıkış geçmişinden anlık hesaplanır;
-- burada yalnızca kullanıcının elle değiştirdiği sınıflar saklanır.
-- Bu betiği mevcut cromtest_egefe_crm veritabanında bir kez phpMyAdmin üzerinden çalıştırın.

CREATE TABLE IF NOT EXISTS stock_purchase_orders (
  id                  VARCHAR(40) PRIMARY KEY,
  evrak_no            VARCHAR(50) NULL,
  tarih               DATE NULL,
  tedarikci           VARCHAR(255) NULL,
  notlar              TEXT NULL,
  durum               VARCHAR(40) NOT NULL DEFAULT 'Taslak',
  hedefler            JSON NULL,
  olusturan_kullanici VARCHAR(40) NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_spo_evrak (evrak_no),
  CONSTRAINT fk_spo_user FOREIGN KEY (olusturan_kullanici) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

CREATE TABLE IF NOT EXISTS stock_purchase_order_items (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  order_id      VARCHAR(40) NOT NULL,
  sira          INT NOT NULL DEFAULT 0,
  kaynak        VARCHAR(10) NOT NULL,          -- 'ham' (yarı mamul) | 'bitmis' (hazır ürün)
  kategori_id   VARCHAR(40) NULL,
  anahtar       VARCHAR(500) NULL,             -- stok eşleştirme anahtarı (ham: parametre adı, bitmiş: ürün grubu)
  tam_ad        VARCHAR(255) NOT NULL,
  kisaltma      VARCHAR(255) NULL,
  cutoff        VARCHAR(500) NULL,
  marka         VARCHAR(150) NULL,
  model         VARCHAR(150) NULL,
  sinif         CHAR(1) NULL,
  mevcut        DECIMAL(15,3) NULL,            -- liste hazırlanırken stoktaki miktar (anlık görüntü)
  hedef         DECIMAL(15,3) NULL,
  miktar        DECIMAL(15,3) NOT NULL DEFAULT 0,
  birim         VARCHAR(10) NOT NULL DEFAULT 'sheet',
  manuel        TINYINT(1) NOT NULL DEFAULT 0,
  kabul_edilen  DECIMAL(15,3) NOT NULL DEFAULT 0,
  KEY idx_spoi_order (order_id),
  CONSTRAINT fk_spoi_order FOREIGN KEY (order_id) REFERENCES stock_purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_spoi_kategori FOREIGN KEY (kategori_id) REFERENCES stock_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

CREATE TABLE IF NOT EXISTS stock_item_classes (
  kaynak       VARCHAR(10) NOT NULL,
  kategori_id  VARCHAR(40) NOT NULL,
  anahtar      VARCHAR(255) NOT NULL,
  sinif        CHAR(1) NOT NULL,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (kaynak, kategori_id, anahtar),
  CONSTRAINT fk_sic_kategori FOREIGN KEY (kategori_id) REFERENCES stock_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;
