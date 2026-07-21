-- Migration 012: Teklif ve servis kayitlarinin durum degisikliklerini tarihiyle birlikte tutan genel gecmis tablosu
-- (Sureç Geçmişi zaman çizelgesi icin) - bundan sonraki durum degisikliklerini kaydeder, gecmise donuk veri uretmez
CREATE TABLE status_history (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  entity_type   ENUM('teklif','servis') NOT NULL,
  entity_id     VARCHAR(40) NOT NULL,
  durum         VARCHAR(50) NOT NULL,
  tarih         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  kullanici_id  VARCHAR(40) NULL,
  KEY idx_status_history_entity (entity_type, entity_id),
  CONSTRAINT fk_status_history_user FOREIGN KEY (kullanici_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;
