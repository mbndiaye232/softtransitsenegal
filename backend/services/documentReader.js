const fs = require('fs');
const path = require('path');
const { decrypt } = require('../utils/encryption');
const { downloadFile } = require('../utils/storage');

/**
 * Lit un document du dossier et le renvoie en clair.
 * Nouveaux documents : clé « documents/... » (disque local ou R2, chiffrés). Anciens : fichiers du disque.
 * Renvoie null si le fichier est introuvable.
 */
async function readDocument(cheminDocument) {
    if (cheminDocument.startsWith('documents/')) {
        return decrypt(await downloadFile(cheminDocument));
    }
    const legacy = [
        path.join('uploads', 'others', cheminDocument),
        path.join('uploads', 'dossiers', cheminDocument),
        path.join('uploads', cheminDocument),
    ].find(p => fs.existsSync(p));
    return legacy ? decrypt(fs.readFileSync(legacy)) : null;
}

module.exports = { readDocument };
