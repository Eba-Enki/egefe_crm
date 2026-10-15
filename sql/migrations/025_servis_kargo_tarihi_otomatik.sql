-- 025_servis_kargo_tarihi_otomatik.sql
-- Kargo tarihi artık kuruma geri gönderim tarihidir ve API tarafından otomatik atanır:
-- servis Teslim Edildi / Reddedildi / İşlemsiz İade durumuna geçtiğinde o günün tarihi yazılır.
-- Kargo firması ve teslim alan bilgileri kaldırıldı.

SET NAMES utf8mb4;

-- ── 1. Gönderim durumundaki kayıtlara geçmişteki durum tarihini yaz ──────────
-- (status_history 012 ile geldi; öncesinde kapanan kayıtlarda mevcut değer korunur)
UPDATE service_records sr
  JOIN (
    SELECT sh.entity_id, DATE(MAX(sh.tarih)) AS t
    FROM status_history sh
    JOIN service_records s ON s.id = sh.entity_id AND s.durum = sh.durum
    WHERE sh.entity_type = 'servis'
    GROUP BY sh.entity_id
  ) h ON h.entity_id = sr.id
  SET sr.kargo_tarihi = h.t
  WHERE sr.durum IN ('Teslim Edildi','Reddedildi','İşlemsiz İade');

-- ── 2. Henüz gönderilmemiş kayıtlarda elle girilmiş tarihleri temizle ────────
UPDATE service_records
  SET kargo_tarihi = NULL
  WHERE durum NOT IN ('Teslim Edildi','Reddedildi','İşlemsiz İade');

-- ── 3. Kullanılmayan kolonları kaldır ────────────────────────────────────────
ALTER TABLE service_records
  DROP COLUMN kargo_firmasi,
  DROP COLUMN teslim_alan;
