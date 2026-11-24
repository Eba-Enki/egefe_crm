-- Migration 031: Teklife satış temsilcisi (kullanıcı) bağlantısı.
-- Temsilci formdan seçilir; liste sütunu ve PDF "Teklifi Hazırlayan" imzası bu kişiden gelir.
-- olusturan_kullanici, teklifi sisteme fiilen giren kişi olarak (iz kaydı) aynen kalır.
-- Bu betiği deploy'dan ÖNCE phpMyAdmin üzerinden bir kez çalıştırın.

SET NAMES utf8mb4;
ALTER TABLE quotes
  ADD COLUMN temsilci_kullanici VARCHAR(40) NULL AFTER sorumlu,
  ADD CONSTRAINT fk_quotes_temsilci FOREIGN KEY (temsilci_kullanici) REFERENCES users(id) ON DELETE SET NULL;

-- Mevcut kayıtlar: önce listede görünen temsilci adına (sorumlu) göre eşle,
-- eşleşmeyenlerde teklifi oluşturan kullanıcıyı ata.
UPDATE quotes q JOIN users u ON u.ad = q.sorumlu
  SET q.temsilci_kullanici = u.id
  WHERE q.temsilci_kullanici IS NULL;

UPDATE quotes
  SET temsilci_kullanici = olusturan_kullanici
  WHERE temsilci_kullanici IS NULL AND olusturan_kullanici IS NOT NULL;
