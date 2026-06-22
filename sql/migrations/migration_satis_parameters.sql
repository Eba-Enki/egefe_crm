-- =====================================================================
-- Satış Pazarlama Portalı — Test Parametreleri tablo oluşturma
-- Bu SQL'i veritabanında BİR KERE çalıştırın.
-- stock_parameters ile aynı yapıdadır, tamamen ayrı bir tablodur.
-- =====================================================================

CREATE TABLE IF NOT EXISTS satis_parameters (
    id       INT AUTO_INCREMENT PRIMARY KEY,
    ad       VARCHAR(100) NOT NULL DEFAULT '',
    kisaltma VARCHAR(20)  NOT NULL DEFAULT '',
    aktif    TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- OPSİYONEL: Eski settings JSON'ındaki parametreleri tabloya aktar.
-- Eğer daha önce hiç parametre eklenmemişse bu bölümü atlayabilirsiniz.
-- MySQL 5.7+ ve JSON_EXTRACT desteği gerektirir.
-- =====================================================================

-- Eski verideki her parametreyi parse edip tabloya ekler.
-- "Glikoz||GLU" → ad=Glikoz, kisaltma=GLU
-- "GLU"         → ad='',     kisaltma=GLU
INSERT INTO satis_parameters (ad, kisaltma, aktif)
SELECT
    CASE
        WHEN LOCATE('||', val) > 0 THEN SUBSTRING(val, 1, LOCATE('||', val) - 1)
        ELSE ''
    END AS ad,
    CASE
        WHEN LOCATE('||', val) > 0 THEN UPPER(SUBSTRING(val, LOCATE('||', val) + 2))
        ELSE UPPER(val)
    END AS kisaltma,
    1 AS aktif
FROM (
    SELECT JSON_UNQUOTE(JSON_EXTRACT(data, CONCAT('$.parametreler[', n, ']'))) AS val
    FROM settings
    JOIN (
        SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
        UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
        UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14
        UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19
    ) nums
    WHERE portal = 'satis'
      AND JSON_EXTRACT(data, CONCAT('$.parametreler[', n, ']')) IS NOT NULL
) src
WHERE val IS NOT NULL AND val <> ''
ON DUPLICATE KEY UPDATE kisaltma = kisaltma;
