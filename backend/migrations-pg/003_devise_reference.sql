-- Ajoute une devise de référence explicite, au lieu de la convention implicite
-- "la devise dont le taux vaut 1.000000". Permet de changer la devise de
-- référence depuis l'écran Devises, sans modifier le code (voir
-- services/deviseService.js et PUT /api/devises/:id/set-reference).

ALTER TABLE devises ADD COLUMN IF NOT EXISTS est_reference boolean NOT NULL DEFAULT false;

-- Une seule devise de référence à la fois
CREATE UNIQUE INDEX IF NOT EXISTS devises_une_seule_reference
    ON devises (est_reference) WHERE est_reference;

-- Le Franc Congolais (taux 1.000000) est la référence actuelle
UPDATE devises SET est_reference = true WHERE tauxchangedevisecfa = 1.000000 AND NOT EXISTS (
    SELECT 1 FROM devises WHERE est_reference
);
