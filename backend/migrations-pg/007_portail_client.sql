-- Portail client (option) : comptes clients, types de documents masqués, journal des téléchargements.
-- Sans effet tant que PORTAIL_CLIENT_ENABLED n'est pas à true côté serveur.

CREATE TABLE IF NOT EXISTS client_users (
    id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    idclients        INTEGER,                         -- renseigné par l'équipe à la validation
    email            VARCHAR(255) NOT NULL,
    password_hash    VARCHAR(255),                    -- choisi par le titulaire de l'adresse en confirmant son e-mail
    nom              VARCHAR(150) NOT NULL,
    telephone        VARCHAR(40),
    societe_declaree VARCHAR(200) NOT NULL,           -- société indiquée à l'inscription (à vérifier)
    statut           VARCHAR(12) NOT NULL DEFAULT 'EN_ATTENTE'
                     CHECK (statut IN ('EN_ATTENTE', 'ACTIF', 'REFUSE', 'SUSPENDU')),
    email_verified_at TIMESTAMP,                      -- adresse confirmée par le lien reçu par e-mail
    verify_token_hash VARCHAR(64),
    verify_expires    TIMESTAMP,
    reset_token_hash VARCHAR(64),
    reset_expires    TIMESTAMP,
    created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    validated_at     TIMESTAMP,
    validated_by     INTEGER,
    last_login       TIMESTAMP
);
-- Bases où une version antérieure de cette migration est déjà appliquée
ALTER TABLE client_users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE client_users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;
ALTER TABLE client_users ADD COLUMN IF NOT EXISTS verify_token_hash VARCHAR(64);
ALTER TABLE client_users ADD COLUMN IF NOT EXISTS verify_expires TIMESTAMP;
CREATE UNIQUE INDEX IF NOT EXISTS client_users_email_uq ON client_users (lower(email));
CREATE INDEX IF NOT EXISTS client_users_client_idx ON client_users (idclients);

-- Par défaut, le client voit tous les types de documents ; seuls les types listés ici lui sont cachés.
CREATE TABLE IF NOT EXISTS portail_types_masques (
    idtypesdocuments INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS portail_journal (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_user_id INTEGER NOT NULL,
    action         VARCHAR(30) NOT NULL,              -- CONNEXION, TELECHARGE_DOCUMENT, TELECHARGE_ZIP, TELECHARGE_FACTURE
    reference      VARCHAR(60),
    ip             VARCHAR(64),
    created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS portail_journal_user_idx ON portail_journal (client_user_id, created_at DESC);
