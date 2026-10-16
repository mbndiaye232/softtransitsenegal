const crypto = require('crypto');
require('dotenv').config();

// Clé 32 octets (aes-256) — identique pour GCM et l'ancien CBC.
const KEY = Buffer.from(process.env.DOCUMENT_ENCRYPTION_KEY, 'hex');

// Nouveau format authentifié : [MAGIC(4)][IV(12)][TAG(16)][ciphertext] (AES-256-GCM).
// Le marqueur permet de distinguer des anciens blobs CBC ([IV(16)][ciphertext]) :
// un IV CBC aléatoire ne vaut 'GCM1' qu'avec une probabilité de 2^-32 (négligeable).
const MAGIC = Buffer.from('GCM1', 'ascii');
const GCM_IV_LEN = 12;
const GCM_TAG_LEN = 16;
const CBC_IV_LEN = 16;

/**
 * Chiffre un buffer en AES-256-GCM (authentifié).
 * @param {Buffer} buffer
 * @returns {Buffer} [MAGIC][IV][TAG][ciphertext]
 */
function encrypt(buffer) {
    const iv = crypto.randomBytes(GCM_IV_LEN);
    const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([MAGIC, iv, tag, encrypted]);
}

/**
 * Déchiffre un buffer. Détecte automatiquement le format :
 *   - GCM (nouveau) si le blob commence par le marqueur MAGIC ;
 *   - CBC (ancien, antérieur à la migration) sinon.
 * @param {Buffer} buffer
 * @returns {Buffer}
 */
function decrypt(buffer) {
    if (buffer.length > MAGIC.length && buffer.subarray(0, MAGIC.length).equals(MAGIC)) {
        // Nouveau format AES-256-GCM
        const ivStart = MAGIC.length;
        const tagStart = ivStart + GCM_IV_LEN;
        const dataStart = tagStart + GCM_TAG_LEN;
        const iv = buffer.subarray(ivStart, tagStart);
        const tag = buffer.subarray(tagStart, dataStart);
        const data = buffer.subarray(dataStart);
        const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(data), decipher.final()]);
    }

    // Ancien format AES-256-CBC : [IV(16)][ciphertext]
    const iv = buffer.subarray(0, CBC_IV_LEN);
    const data = buffer.subarray(CBC_IV_LEN);
    const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, iv);
    return Buffer.concat([decipher.update(data), decipher.final()]);
}

module.exports = {
    encrypt,
    decrypt,
};
