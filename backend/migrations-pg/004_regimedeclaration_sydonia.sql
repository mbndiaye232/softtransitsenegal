-- Régimes de déclaration : code SYDONIA (coderegimedeclaration), famille de régime et code additionnel.
-- Le code SYDONIA n'est plus unique à lui seul (ex. IM4000 existe avec plusieurs codes additionnels).
ALTER TABLE regimedeclaration
    ADD COLUMN IF NOT EXISTS regime           varchar(10),
    ADD COLUMN IF NOT EXISTS code_additionnel varchar(255);

DROP INDEX IF EXISTS regimedeclaration_coderegimedeclaration;

CREATE UNIQUE INDEX IF NOT EXISTS regimedeclaration_code_libelle_add
    ON regimedeclaration (coderegimedeclaration, libelleregimedeclaration, COALESCE(code_additionnel, ''));

CREATE INDEX IF NOT EXISTS regimedeclaration_idx_regime ON regimedeclaration (regime);
