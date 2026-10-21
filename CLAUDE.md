# Soft Transit Sénégal (version mono-structure) — Instructions pour Claude Code

## Stack technique
- **Frontend** : React + Vite, en local (http://localhost:5173)
- **Backend** : Express.js, en local (http://localhost:3001)
- **Base de données** : PostgreSQL 17 local (port 5433, base `softtransit_senegal`, copie de la structure de `softtransit_gabon` ; ne jamais écrire dans `softtransit` ni `softtransit_gabon`)
- **Stockage fichiers** : disque local, dossier `backend/uploads`
- **Auth** : JWT + bcrypt
- Application **non SaaS** : une seule structure (Soft Services Technologiques, `IDSociete = 1`).
  Crédits, forfaits, facturation SaaS et leads ont été retirés. `structur_id` est conservé en base.

## ⚠️ Accès base — adaptateur mysql2 → pg
Le code métier a été écrit pour mysql2. `backend/config/database.js` expose la même API sur PostgreSQL :
- `pool.query(sql, params)` → `[rows]` ou `[{ insertId, affectedRows }]`, placeholders `?`
- `IN (?)` avec tableau, `VALUES ?` avec tableau de tableaux, `SET ?` avec objet
- `pool.getConnection()` → `beginTransaction / commit / rollback / release`
- backticks retirés, `LIKE` traduit en `ILIKE`
- colonnes renvoyées dans leur casse d'origine (`IDDossiers`) grâce à `config/column-names.json`
- codes d'erreur traduits : `ER_DUP_ENTRY`, `ER_ROW_IS_REFERENCED_2`, `ER_BAD_FIELD_ERROR`

Règles pour écrire du SQL :
- Tables et colonnes stockées **en minuscules** dans PostgreSQL ; écrire les noms sans guillemets.
- Syntaxe PostgreSQL uniquement : `CURRENT_DATE` (pas `CURDATE()`), `(a::date - b::date)` (pas `DATEDIFF`),
  `to_char` (pas `DATE_FORMAT`), `string_agg` (pas `GROUP_CONCAT`), `ON CONFLICT` (pas `INSERT IGNORE` / `ON DUPLICATE KEY`),
  `INTERVAL '12 months'`, `DELETE ... USING` (pas `DELETE t FROM ... JOIN`).
- Une nouvelle colonne en casse mixte doit être ajoutée dans `config/column-names.json` pour que l'API la renvoie avec sa casse.
- Dans une transaction PostgreSQL, une erreur annule tout le reste : ne pas « avaler » une erreur SQL puis continuer.

## Stockage fichiers
- Uploads via `uploadFile / downloadFile / deleteFile` de `backend/utils/storage.js` (clé relative, ex. `societe/logos/x.png`)
- `multer.memoryStorage()` puis écriture par `storage.js`
- Fichiers servis par `express.static` sur `/uploads`

## Scripts de données (`backend/scripts`)
- `prepare-db-senegal.js` : crée `PG_DATABASE` (copie de structure de `softtransit_gabon`, données métier vidées, devise de référence « F CFA »)
- `import-tec-senegal.py` : TEC du Sénégal (produits NTS 10 chiffres, taxes + niveaux, taux, tarifs, compléments de taxes), régimes GAINDE et rubriques,
  depuis `backup_clean.sql` (sauvegarde Soft Transit SaaS du 2026-05-11, racine du projet). Vide puis remplit les tables.
- `fix-accents-senegal.py` : à lancer après l'import — restaure les accents abîmés de la source (« ?? », « ? », « { »…) dans les libellés des produits et des régimes (dictionnaire français + libellés du TEC du Gabon) ; `--appliquer` pour modifier la base (simulation par défaut)
- `migrate-mysql-to-pg.js` : migration initiale depuis `backup_clean.sql` (structure SST uniquement)
- `migrations-pg/*.sql` : évolutions du schéma PostgreSQL (007 : portail client ; 008 : classement des régimes sénégalais — type suspensif/définitif/exonération, qui commande l'accès aux sommiers)

## Calcul des droits et taxes
- `taxes.niveau` = ordre de calcul ; `taxes_complements` = taxes dont les montants s'ajoutent à la base d'une taxe de niveau > 1
  (ex. TVA niveau 3 : base = CAF + DD + RS + taxe additionnelle + taxe intérieure cosmétiques + TI). Logique dans `routes/notes.js` (identique à Soft Transit SaaS).
- Facturation (`FacturationManager.jsx`) : commissions automatiques sur les lignes 4004 (commission sur débours) et 4005 (commission sur droits de douane),
  taux et choix des rubriques de débours 11xx (« Sur tous les débours » ou sélection) dans la fiche client (`rubriquesdescommissions`).
  Pas de commission sur une facture douane seule (FD) ; commission douane d'une facture prestations (FP) calculée sur les FD déjà établies du dossier.

## Portail client (lecture seule)
- Option activée en développement : `PORTAIL_CLIENT_ENABLED=true` (`backend/.env`) et `VITE_PORTAIL_CLIENT=true` (`frontend/.env`) ; migration `migrations-pg/007_portail_client.sql` appliquée.
- Les clients s'inscrivent sur `/portail` (confirmation de l'adresse e-mail, puis choix du mot de passe), l'équipe valide et rattache à une fiche client dans `/portail-admin`.
  Le client voit ses dossiers (avancement, arrivée du navire), documents et factures validées. Tests : `e2e-gabon/tests/13-portail-client.spec.js` et `14-…` (dossier `e2e-gabon` hérité du Gabon, base `softtransit_senegal_e2e`).

## Workflow Git
Dépôt privé : `mbndiaye232/softtransitsenegal`. Ne pas committer ni pousser sans demande explicite.

## Soft delete
Les dossiers supprimés ont `Facturable = -1`. Toutes les requêtes SELECT doivent filtrer :
```sql
WHERE (Facturable IS NULL OR Facturable != -1)
```

## Variables d'environnement
- Backend : `backend/.env` (PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE, JWT_SECRET, DOCUMENT_ENCRYPTION_KEY, SMTP_*)
- Frontend : `frontend/.env` (VITE_API_URL=http://localhost:3001/api)

---

## Règles de comportement (Karpathy-inspired)

### 1. Réfléchir avant de coder
- **Ne pas supposer.** Si une phrase est ambiguë, demander quelle solution exactement avant d'agir.
- Si plusieurs interprétations existent, les présenter — ne pas en choisir une silencieusement.
- Si une approche plus simple existe, la dire. Pousser en retour quand justifié.
- Si quelque chose est flou, s'arrêter, nommer ce qui prête à confusion, demander.

### 2. Simplicité d'abord
- Code minimum qui résout le problème. Rien de spéculatif.
- Pas de fonctionnalités au-delà de ce qui a été demandé.
- Pas d'abstractions pour du code à usage unique.
- Pas de flexibilité ou configurabilité non demandée.
- Pas de gestion d'erreurs pour des scénarios impossibles.
- Si on écrit 200 lignes et que 50 suffisent, réécrire.

### 3. Vérifier avant de toucher
- Lire les fichiers concernés **avant** de les modifier.
- Vérifier que toute fonction contenant `await` est bien `async`.
- Vérifier qu'un import supprimé n'est pas encore utilisé ailleurs dans le fichier.
- Tester le changement minimal avant d'étendre à tous les fichiers similaires.

### 4. Transparence sur les erreurs
- Si une modification a causé un problème, le dire directement et corriger immédiatement.
- Ne pas masquer une erreur dans un try/catch silencieux lors du débogage.
