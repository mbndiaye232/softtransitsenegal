-- Classement des régimes de déclaration du Sénégal (codes GAINDE C / E / R / S) : type et catégorie.
-- Le type SUSPENSIF commande l'éligibilité aux sommiers (voir routes/sommiers.js). Règle reprise de Soft Transit SaaS
-- (satm) : code en S, hors transit S1xx / S2xx ; les exportations temporaires E8xx sont ajoutées.
-- Idempotent : peut être rejoué.

-- 1. Par défaut : définitif
UPDATE regimedeclaration SET type_regime_id = (SELECT id FROM type_regime WHERE code = 'DEFINITIF');

-- 2. Suspensifs : entrepôts (S3xx, S4xx), admission temporaire (S5xx), importation temporaire (S6xx),
--    zones et entreprises franches (S9xx), exportations temporaires (E8xx). Le transit (S1xx, S2xx) reste « définitif ».
UPDATE regimedeclaration
   SET type_regime_id = (SELECT id FROM type_regime WHERE code = 'SUSPENSIF')
 WHERE coderegimedeclaration ~ '^S[3-9]'
    OR coderegimedeclaration ~ '^E8';

-- 3. Exonérations : mises à la consommation en franchise (franchises, dons et aides, privilèges diplomatiques,
--    code des investissements, régimes stabilisés, déménagements et effets personnels)
UPDATE regimedeclaration
   SET type_regime_id = (SELECT id FROM type_regime WHERE code = 'EXONERATION')
 WHERE coderegimedeclaration ~ '^C'
   AND (libelleregimedeclaration ILIKE '%FRANCHISE%'
     OR libelleregimedeclaration ILIKE '%EXEMPTION%'
     OR libelleregimedeclaration ILIKE '%DONS%'
     OR libelleregimedeclaration ILIKE '%AIDES%'
     OR libelleregimedeclaration ILIKE '%DIPLOMATIQUE%'
     OR libelleregimedeclaration ILIKE '%INVESTISSEMENT%'
     OR libelleregimedeclaration ILIKE '%STABILIS%'
     OR libelleregimedeclaration ILIKE '%ADMISSIONS EXCEPTIONNELLES%'
     OR libelleregimedeclaration ILIKE '%DEMENAGEMENT%'
     OR libelleregimedeclaration ILIKE '%EFFETS PERSONNELS%');

-- 4. Catégories
UPDATE regimedeclaration SET categorie_regime_id = NULL;
UPDATE regimedeclaration SET categorie_regime_id = (SELECT id FROM categorie_regime WHERE code = 'MISE_CONSOMMATION') WHERE coderegimedeclaration ~ '^C';
UPDATE regimedeclaration SET categorie_regime_id = (SELECT id FROM categorie_regime WHERE code = 'TRANSIT') WHERE coderegimedeclaration ~ '^S[12]';
UPDATE regimedeclaration SET categorie_regime_id = (SELECT id FROM categorie_regime WHERE code = 'ENTREPOT') WHERE coderegimedeclaration ~ '^S[34]';
UPDATE regimedeclaration SET categorie_regime_id = (SELECT id FROM categorie_regime WHERE code = 'ADMISSION_TEMPORAIRE') WHERE coderegimedeclaration ~ '^S[56]';
UPDATE regimedeclaration SET categorie_regime_id = (SELECT id FROM categorie_regime WHERE code = 'PERFECTIONNEMENT_ACTIF') WHERE coderegimedeclaration IN ('S530', 'S531');
UPDATE regimedeclaration SET categorie_regime_id = (SELECT id FROM categorie_regime WHERE code = 'ZONE_FRANCHE') WHERE coderegimedeclaration ~ '^S9';
UPDATE regimedeclaration SET categorie_regime_id = (SELECT id FROM categorie_regime WHERE code = 'PERFECTIONNEMENT_PASSIF') WHERE coderegimedeclaration = 'E800';
UPDATE regimedeclaration SET categorie_regime_id = (SELECT id FROM categorie_regime WHERE code = 'EXONERATION')
 WHERE coderegimedeclaration ~ '^C' AND type_regime_id = (SELECT id FROM type_regime WHERE code = 'EXONERATION');
