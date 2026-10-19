#!/usr/bin/env node
/**
 * Copie de sécurité du bucket Cloudflare R2 (documents, logos, cachets) vers un second bucket.
 *
 * R2 n'a ni versions ni corbeille : un document supprimé par erreur est perdu. Ce script recopie
 * dans un second bucket tout ce qui est nouveau ou modifié. Il NE SUPPRIME JAMAIS rien dans la copie :
 * un fichier effacé de la source y reste disponible.
 *
 * Usage (depuis backend/) :
 *   node scripts/copy-r2.js            copie les objets nouveaux ou modifiés
 *   node scripts/copy-r2.js --dry-run  affiche ce qui serait copié, sans rien écrire
 *
 * Variables (backend/.env ou variables d'environnement) :
 *   source        CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY,
 *                 CLOUDFLARE_R2_BUCKET_NAME (les mêmes que l'application)
 *   destination   R2_COPY_BUCKET_NAME (obligatoire) ; R2_COPY_ACCOUNT_ID, R2_COPY_ACCESS_KEY_ID,
 *                 R2_COPY_SECRET_ACCESS_KEY seulement si la copie est dans un AUTRE compte Cloudflare
 *                 (sinon ceux de la source sont réutilisés et la copie se fait côté Cloudflare, sans téléchargement)
 *
 * À planifier (planificateur de tâches Windows, cron, tâche planifiée Render…), par exemple chaque nuit.
 * Code de sortie 1 si au moins un objet n'a pas pu être copié.
 */
const {
    S3Client, ListObjectsV2Command, CopyObjectCommand, GetObjectCommand, PutObjectCommand,
} = require('@aws-sdk/client-s3');

const nouveauClient = (accountId, accessKeyId, secretAccessKey) => new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
});

async function lister(client, bucket) {
    const objets = new Map();
    let token;
    do {
        const res = await client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
        for (const o of res.Contents || []) objets.set(o.Key, { size: o.Size, etag: o.ETag });
        token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return objets;
}

/**
 * Copie source -> destination. `memeCompte` : copie côté Cloudflare (CopyObject) ; sinon téléchargement puis envoi.
 * Renvoie { copies, ignores, erreurs: [{ key, message }] }.
 */
async function copier({ source, destination, bucketSource, bucketDestination, memeCompte, dryRun = false, log = console.log }) {
    const [src, dst] = [await lister(source, bucketSource), await lister(destination, bucketDestination)];
    const resultat = { copies: 0, ignores: 0, erreurs: [] };

    for (const [key, o] of src) {
        const deja = dst.get(key);
        if (deja && deja.size === o.size && deja.etag === o.etag) { resultat.ignores++; continue; }
        if (dryRun) { log(`à copier : ${key}`); resultat.copies++; continue; }
        try {
            if (memeCompte) {
                await destination.send(new CopyObjectCommand({
                    Bucket: bucketDestination, Key: key, CopySource: `${bucketSource}/${encodeURIComponent(key).replace(/%2F/g, '/')}`,
                }));
            } else {
                const res = await source.send(new GetObjectCommand({ Bucket: bucketSource, Key: key }));
                const morceaux = [];
                for await (const m of res.Body) morceaux.push(m);
                await destination.send(new PutObjectCommand({
                    Bucket: bucketDestination, Key: key, Body: Buffer.concat(morceaux), ContentType: res.ContentType,
                }));
            }
            resultat.copies++;
        } catch (e) {
            resultat.erreurs.push({ key, message: e.message });
            log(`ÉCHEC ${key} : ${e.message}`);
        }
    }
    return resultat;
}

async function main() {
    require('dotenv').config();
    const e = process.env;
    const manquantes = ['CLOUDFLARE_R2_ACCOUNT_ID', 'CLOUDFLARE_R2_ACCESS_KEY_ID', 'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
        'CLOUDFLARE_R2_BUCKET_NAME', 'R2_COPY_BUCKET_NAME'].filter(v => !e[v]);
    if (manquantes.length) {
        console.error(`Variables manquantes : ${manquantes.join(', ')}`);
        process.exit(2);
    }
    const dstAccount = e.R2_COPY_ACCOUNT_ID || e.CLOUDFLARE_R2_ACCOUNT_ID;
    const dstKey = e.R2_COPY_ACCESS_KEY_ID || e.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const dstSecret = e.R2_COPY_SECRET_ACCESS_KEY || e.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    if (e.R2_COPY_BUCKET_NAME === e.CLOUDFLARE_R2_BUCKET_NAME && dstAccount === e.CLOUDFLARE_R2_ACCOUNT_ID) {
        console.error('La copie doit aller dans un autre bucket que la source.');
        process.exit(2);
    }
    const dryRun = process.argv.includes('--dry-run');
    const r = await copier({
        source: nouveauClient(e.CLOUDFLARE_R2_ACCOUNT_ID, e.CLOUDFLARE_R2_ACCESS_KEY_ID, e.CLOUDFLARE_R2_SECRET_ACCESS_KEY),
        destination: nouveauClient(dstAccount, dstKey, dstSecret),
        bucketSource: e.CLOUDFLARE_R2_BUCKET_NAME,
        bucketDestination: e.R2_COPY_BUCKET_NAME,
        memeCompte: dstAccount === e.CLOUDFLARE_R2_ACCOUNT_ID && dstKey === e.CLOUDFLARE_R2_ACCESS_KEY_ID,
        dryRun,
    });
    console.log(`${dryRun ? 'À copier' : 'Copiés'} : ${r.copies} · déjà à jour : ${r.ignores} · échecs : ${r.erreurs.length}`);
    process.exit(r.erreurs.length ? 1 : 0);
}

if (require.main === module) main().catch((err) => { console.error(err.message); process.exit(1); });

module.exports = { copier };
