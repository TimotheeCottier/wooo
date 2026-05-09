-- =========================================================
-- WOOO — Migration : deezer_id devient TEXT
-- ---------------------------------------------------------
-- Pourquoi ?
-- Pour Wooo Ciné, on stocke des IDs préfixés ("tmdb:movie:11"
-- ou "tmdb:tv:456") qui ne rentrent pas dans un BIGINT.
-- En passant la colonne en TEXT, on accepte aussi bien les
-- IDs Deezer numériques (ex. "12345678") que les IDs TMDB
-- préfixés. Rétrocompatible : les IDs Deezer existants seront
-- automatiquement castés en string.
--
-- À exécuter une seule fois dans :
-- Supabase Dashboard → SQL Editor → New Query → coller → Run
-- =========================================================

ALTER TABLE choix
  ALTER COLUMN deezer_id TYPE text USING deezer_id::text;
