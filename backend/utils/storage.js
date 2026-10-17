const fs = require('fs/promises');
const path = require('path');

/**
 * Stockage des fichiers (logos, cachets, documents des dossiers).
 *
 * - En local (pas de clés CLOUDFLARE_R2_* dans .env) : disque local, dossier
 *   backend/uploads, servi par express.static('/uploads') dans server.js.
 * - En production (clés CLOUDFLARE_R2_* renseignées) : bucket Cloudflare R2.
 *
 * Même API dans les deux cas : uploadFile(key, buffer, mimetype?), downloadFile(key), deleteFile(key).
 */
const r2Ready = !!(
    process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
);

let uploadFile, downloadFile, deleteFile;

if (r2Ready) {
    const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

    const r2Client = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
        },
    });
    const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'softtransitgabon-documents';

    uploadFile = async (key, buffer, contentType = 'application/octet-stream') => {
        await r2Client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType }));
    };

    downloadFile = async (key) => {
        const res = await r2Client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
        const chunks = [];
        for await (const chunk of res.Body) chunks.push(chunk);
        return Buffer.concat(chunks);
    };

    deleteFile = async (key) => {
        await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    };

    console.log(`✓ Stockage fichiers : Cloudflare R2 (bucket ${BUCKET})`);
} else {
    const ROOT = path.join(__dirname, '..', 'uploads');

    const resolveKey = (key) => {
        const full = path.resolve(ROOT, key.replace(/^uploads\//, ''));
        if (!full.startsWith(ROOT + path.sep)) throw new Error(`Clé de fichier invalide : ${key}`);
        return full;
    };

    uploadFile = async (key, buffer) => {
        const full = resolveKey(key);
        await fs.mkdir(path.dirname(full), { recursive: true });
        await fs.writeFile(full, buffer);
    };

    downloadFile = async (key) => fs.readFile(resolveKey(key));

    deleteFile = async (key) => { await fs.rm(resolveKey(key), { force: true }); };

    console.log('✓ Stockage fichiers : disque local (backend/uploads)');
}

module.exports = { uploadFile, downloadFile, deleteFile };
