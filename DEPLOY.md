# Déploiement — Soft Transit Gabon

Backend + base de données sur **Render.com**, frontend sur **Cloudflare Pages**,
fichiers sur **Cloudflare R2**. Le dépôt GitHub (privé) sert de source pour les
deux plateformes : chaque `git push` sur `main` redéploie automatiquement.

Étapes 1 à 4 : actions à faire dans les tableaux de bord Cloudflare et Render
(quelques clics, décrites ci-dessous). Étapes 5 et 6 : migration des données —
Claude peut s'en charger si vous lui donnez les informations demandées.

## 1. Bucket Cloudflare R2

1. Dashboard Cloudflare → **R2 Object Storage** → **Create bucket**
   → nom : `softtransitgabon-documents`.
2. **Manage API tokens** → **Create API token** → permissions
   *Object Read & Write*, limité à ce bucket.
3. Noter les 3 valeurs affichées (elles ne sont montrées qu'une fois) :
   - **Account ID**
   - **Access Key ID**
   - **Secret Access Key**

## 2. Backend + base de données (Render)

1. Dashboard Render → **New** → **Blueprint** → connecter le dépôt GitHub
   `mbndiaye232/softtransitgabon`. Render lit `render.yaml` à la racine et crée :
   - la base `softtransitgabon-db` (PostgreSQL),
   - le service `softtransitgabon-backend` (Express).
2. Une fois créé, ouvrir **softtransitgabon-backend → Environment** et renseigner
   les variables marquées `sync: false` dans `render.yaml` :
   - `JWT_SECRET` : générer une valeur aléatoire, ex. `openssl rand -hex 32`
   - `DOCUMENT_ENCRYPTION_KEY` : même méthode, 32 octets hexadécimaux
   - `SMTP_USER`, `SMTP_PASS` : identifiants de la boîte `softtransit@sst.best`
   - `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`,
     `CLOUDFLARE_R2_SECRET_ACCESS_KEY` : valeurs de l'étape 1
   - `FRONTEND_URL` : à renseigner après l'étape 3
3. Noter l'URL du service, du type `https://softtransitgabon-backend.onrender.com`.

## 3. Frontend (Cloudflare Pages)

1. Dashboard Cloudflare → **Workers & Pages** → **Create** → **Pages**
   → **Connect to Git** → dépôt `mbndiaye232/softtransitgabon`.
2. Paramètres de build :
   - Framework preset : **Vite**
   - Build command : `npm run build`
   - Build output directory : `dist`
   - Root directory : `frontend`
3. **Environment variables** (Production) :
   - `VITE_API_URL` = `https://softtransitgabon-backend.onrender.com/api`
     (URL notée à l'étape 2)
4. **Save and Deploy**. Noter l'URL obtenue, du type
   `https://softtransitgabon.pages.dev`.

## 4. Boucler CORS

Retourner sur Render → `softtransitgabon-backend` → Environment → renseigner
`FRONTEND_URL` avec l'URL Cloudflare Pages de l'étape 3, puis redéployer le
service (Manual Deploy → Deploy latest commit) pour que le backend accepte
les requêtes du frontend en ligne.

## 5. Migrer les données (base locale → Render)

La base locale contient déjà le référentiel douanier importé et la structure
Soft Services Technologiques. Pour la transférer sur Render :

1. Dashboard Render → `softtransitgabon-db` → **Connect** → copier
   *External Database URL*.
2. Donner cette URL à Claude (dans le chat, ou dans un fichier `.env` non
   commité) : il exécute l'export de la base locale et sa restauration sur
   Render, puis vérifie les comptages de lignes des tables principales.

   Commandes équivalentes si vous préférez les lancer vous-même :
   ```bash
   pg_dump --no-owner --no-privileges -h localhost -p 5433 -U postgres softtransit > export.sql
   psql "<EXTERNAL_DATABASE_URL>" -f export.sql
   ```

## 6. Migrer les fichiers déjà uploadés (facultatif)

Peu de fichiers existent en local (`backend/uploads/`) : le logo, 3 cachets,
quelques documents de test. Deux options :
- **Simple** : une fois en ligne, re-téléverser le logo et les cachets depuis
  la page Société — ils partiront directement vers R2.
- **Automatique** : donner à Claude les 3 clés R2 de l'étape 1 (localement,
  via `.env`), il copie `backend/uploads/` vers le bucket.

## 7. Vérification

- `https://softtransitgabon-backend.onrender.com/api/health` → doit répondre
  `{"status":"ok", ...}`.
- Ouvrir l'URL Cloudflare Pages, se connecter, vérifier qu'un dossier existant
  s'affiche et que le logo de la société apparaît sur un PDF généré.
