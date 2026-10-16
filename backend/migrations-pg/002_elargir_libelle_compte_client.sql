-- La route de création de client écrit « Compte opérations de <NomRS> » dans libellecompteclients.
-- La colonne (varchar(50) héritée de MySQL) débordait dès que le nom de société dépassait 29 caractères :
-- MySQL tronquait sans rien dire, PostgreSQL refuse l'écriture.
ALTER TABLE comptesclients ALTER COLUMN libellecompteclients TYPE varchar(150);
