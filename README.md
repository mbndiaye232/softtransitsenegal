# Soft Transit Gabon

Application de gestion de transit douanier (dossiers, cotations, facturation, régime
suspensif) pour **Soft Services Technologiques** — version mono-structure, non SaaS.

Dérivée de Soft Transit SaaS, migrée de MySQL vers PostgreSQL.

## Stack

- **Frontend** : React + Vite → Cloudflare Pages
- **Backend** : Express.js → Render.com
- **Base de données** : PostgreSQL → Render.com
- **Stockage fichiers** (logos, cachets, documents) : Cloudflare R2 en production,
  disque local en développement (bascule automatique, voir `backend/utils/storage.js`)
- **Auth** : JWT + bcrypt

## Démarrage en local

### Prérequis
- Node.js 20+
- PostgreSQL 17 (local ou distant)

### Backend
```bash
cd backend
npm install
cp .env.example .env   # renseigner PG_*, JWT_SECRET, DOCUMENT_ENCRYPTION_KEY
npm run dev
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:3001/api
npm run dev
```

L'application est alors disponible sur http://localhost:5173.

### Base de données

Le schéma est appliqué automatiquement par les scripts de migration (voir
`backend/migrations-pg/`) lors du déploiement initial. Pour une nouvelle
installation locale, restaurer un export existant ou appliquer les fichiers
`backend/migrations-pg/*.sql` dans l'ordre sur une base vide.

## Déploiement en ligne (Cloudflare + Render)

Voir [DEPLOY.md](DEPLOY.md) pour la procédure complète : bucket R2, projet
Cloudflare Pages, service Render (blueprint `render.yaml`), variables
d'environnement et migration des données.

## Règle critique — casse des colonnes PostgreSQL

Les noms de tables et de colonnes sont stockés **en minuscules** dans
PostgreSQL. `backend/config/database.js` restaure la casse d'origine
(`IDDossiers`, `NomRS`, etc.) dans les réponses de l'API, pour rester
compatible avec le code écrit à l'origine pour MySQL. Voir les commentaires
en tête de ce fichier avant de modifier une requête SQL.
