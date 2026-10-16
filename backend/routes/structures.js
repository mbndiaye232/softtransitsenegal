const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, tenantMiddleware, requireRole, checkPermission } = require('../middleware/auth');
const upload = require('../middleware/upload');
const path = require('path');
const auditService = require('../services/auditService');
const { uploadFile } = require('../utils/storage');

/* ── Helper : upload un fichier multer (memory) vers R2 ─────────────────── */
async function uploadFileToR2(file, folder) {
    const ext  = path.extname(file.originalname);
    const key  = `${folder}/${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    await uploadFile(key, file.buffer, file.mimetype);
    return key; // ex: "societe/cachets/cachet_facture-1716300000000-123456789.jpg"
}

/**
 * GET /api/structures/me
 * Get current company details
 */
router.get('/me', authMiddleware, tenantMiddleware, checkPermission('STRUCTURES', 'can_view'), async (req, res) => {
    try {
        const [companies] = await pool.query(
            `SELECT * FROM structur WHERE IDSociete = ?`,
            [req.structur_id]
        );

        if (companies.length === 0) {
            return res.status(404).json({ error: 'Company not found' });
        }

        // Don't send raw BLOBs if they exist (we use file paths now)
        const company = companies[0];
        delete company.logoSociete;
        delete company.cachetfacture;
        delete company.cachetlivraison;
        delete company.autrecachet;

        res.json(company);
    } catch (error) {
        console.error('Get company error:', error);
        res.status(500).json({ error: 'Failed to fetch company details' });
    }
});

/**
 * PUT /api/structures/me
 * Update company details and files
 */
router.put('/me',
    authMiddleware,
    tenantMiddleware,
    checkPermission('STRUCTURES', 'can_edit'),
    upload.fields([
        { name: 'logo', maxCount: 1 },
        { name: 'cachet_facture', maxCount: 1 },
        { name: 'cachet_livraison', maxCount: 1 },
        { name: 'cachet_autre', maxCount: 1 }
    ]),
    async (req, res) => {
        const connection = await pool.getConnection();
        try {
            const {
                NomSociete,
                SigleNomCourt,
                adrSociete,
                Emailstructur,
                telSociete,
                celSociete,
                FormeJuridique,
                Capital,
                ActivitesPrincipales,
                CNumeroCompteBancaire,
                NINEASociete,
                RegistreCommerce,
                NumeroOrbus,
                email_resp_exploitation,
                email_resp_financier,
            } = req.body;

            // Prepare update query
            let updateFields = [];
            let updateValues = [];

            // Helper to add field if present
            const addField = (field, value) => {
                if (value !== undefined) {
                    updateFields.push(`${field} = ?`);
                    updateValues.push(value);
                }
            };

            addField('NomSociete', NomSociete);
            addField('SigleNomCourt', SigleNomCourt);
            addField('adrSociete', adrSociete);
            addField('Emailstructur', Emailstructur);
            addField('telSociete', telSociete);
            addField('celSociete', celSociete);
            addField('FormeJuridique', FormeJuridique);
            addField('Capital', Capital);
            addField('ActivitesPrincipales', ActivitesPrincipales);
            addField('CNumeroCompteBancaire', CNumeroCompteBancaire);
            addField('NINEASociete', NINEASociete);
            addField('RegistreCommerce', RegistreCommerce);
            addField('NumeroOrbus', NumeroOrbus);
            addField('email_resp_exploitation', email_resp_exploitation);
            addField('email_resp_financier', email_resp_financier);

            // Handle file uploads → Cloudflare R2
            if (req.files) {
                if (req.files.logo) {
                    const key = await uploadFileToR2(req.files.logo[0], 'societe/logos');
                    addField('cheminlogo', key);
                }
                if (req.files.cachet_facture) {
                    const key = await uploadFileToR2(req.files.cachet_facture[0], 'societe/cachets');
                    addField('chemin_cachet_facture', key);
                }
                if (req.files.cachet_livraison) {
                    const key = await uploadFileToR2(req.files.cachet_livraison[0], 'societe/cachets');
                    addField('chemin_cachet_livraison', key);
                }
                if (req.files.cachet_autre) {
                    const key = await uploadFileToR2(req.files.cachet_autre[0], 'societe/cachets');
                    addField('chemin_cachet_autre', key);
                }
            }

            if (updateFields.length === 0) {
                return res.json({ message: 'No changes to update' });
            }

            updateValues.push(req.structur_id);

            await connection.query(
                `UPDATE structur SET ${updateFields.join(', ')} WHERE IDSociete = ?`,
                updateValues
            );

            await auditService.log({
                agent_id: req.user.id,
                structur_id: req.user.structur_id,
                action: 'UPDATE',
                resource_type: 'STRUCTURE',
                resource_id: req.structur_id,
                details: { name: NomSociete },
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            });

            // Fetch updated data
            const [updated] = await connection.query(
                'SELECT * FROM structur WHERE IDSociete = ?',
                [req.structur_id]
            );

            const company = updated[0];
            delete company.logoSociete;
            delete company.cachetfacture;
            delete company.cachetlivraison;
            delete company.autrecachet;

            res.json({ message: 'Company details updated', company });

        } catch (error) {
            console.error('Update company error:', error);
            res.status(500).json({ error: 'Failed to update company details' });
        } finally {
            connection.release();
        }
    }
);

module.exports = router;
