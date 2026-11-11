-- 030_kesim_boleni_ondalik.sql
-- Yarı mamul kategorilerinde Kesim Böleni (mm) ondalıklı girilebilsin (ör. 3,98 mm).
ALTER TABLE stock_categories MODIFY kesim_boleni DECIMAL(10,3) NULL;
