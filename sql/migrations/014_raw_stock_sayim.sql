-- Migration 014: Sheet & Strip (ham madde) fiziki stok sayimi kayitlari
-- Faz 1: sayim sadece kayit/karsilastirma amaclidir, kaydedildiginde stok miktarini degistirmez.
-- sistem_miktar, sayim anindaki mevcut_strip degerinin anlik goruntusudur (sonraki hareketlerden etkilenmez).
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
  sayilan_miktar INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_rsci_count FOREIGN KEY (count_id) REFERENCES raw_stock_counts(id) ON DELETE CASCADE,
  CONSTRAINT fk_rsci_lot FOREIGN KEY (lot_id) REFERENCES raw_stock_lots(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;
