-- Migration 016: Hazir Urun fiziki stok sayimi (Faz 1) + sayim duzeltme takibi (Faz 2)
-- Hazir Urun tarafinda da Ham tarafiyla ayni mantikta sayim: kaydedildiginde stok
-- miktarini degistirmez, sadece sistem/sayilan miktari karsilastirir.
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

-- Sayim duzeltmesi takibi: bir kalem duzeltildiginde, olusturulan giris/cikis
-- evrak numarasi buraya yazilir; NULL ise henuz duzeltilmemis demektir.
ALTER TABLE raw_stock_count_items
  ADD COLUMN duzeltme_evrak_no VARCHAR(50) NULL AFTER sayilan_miktar;
