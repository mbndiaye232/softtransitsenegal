const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, checkPermission } = require('../middleware/auth');
const nodemailer = require('nodemailer');

// Apply middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

/**
 * GET /api/comptes-mails
 * Get all email accounts for the current structure
 */
router.get('/', checkPermission('CONFIG', 'can_view'), async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM comptesmails WHERE structur_id = ? ORDER BY AdresseMail',
            [req.structur_id]
        );
        res.json(rows);
    } catch (err) {
        console.error('Fetch comptes mails error:', err);
        res.status(500).json({ error: 'Failed to fetch email accounts' });
    }
});

/**
 * POST /api/comptes-mails
 * Create a new email account
 */
router.post('/', checkPermission('CONFIG', 'can_edit'), async (req, res) => {
    const {
        AdresseMail, MotDePasse, LibelleMail,
        ServeurSMTP, PortSMTP, SecureSSL,
        ServeurPOP, PortPOP,
        ServeurIMAPEntrant, PortIMAPEntrant, ServeurIMAPSortant, PortIMAPSortant
    } = req.body;

    try {
        const [result] = await pool.query(
            `INSERT INTO comptesmails (
                AdresseMail, MotDePasse, LibelleMail, ServeurSMTP, PortSMTP, SecureSSL,
                ServeurPOP, PortPOP, ServeurIMAPEntrant, PortIMAPEntrant,
                ServeurIMAPSortant, PortIMAPSortant, structur_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                AdresseMail, MotDePasse, LibelleMail, ServeurSMTP, PortSMTP || '587', SecureSSL ? 1 : 0,
                ServeurPOP || null, PortPOP || '110', ServeurIMAPEntrant || null, PortIMAPEntrant || '143',
                ServeurIMAPSortant || null, PortIMAPSortant || '587', req.structur_id
            ]
        );
        res.status(201).json({ id: result.insertId, message: 'Account created successfully' });
    } catch (err) {
        console.error('Create compte mail error:', err);
        res.status(500).json({ error: 'Failed to create account' });
    }
});

/**
 * PUT /api/comptes-mails/:id
 * Update an email account
 */
router.put('/:id', checkPermission('CONFIG', 'can_edit'), async (req, res) => {
    const { id } = req.params;
    const {
        AdresseMail, MotDePasse, LibelleMail,
        ServeurSMTP, PortSMTP, SecureSSL,
        ServeurPOP, PortPOP,
        ServeurIMAPEntrant, PortIMAPEntrant, ServeurIMAPSortant, PortIMAPSortant
    } = req.body;

    try {
        await pool.query(
            `UPDATE comptesmails SET
                AdresseMail = ?, MotDePasse = ?, LibelleMail = ?, ServeurSMTP = ?, PortSMTP = ?, SecureSSL = ?,
                ServeurPOP = ?, PortPOP = ?, ServeurIMAPEntrant = ?, PortIMAPEntrant = ?,
                ServeurIMAPSortant = ?, PortIMAPSortant = ?
            WHERE IDComptesMails = ? AND structur_id = ?`,
            [
                AdresseMail, MotDePasse, LibelleMail, ServeurSMTP, PortSMTP, SecureSSL ? 1 : 0,
                ServeurPOP, PortPOP, ServeurIMAPEntrant, PortIMAPEntrant,
                ServeurIMAPSortant, PortIMAPSortant, id, req.structur_id
            ]
        );
        res.json({ message: 'Account updated successfully' });
    } catch (err) {
        console.error('Update compte mail error:', err);
        res.status(500).json({ error: 'Failed to update account' });
    }
});

/**
 * DELETE /api/comptes-mails/:id
 * Delete an email account
 */
router.delete('/:id', checkPermission('CONFIG', 'can_edit'), async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM comptesmails WHERE IDComptesMails = ? AND structur_id = ?', [id, req.structur_id]);
        res.json({ message: 'Account deleted successfully' });
    } catch (err) {
        console.error('Delete compte mail error:', err);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

/**
 * POST /api/comptes-mails/test
 * Test SMTP connection
 */
router.post('/test', checkPermission('CONFIG', 'can_edit'), async (req, res) => {
    const { ServeurSMTP, PortSMTP, AdresseMail, MotDePasse, SecureSSL } = req.body;

    if (!ServeurSMTP || !PortSMTP || !AdresseMail || !MotDePasse) {
        return res.status(400).json({ error: 'Missing required parameters for test' });
    }

    const portNum = parseInt(PortSMTP);
    const useSSL  = SecureSSL === true || SecureSSL === 1 || SecureSSL === '1';

    const transporter = nodemailer.createTransport({
        host: ServeurSMTP,
        port: portNum,
        secure: useSSL,
        auth: {
            user: AdresseMail,
            pass: MotDePasse
        },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 20000,
        greetingTimeout: 20000,
        socketTimeout: 20000,
    });

    try {
        // Verify connection configuration
        await transporter.verify();
        
        // Optionally send a test email
        /*
        await transporter.sendMail({
            from: AdresseMail,
            to: AdresseMail,
            subject: 'Test de connexion Soft Transit',
            text: 'Ceci est un mail de test pour valider votre configuration SMTP.'
        });
        */
        
        res.json({ success: true, message: 'Connexion SMTP réussie !' });
    } catch (err) {
        console.error('SMTP Test failed:', err);
        res.status(500).json({ error: 'La connexion a échoué: ' + err.message });
    }
});

module.exports = router;
