-- Notlar tablosu
CREATE TABLE IF NOT EXISTS notlar (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    portal     VARCHAR(20) NOT NULL,
    tur        ENUM('kisisel','takim') NOT NULL,
    yazar_id   VARCHAR(50) NOT NULL,
    yazar_ad   VARCHAR(255) NOT NULL,
    metin      TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_portal_tur (portal, tur),
    INDEX idx_yazar (yazar_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Not cevapları tablosu
CREATE TABLE IF NOT EXISTS notlar_cevaplar (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    not_id     INT NOT NULL,
    yazar_id   VARCHAR(50) NOT NULL,
    yazar_ad   VARCHAR(255) NOT NULL,
    metin      TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (not_id) REFERENCES notlar(id) ON DELETE CASCADE,
    INDEX idx_not_id (not_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
