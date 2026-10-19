#!/usr/bin/env node
/**
 * Déchiffre les documents d'une sauvegarde (dossier uploads/documents du zip) ou un fichier isolé.
 *
 * Les documents joints aux dossiers sont chiffrés en AES-256-GCM avec la clé DOCUMENT_ENCRYPTION_KEY
 * (backend/.env en local, variable d'environnement chez l'hébergeur). Sans cette clé ils sont illisibles.
 *
 * Usage (depuis backend/) :
 *   node scripts/decrypt-documents.js <fichier-ou-dossier> [dossier-de-sortie]
 *   node scripts/decrypt-documents.js C:\Sauvegardes\extrait\uploads\documents
 *
 * La clé est lue dans backend/.env, ou dans la variable d'environnement DOCUMENT_ENCRYPTION_KEY,
 * ou donnée avec --cle=<64 caractères hexadécimaux>.
 * Sortie par défaut : <entrée>-dechiffre. Les fichiers d'origine ne sont jamais modifiés et les noms sont conservés.
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const cleArg = args.find(a => a.startsWith('--cle='));
if (cleArg) process.env.DOCUMENT_ENCRYPTION_KEY = cleArg.slice(6);
const positionnels = args.filter(a => !a.startsWith('--'));

if (!positionnels[0]) {
    console.error('Usage : node scripts/decrypt-documents.js <fichier-ou-dossier> [dossier-de-sortie] [--cle=<hex>]');
    process.exit(2);
}

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
if (!/^[0-9a-fA-F]{64}$/.test(process.env.DOCUMENT_ENCRYPTION_KEY || '')) {
    console.error('Clé introuvable ou invalide : DOCUMENT_ENCRYPTION_KEY doit faire 64 caractères hexadécimaux '
        + '(dans backend/.env, dans l\'environnement, ou --cle=...).');
    process.exit(2);
}
const { decrypt } = require('../utils/encryption');

const entree = path.resolve(positionnels[0]);
const estDossier = fs.statSync(entree).isDirectory();
const sortie = path.resolve(positionnels[1] || `${entree}-dechiffre`);

function* fichiers(chemin) {
    for (const e of fs.readdirSync(chemin, { withFileTypes: true })) {
        const p = path.join(chemin, e.name);
        if (e.isDirectory()) yield* fichiers(p); else yield p;
    }
}

let ok = 0;
const echecs = [];
for (const f of estDossier ? fichiers(entree) : [entree]) {
    const relatif = estDossier ? path.relative(entree, f) : path.basename(f);
    try {
        const clair = decrypt(fs.readFileSync(f));
        const cible = estDossier ? path.join(sortie, relatif) : (fs.existsSync(sortie) && fs.statSync(sortie).isDirectory() ? path.join(sortie, relatif) : sortie);
        fs.mkdirSync(path.dirname(cible), { recursive: true });
        fs.writeFileSync(cible, clair);
        ok++;
    } catch (e) {
        echecs.push(relatif);
        console.log(`non déchiffré : ${relatif} (fichier non chiffré, ou mauvaise clé)`);
    }
}
console.log(`${ok} fichier(s) déchiffré(s)${echecs.length ? `, ${echecs.length} ignoré(s)` : ''} -> ${sortie}`);
process.exit(echecs.length && !ok ? 1 : 0);
