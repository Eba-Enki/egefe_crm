-- Migration 011: Satış Pazarlama Portalı için müşteri kaydına çoklu ilgili kişi listesi eklendi
-- (Ad Soyad, Departman, Telefon, E-posta) - Teknik Servis Portalında kullanılmaz
ALTER TABLE customers ADD COLUMN iletisim_kisileri JSON NULL AFTER kisi;
