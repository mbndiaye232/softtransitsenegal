-- Classement des régimes de déclaration SYDONIA (Gabon) : type (Définitif / Suspensif / Exonération)
-- et catégorie. Remplace l'ancien filtre sur la lettre « S » (règle Gaïndé du Sénégal) par une donnée.
-- Idempotent : peut être rejoué ; les régimes ajoutés plus tard gardent leur classement tant qu'on ne les touche pas.

-- 1. Par défaut : définitif
UPDATE regimedeclaration SET type_regime_id = (SELECT id FROM type_regime WHERE code = 'DEFINITIF');

-- 2. Suspensifs : admission temporaire (IM5), entrepôt (IM7), transit (IM8), exportations temporaires et entrepôt d'exportation
UPDATE regimedeclaration
   SET type_regime_id = (SELECT id FROM type_regime WHERE code = 'SUSPENSIF')
 WHERE regime IN ('IM5', 'IM7', 'IM8')
    OR coderegimedeclaration IN ('EX2200', 'EX3050', 'EX8');

-- 3. Exonération : mise à la consommation à taxes réduites ou nulles (régime économique ou privilégié, zone CEMAC)
UPDATE regimedeclaration
   SET type_regime_id = (SELECT id FROM type_regime WHERE code = 'EXONERATION')
 WHERE regime = 'IM4'
   AND (libelleregimedeclaration ILIKE '%conomique ou privil%' OR libelleregimedeclaration ILIKE '%zone CEMAC%');

-- 4. Catégories
UPDATE regimedeclaration SET categorie_regime_id = NULL;
UPDATE regimedeclaration SET categorie_regime_id = (SELECT id FROM categorie_regime WHERE code = 'MISE_CONSOMMATION') WHERE regime = 'IM4';
UPDATE regimedeclaration SET categorie_regime_id = (SELECT id FROM categorie_regime WHERE code = 'ENTREPOT') WHERE regime = 'IM7' OR coderegimedeclaration = 'EX8';
UPDATE regimedeclaration SET categorie_regime_id = (SELECT id FROM categorie_regime WHERE code = 'ADMISSION_TEMPORAIRE') WHERE regime = 'IM5' AND coderegimedeclaration <> 'IM5100';
UPDATE regimedeclaration SET categorie_regime_id = (SELECT id FROM categorie_regime WHERE code = 'PERFECTIONNEMENT_ACTIF') WHERE coderegimedeclaration = 'IM5100';
UPDATE regimedeclaration SET categorie_regime_id = (SELECT id FROM categorie_regime WHERE code = 'TRANSIT') WHERE regime = 'IM8';
UPDATE regimedeclaration SET categorie_regime_id = (SELECT id FROM categorie_regime WHERE code = 'PERFECTIONNEMENT_PASSIF') WHERE coderegimedeclaration = 'EX2200';
