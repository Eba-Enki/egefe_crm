-- Migration 008: users tablosuna telefon kolonu eklendi
ALTER TABLE users ADD COLUMN telefon VARCHAR(50) NULL AFTER email;
