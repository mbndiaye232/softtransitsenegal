# Déploiement — Soft Transit Gabon

Backend + base de données sur **Render.com**, frontend sur **Cloudflare Pages**,
fichiers sur **Cloudflare R2**. Le dépôt GitHub (privé) sert de source pour les
deux plateformes : chaque `git push` sur `main` redéploie automatiquement.

Étapes 1 à 4 : actions à faire dans les tableaux de bord Cloudflare et Render
(quelques clics, décrites ci-dessous). Étapes 5 et 6 : migration des données —
Claude peut s'en charger si vous lui donnez les informations demandées.

## 1. Bucket Cloudflare R2

1. Dashboard Cloudflare → **R2 Object Storage** → **Create bucket** (nom actuel : `r2softtransitgabon`).
2. Page d'accueil **R2 Object Storage** → **API → Manage** → **Create Account API token**
   → permission **Object Read & Write**, limité à ce bucket.
3. Noter les valeurs affichées (elles ne sont montrées qu'une fois) :
   - **Account ID** (aussi dans l'adresse du dashboard, après `dash.cloudflare.com/`)
   - **Access Key ID**
   - **Secret Access Key**

## 2. Base de données et backend (Render)

1. **Base PostgreSQL** : New → PostgreSQL. Noter l'*Internal Database URL* (pour le backend)
   et l'*External Database URL* (pour la migration). Région : la même que le backend.
2. **Service web** : New → Web Service → dépôt `mbndiaye232/softtransitgabon`, branche `main`.
   - Language : **Node** (pas Docker)
   - **Root Directory : `backend`** · Build : `npm install` · Start : `npm start`
   - Health Check Path : `/api/health`
3. **Environment** du service (« Add from .env » possible) :
   - `NODE_ENV=production`, `JWT_EXPIRES_IN=7d`
   - `DATABASE_URL` : *Internal Database URL* de la base
   - `JWT_SECRET`, `DOCUMENT_ENCRYPTION_KEY` : 64 caractères hexadécimaux aléatoires
     (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
   - `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`,
     `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_BUCKET_NAME`
   - `FRONTEND_URL` : adresse du frontend (étape 4)
   Après avoir ajouté ou modifié des variables, cliquer sur **Save, rebuild, and deploy**.
4. Vérifier `https://<service>.onrender.com/api/health` → `{"status":"ok", ...}`.

## 3. Frontend (Cloudflare Workers)

1. Dashboard Cloudflare → **Workers & Pages** → **Create** → importer le dépôt
   `mbndiaye232/softtransitgabon`.
2. Paramètres de build :
   - Nom du projet : **`softtransitgabon`** (identique au `name` de `frontend/wrangler.jsonc`)
   - **Root directory : `frontend`**
   - Build command : `npm run build`
   - Deploy command : `npx wrangler deploy`
3. **Build variables** (section Build, pas Runtime) :
   - `VITE_API_URL` = `https://<service>.onrender.com/api` (lu à la compilation :
     relancer un build après toute modification)
4. L'adresse obtenue ressemble à `https://softtransitgabon.<compte>.workers.dev`.
   `frontend/wrangler.jsonc` renvoie toutes les routes vers `index.html`
   (`single-page-application`), ce qui permet de recharger une page comme `/dossiers`.

## 4. Boucler CORS

Sur Render, renseigner `FRONTEND_URL` avec l'adresse du frontend (étape 3) ; le service
redémarre et accepte alors les requêtes du site en ligne.

## 5. Migrer les données (base locale → Render)

Ne migrer que la structure, les référentiels (TEC, régimes, devises, rubriques, pays…)
et un compte administrateur, pas les dossiers ou clients de test :

1. Cloner la base locale vers une copie de travail, y supprimer les données métier
   (`TRUNCATE … RESTART IDENTITY CASCADE` sur clients, dossiers, factures, comptes mail,
   audit, etc.) et ne garder qu'un compte dans `agents`.
2. Render → base → **Networking → Inbound IP Rules** : autoriser temporairement
   `0.0.0.0/0` (à retirer ensuite) pour accepter la connexion depuis le poste.
3. Exporter la copie puis restaurer sur Render en une transaction :
   ```bash
   pg_dump --no-owner --no-privileges -h localhost -p 5433 -U postgres <copie> > export.sql
   PGPORT=5432 PGSSLMODE=require psql "<EXTERNAL_DATABASE_URL>" -1 -v ON_ERROR_STOP=1 -f export.sql
   ```
   Piège : si la variable d'environnement `PGPORT` du poste vaut 5433 (base locale), elle
   remplace le port absent de l'URL Render : forcer `PGPORT=5432` comme ci-dessus.
4. Comparer le nombre de lignes de chaque table entre la copie et Render.

## 6. Fichiers (logo, cachets, documents)

Les fichiers de `backend/uploads/` ne sont pas migrés (ils venaient de la RDC) :
re-téléverser le logo et les cachets depuis la page Société, ils partent directement vers R2.

## 7. Vérification

- `https://<service>.onrender.com/api/health` → `{"status":"ok", ...}`.
- Ouvrir l'adresse du frontend, se connecter, recharger une page profonde (par exemple
  `/dossiers`) : elle doit s'afficher et non renvoyer une 404.
- Après avoir téléversé le logo, générer un PDF et vérifier qu'il apparaît.

## Sauvegarde des documents R2

R2 n'a ni versions ni corbeille. `backend/scripts/copy-r2.js` recopie les objets nouveaux ou modifiés
du bucket des documents vers un second bucket, sans jamais rien supprimer dans la copie.

1. Créer un second bucket R2 (de préférence dans un autre compte Cloudflare) et renseigner `R2_COPY_BUCKET_NAME`
   (et `R2_COPY_ACCOUNT_ID`, `R2_COPY_ACCESS_KEY_ID`, `R2_COPY_SECRET_ACCESS_KEY` si c'est un autre compte).
2. Essai à blanc : `node scripts/copy-r2.js --dry-run` (depuis `backend/`), puis `node scripts/copy-r2.js`.
3. Planifier la commande chaque nuit (planificateur de tâches Windows, cron ou tâche planifiée Render).
   Le code de sortie est 1 si un objet n'a pas pu être copié.

La clé `DOCUMENT_ENCRYPTION_KEY` n'est dans aucune sauvegarde : la conserver à part, sans elle les documents chiffrés sont illisibles.

## Portail client (option)

Accès des clients, en lecture seule, à leurs dossiers, factures et documents (téléchargement). Désactivé par défaut.

1. Appliquer `backend/migrations-pg/007_portail_client.sql` sur la base (idempotent).
2. Backend : variable `PORTAIL_CLIENT_ENABLED=true` (sinon les routes `/api/portail*` n'existent pas).
3. Frontend : variable de build `VITE_PORTAIL_CLIENT=true` (sinon les pages `/portail*` et la case « Portail client » du menu n'existent pas).
4. Les clients demandent un accès sur `/portail` (sans mot de passe). Ils reçoivent un e-mail (Brevo ou SMTP requis) dont le lien
   **confirme leur adresse et leur fait choisir leur mot de passe** : un tiers ne peut pas imposer un mot de passe sur l'adresse d'autrui.
   Un administrateur valide ensuite chaque demande depuis la case **Portail client** du tableau de bord
   (rattachement à la fiche client, suspension, types de documents masqués, journal des téléchargements).
   Une demande dont l'adresse n'est pas confirmée ne peut pas être validée, et aucune fiche client n'est suggérée pour elle.

Sécurité : jeton du portail distinct de celui du personnel (audience `portail`), chaque requête filtrée par le client du compte ;
un dossier, document ou facture d'un autre client répond 404. Tests : `e2e-gabon/tests/13-portail-client.spec.js` et `14-portail-client-ui.spec.js`.
