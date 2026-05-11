-- =========================================================
-- WOOO — Migration : élargir les valeurs de la colonne produit
-- ---------------------------------------------------------
-- La colonne 'produit' de la table 'parties' acceptait déjà du
-- text, mais on documente ici les nouvelles valeurs possibles
-- après séparation cinéma/série :
--   - 'musique'
--   - 'cinema'
--   - 'serie'
--
-- Les anciennes parties avec produit='cine' restent compatibles
-- côté code (on les traite comme 'cinema' par défaut).
--
-- Cette migration est OPTIONNELLE : aucune commande SQL n'est
-- strictement nécessaire si la colonne est déjà en TEXT.
-- =========================================================

-- Optionnel : ajouter un commentaire pour documenter
COMMENT ON COLUMN parties.produit IS 'Catégorie : musique, cinema, serie';

-- Optionnel : migrer les anciennes parties 'cine' en 'cinema'
-- (à ne faire que si tu veux nettoyer la donnée)
-- UPDATE parties SET produit = 'cinema' WHERE produit = 'cine';
