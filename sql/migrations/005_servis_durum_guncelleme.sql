-- 005_servis_durum_guncelleme.sql
-- Teknik Servis portalı durum ifadelerini ve teklif ilişkisini günceller.

-- ─── service_records ────────────────────────────────────────────────────────

-- Adım 1: Geçiş sırasında eski + yeni değerlerin ikisi de geçerli olsun
ALTER TABLE service_records
  MODIFY COLUMN durum ENUM(
    'Yeni Gelen','S.F. Bekleniyor','Onay Bekleniyor','Onaylandı',
    'Kargoya Verildi','Tamamlandı','Reddedildi','İade Edildi',
    'Cihaz Kabul','Arıza Tespitinde','Yanıt Bekleniyor','Onarımda',
    'Teslim Edildi','İşlemsiz İade'
  ) NOT NULL DEFAULT 'Yeni Gelen';

-- Adım 2: Mevcut kayıtları yeni değerlere migrate et
UPDATE service_records SET durum = CASE durum
  WHEN 'Yeni Gelen'      THEN 'Cihaz Kabul'
  WHEN 'S.F. Bekleniyor' THEN 'Arıza Tespitinde'
  WHEN 'Onay Bekleniyor' THEN 'Yanıt Bekleniyor'
  WHEN 'Onaylandı'       THEN 'Onarımda'
  WHEN 'Kargoya Verildi' THEN 'Teslim Edildi'
  WHEN 'Tamamlandı'      THEN 'Teslim Edildi'
  WHEN 'İade Edildi'     THEN 'İşlemsiz İade'
  ELSE durum
END;

-- Adım 3: ENUM'u sadece yeni değerlerle sabitle
ALTER TABLE service_records
  MODIFY COLUMN durum ENUM(
    'Cihaz Kabul','Arıza Tespitinde','Yanıt Bekleniyor','Onarımda',
    'Teslim Edildi','Reddedildi','İşlemsiz İade'
  ) NOT NULL DEFAULT 'Cihaz Kabul';

-- ─── quotes (teklifler) ──────────────────────────────────────────────────────
-- Sadece portal='servis' kayıtlar etkilenir.
-- Satış portalı değerleri (Açık Teklif, Siparişe Aktarıldı, İptal Edildi, Gönderildi) dokunulmaz.

-- Adım 4: Yeni teklif değerlerini ENUM'a ekle (eski + yeni birlikte)
ALTER TABLE quotes
  MODIFY COLUMN durum ENUM(
    'Taslak','Açık Teklif','Onay Bekleniyor','Onaylandı','Kabul Edildi',
    'Siparişe Aktarıldı','Gönderildi','Reddedildi','İptal Edildi','Tamamlandı',
    'İletildi','Kapandı'
  ) NOT NULL DEFAULT 'Taslak';

-- Adım 5: Teknik Servis teklif kayıtlarını yeni değerlere migrate et
UPDATE quotes SET durum = 'İletildi'     WHERE durum = 'Onay Bekleniyor' AND portal = 'servis';
UPDATE quotes SET durum = 'Kabul Edildi' WHERE durum = 'Onaylandı'       AND portal = 'servis';
UPDATE quotes SET durum = 'Kapandı'      WHERE durum = 'Tamamlandı'      AND portal = 'servis';

-- Adım 6: Artık kullanılmayan Servis-özel değerleri ENUM'dan kaldır
ALTER TABLE quotes
  MODIFY COLUMN durum ENUM(
    'Taslak','Açık Teklif','İletildi','Kabul Edildi',
    'Siparişe Aktarıldı','Gönderildi','Reddedildi','İptal Edildi','Kapandı'
  ) NOT NULL DEFAULT 'Taslak';
