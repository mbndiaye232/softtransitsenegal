const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');
const multer = require('multer');
const { encrypt, decrypt } = require('../utils/encryption');
const { uploadFile, downloadFile, deleteFile } = require('../utils/storage');
const fs = require('fs');
const path = require('path');
const archive = require('archiver');

// Multer memory storage for R2 uploads (no disk needed)
const uploadMemory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.use(authMiddleware);
router.use(tenantMiddleware);

// GET /api/documents/dossier/:dossierId - List all documents for a dossier
router.get('/dossier/:dossierId', checkPermission('DOSSIERS', 'can_view'), async (req, res) => {
    try {
        // Isolation tenant : on ne liste que les documents d'un dossier appartenant
        // à la société de l'utilisateur (sauf provider, qui voit tout).
        let sql = `
            SELECT
                d.IDDocuments as id,
                d.LibelleDocument as title,
                d.DescriptionDocument as description,
                d.CheminDocument as fileUrl,
                d.NumeroDocument as number,
                d.IDTypesDocuments as typeId,
                td.LibelleTypeDocument as typeLabel,
                d.DatePublication as date,
                d.Observations as observations
            FROM documents d
            JOIN dossiers dos ON d.IDDossiers = dos.IDDossiers
            LEFT JOIN typesdocuments td ON d.IDTypesDocuments = td.IDTypesDocuments
            WHERE d.IDDossiers = ?
        `;
        const params = [req.params.dossierId];
        if (!req.user.is_provider) {
            sql += ' AND dos.structur_id = ?';
            params.push(req.structur_id);
        }
        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/documents - Upload, encrypt and store in Cloudflare R2
router.post('/', checkPermission('DOSSIERS', 'can_create'), uploadMemory.single('document'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const { dossierId, title, description, number, typeId, date, observations } = req.body;

    try {
        // Isolation tenant : interdit d'attacher un document à un dossier
        // qui n'appartient pas à la société de l'utilisateur (sauf provider).
        if (!req.user.is_provider) {
            const [owned] = await pool.query(
                'SELECT 1 FROM dossiers WHERE IDDossiers = ? AND structur_id = ?',
                [dossierId, req.structur_id]
            );
            if (owned.length === 0) {
                return res.status(404).json({ error: 'Dossier not found' });
            }
        }

        // Encrypt in memory
        const encryptedBuffer = encrypt(req.file.buffer);

        const storedKey = `documents/${dossierId}/${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        await uploadFile(storedKey, encryptedBuffer);

        const [result] = await pool.query(`
            INSERT INTO documents (
                IDDossiers, LibelleDocument, DescriptionDocument, CheminDocument,
                NumeroDocument, IDTypesDocuments, DatePublication, Observations, IdAgent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            dossierId, title, description, storedKey,
            number, typeId || null, date || null, observations || null, req.user.id
        ]);

        res.status(201).json({ id: result.insertId });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Server error during upload/encryption' });
    }
});

// GET /api/documents/:id/view - Fetch from R2, decrypt and stream
router.get('/:id/view', checkPermission('DOSSIERS', 'can_view'), async (req, res) => {
    try {
        // Isolation tenant : le document doit appartenir à un dossier de la
        // société de l'utilisateur (sauf provider). Empêche l'énumération des
        // IDDocuments d'autres sociétés.
        let sql = `SELECT d.CheminDocument, d.LibelleDocument
                   FROM documents d
                   JOIN dossiers dos ON d.IDDossiers = dos.IDDossiers
                   WHERE d.IDDocuments = ?`;
        const params = [req.params.id];
        if (!req.user.is_provider) {
            sql += ' AND dos.structur_id = ?';
            params.push(req.structur_id);
        }
        const [rows] = await pool.query(sql, params);
        if (rows.length === 0) return res.status(404).json({ error: 'Document not found' });

        const doc = rows[0];
        const r2Key = doc.CheminDocument;

        // Determine content type from extension
        const ext = path.extname(r2Key).toLowerCase();
        let contentType = 'application/octet-stream';
        if (ext === '.pdf') contentType = 'application/pdf';
        else if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
        else if (ext === '.png') contentType = 'image/png';
        else if (ext === '.gif') contentType = 'image/gif';
        else if (['.doc', '.docx'].includes(ext)) contentType = 'application/msword';
        else if (ext === '.xlsx') contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

        // Download from R2 (try R2 key first, fallback to old disk path for legacy docs)
        let decryptedBuffer;
        if (r2Key.startsWith('documents/')) {
            // New R2 storage
            const encryptedBuffer = await downloadFile(r2Key);
            decryptedBuffer = decrypt(encryptedBuffer);
        } else {
            // Legacy: file stored on disk (old uploads before R2 migration)
            const legacyPaths = [
                path.join('uploads', 'others', r2Key),
                path.join('uploads', 'dossiers', r2Key),
                path.join('uploads', r2Key),
            ];
            const legacyPath = legacyPaths.find(p => fs.existsSync(p));
            if (!legacyPath) return res.status(404).json({ error: 'Fichier introuvable sur le disque' });
            const encryptedBuffer = fs.readFileSync(legacyPath);
            decryptedBuffer = decrypt(encryptedBuffer);
        }

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${doc.LibelleDocument || path.basename(r2Key)}"`);
        res.send(decryptedBuffer);
    } catch (error) {
        console.error('View error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération du document' });
    }
});

// GET /api/documents/dossier/:dossierId/extract - Bulk extraction (ZIP)
router.get('/dossier/:dossierId/extract', checkPermission('DOSSIERS', 'can_view'), async (req, res) => {
    try {
        // Isolation tenant : on ne peut extraire que les documents d'un dossier
        // appartenant à la société de l'utilisateur (sauf provider).
        let dsql = 'SELECT CodeDossierCourt FROM dossiers WHERE IDDossiers = ?';
        const dparams = [req.params.dossierId];
        if (!req.user.is_provider) {
            dsql += ' AND structur_id = ?';
            dparams.push(req.structur_id);
        }
        const [dossierRows] = await pool.query(dsql, dparams);
        if (dossierRows.length === 0) return res.status(404).json({ error: 'Dossier not found' });

        const shortCode = (dossierRows[0].CodeDossierCourt || 'dossier').replace(/[^a-zA-Z0-9]/g, '_');

        const [docs] = await pool.query('SELECT CheminDocument, LibelleDocument FROM documents WHERE IDDossiers = ?', [req.params.dossierId]);
        if (docs.length === 0) return res.status(400).json({ error: 'No documents to extract' });

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${shortCode}.zip"`);

        const zip = archive('zip', { zlib: { level: 9 } });
        zip.pipe(res);

        for (const doc of docs) {
            try {
                let encryptedBuffer;
                const key = doc.CheminDocument;

                if (key.startsWith('documents/')) {
                    // Stored in R2
                    encryptedBuffer = await downloadFile(key);
                } else {
                    // Legacy disk fallback
                    const legacyPaths = [
                        path.join('uploads', 'others', key),
                        path.join('uploads', 'dossiers', key),
                        path.join('uploads', key),
                    ];
                    const legacyPath = legacyPaths.find(p => fs.existsSync(p));
                    if (!legacyPath) { console.warn(`File not found on disk: ${key}`); continue; }
                    encryptedBuffer = fs.readFileSync(legacyPath);
                }

                const decryptedBuffer = decrypt(encryptedBuffer);
                const filename = (doc.LibelleDocument || 'document') + path.extname(key);
                zip.append(decryptedBuffer, { name: filename });
            } catch (e) {
                console.error(`Failed to process ${doc.CheminDocument}:`, e.message);
            }
        }

        zip.finalize();
    } catch (error) {
        console.error('Extract error:', error);
        res.status(500).json({ error: 'Extraction failed' });
    }
});

// DELETE /api/documents/:id
router.delete('/:id', checkPermission('DOSSIERS', 'can_delete'), async (req, res) => {
    try {
        // Isolation tenant : le document doit appartenir à un dossier de la
        // société de l'utilisateur (sauf provider) avant toute suppression.
        let sql = `SELECT d.CheminDocument
                   FROM documents d
                   JOIN dossiers dos ON d.IDDossiers = dos.IDDossiers
                   WHERE d.IDDocuments = ?`;
        const params = [req.params.id];
        if (!req.user.is_provider) {
            sql += ' AND dos.structur_id = ?';
            params.push(req.structur_id);
        }
        const [rows] = await pool.query(sql, params);
        if (rows.length === 0) return res.status(404).json({ error: 'Document not found' });

        const filePath = path.join('uploads', 'others', rows[0].CheminDocument);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        await pool.query('DELETE FROM documents WHERE IDDocuments = ?', [req.params.id]);
        res.json({ message: 'Document deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Delete failed' });
    }
});

module.exports = router;
