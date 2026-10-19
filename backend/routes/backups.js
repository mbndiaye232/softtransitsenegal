const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const backupService = require('../services/backupService');
const { authMiddleware, requireSuperAdmin } = require('../middleware/auth');

// Les sauvegardes portent sur TOUTE la base de données (toutes les sociétés
// confondues, hashes de mots de passe inclus) + le dossier uploads global.
// L'accès est donc réservé au SUPER_ADMIN — un ADMIN de société ne doit jamais
// pouvoir déclencher ni télécharger un dump multi-tenant.
router.use(authMiddleware);
router.use(requireSuperAdmin);

/**
 * GET /api/backups/config
 * Get current backup configuration
 */
router.get('/config', async (req, res) => {
    try {
        const config = await backupService.getConfig();
        res.json({ ...config, last_error: backupService.lastError, running: backupService.running });
    } catch (err) {
        console.error('Error fetching backup config:', err);
        res.status(500).json({ error: 'Erreur serveur interne' });
    }
});

/**
 * PUT /api/backups/config
 * Update backup configuration
 */
router.put('/config', async (req, res) => {
    try {
        const updatedConfig = await backupService.setConfig(req.body);
        res.json({ message: 'Configuration de sauvegarde mise à jour', config: updatedConfig });
    } catch (err) {
        console.error('Error updating backup config:', err);
        res.status(500).json({ error: err.message || 'Erreur lors de la mise à jour de la configuration de sauvegarde' });
    }
});

/**
 * GET /api/backups/history
 * List available backup files
 */
router.get('/history', async (req, res) => {
    try {
        const history = await backupService.getBackupHistory();
        res.json(history);
    } catch (err) {
        console.error('Error fetching backup history:', err);
        res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique des sauvegardes' });
    }
});

/**
 * POST /api/backups/trigger
 * Manually trigger a backup
 */
router.post('/trigger', async (req, res) => {
    try {
        const result = await backupService.runBackup();
        res.json({ message: 'Sauvegarde effectuée avec succès', result });
    } catch (err) {
        console.error('Manual backup failed:', err);
        res.status(500).json({ error: err.message || 'La sauvegarde manuelle a échouée' });
    }
});

/**
 * GET /api/backups/download/:filename
 * Download a specific backup file
 */
router.get('/download/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const config = await backupService.getConfig();
        
        // Prevent path traversal attacks
        const cleanFilename = path.basename(filename);
        const filePath = path.join(config.backup_directory, cleanFilename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Fichier de sauvegarde introuvable' });
        }

        res.download(filePath, cleanFilename);
    } catch (err) {
        console.error('Error downloading backup:', err);
        res.status(500).json({ error: 'Erreur lors du téléchargement' });
    }
});

module.exports = router;
