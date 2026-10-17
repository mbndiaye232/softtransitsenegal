-- Téléphones de la société : 15 caractères refusaient les formats internationaux
-- (ex. « +241(0) 60 01 01 00 » = 19 caractères) et faisaient échouer l'enregistrement des paramètres.
ALTER TABLE structur
    ALTER COLUMN telsociete TYPE varchar(50),
    ALTER COLUMN celsociete TYPE varchar(50);
