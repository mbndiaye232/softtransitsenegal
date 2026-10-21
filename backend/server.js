const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

// M1 : refuser de démarrer sans secret JWT (évite tout repli sur une valeur connue).
if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET manquant. Le serveur ne peut pas démarrer.');
    process.exit(1);
}

const app = express();

// Derrière le proxy Render (1 saut) : nécessaire pour que req.ip reflète la
// vraie IP client (X-Forwarded-For) — utilisé par le rate limiting.
app.set('trust proxy', 1);

// L4 : en-têtes de sécurité (HSTS, X-Content-Type-Options, etc.).
// - CSP désactivée : c'est une API JSON, pas une page HTML.
// - CORP en cross-origin : indispensable pour que le frontend (autre origine)
//   puisse charger les ressources servies par l'API (documents, images, PDF).
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Middleware — origines autorisées : localhost (dev) + FRONTEND_URL (prod, Cloudflare Pages)
// + tout déploiement de prévisualisation Cloudflare Pages (*.softtransitgabon.pages.dev)
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.FRONTEND_URL
].filter(Boolean);
const pagesPreviewPattern = /^https:\/\/[a-z0-9-]+\.softtransitgabon\.pages\.dev$/;

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || pagesPreviewPattern.test(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition'] // nom du fichier lu par le portail client lors d'un téléchargement
}));
// L4 : limite de taille des corps JSON/urlencoded (les fichiers passent par
// multer, pas par ces parsers). Borne la consommation mémoire par requête.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Soft Transit API is running' });
});

// Import routes
const authRoutes = require('./routes/auth');
const structuresRoutes = require('./routes/structures');
const paysRoutes = require('./routes/pays');
const clientsRoutes = require('./routes/clients');
const statutsRoutes = require('./routes/statuts');
const groupesRoutes = require('./routes/groupes');
const usersRoutes = require('./routes/users');
const dossiersRoutes = require('./routes/dossiers');
const notesRoutes = require('./routes/notes');
const produitsRoutes = require('./routes/produits');
const regimesRoutes = require('./routes/regimes');
const devisesRoutes = require('./routes/devises');
const taxesRoutes = require('./routes/taxes');
const tiersRoutes = require('./routes/tiers');
const cotationsRoutes = require('./routes/cotations');
const statisticsRoutes = require('./routes/statistics');
const activitesRoutes = require('./routes/activites');
const incotermsRoutes = require('./routes/incoterms');
const regimesOTRoutes = require('./routes/regimesOT');
const typesDocumentsOTRoutes = require('./routes/typesDocumentsOT');
const ordresTransitRoutes = require('./routes/ordresTransit');

// Routes supplémentaires
const dashboardsRoutes = require('./routes/dashboards');
const billOfLadingRoutes = require('./routes/billOfLading');
const compositionRoutes = require('./routes/composition');
const comptesMailsRoutes = require('./routes/comptesMails');
const declarationsRoutes = require('./routes/declarations');
const devisRoutes = require('./routes/devis');
const documentsRoutes = require('./routes/documents');
const domainesActiviteRoutes = require('./routes/domainesActivite');
const etapesDossiersRoutes = require('./routes/etapesDossiers');
const etatsFinanciersRoutes = require('./routes/etatsFinanciers');
const facturesRoutes = require('./routes/factures');
const facturesRecuesRoutes = require('./routes/facturesrecues');
const lieuxRoutes = require('./routes/lieux');
const miseEnLivraisonRoutes = require('./routes/miseenlivraison');
const moyensTransportRoutes = require('./routes/moyensTransport');
const ordreTransportRoutes = require('./routes/ordreTransport');
const reglementsRoutes = require('./routes/reglements');
const rubriquesRoutes = require('./routes/rubriques');
const tarifsRoutes = require('./routes/tarifs');
const tauxRoutes = require('./routes/taux');
const taxesComplementsRoutes = require('./routes/taxesComplements');
const transportsRoutes = require('./routes/transports');
const typesDocumentsRoutes = require('./routes/typesDocuments');
const unitesPoidRoutes = require('./routes/unitesPoids');
const unitesVolumeRoutes = require('./routes/unitesVolume');
const backupsRoutes = require('./routes/backups');
const suiviTraitementsRoutes = require('./routes/suivi-traitements');
const sommiersRoutes = require('./routes/sommiers');
const entrepotsRoutes = require('./routes/entrepots');
const apurementsRoutes = require('./routes/apurements');

app.use('/api/auth', authRoutes);
app.use('/api/structures', structuresRoutes);
app.use('/api/pays', paysRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/statuts', statutsRoutes);
app.use('/api/groupes', groupesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/dossiers', dossiersRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/produits', produitsRoutes);
app.use('/api/regimes', regimesRoutes);
app.use('/api/devises', devisesRoutes);
app.use('/api/taxes', taxesRoutes);
app.use('/api/tiers', tiersRoutes);
app.use('/api/cotations', cotationsRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/activites', activitesRoutes);
app.use('/api/incoterms', incotermsRoutes);
app.use('/api/regimes-ot', regimesOTRoutes);
app.use('/api/types-documents-ot', typesDocumentsOTRoutes);
app.use('/api/ordres-transit', ordresTransitRoutes);
app.use('/api/dashboards', dashboardsRoutes);
app.use('/api/bill-of-lading', billOfLadingRoutes);
app.use('/api/composition', compositionRoutes);
app.use('/api/comptes-mails', comptesMailsRoutes);
app.use('/api/declarations', declarationsRoutes);
app.use('/api/devis', devisRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/domaines-activite', domainesActiviteRoutes);
app.use('/api/etapes-dossiers', etapesDossiersRoutes);
app.use('/api/etats-financiers', etatsFinanciersRoutes);
app.use('/api/factures', facturesRoutes);
app.use('/api/facturesrecues', facturesRecuesRoutes);
app.use('/api/lieux', lieuxRoutes);
app.use('/api/miseenlivraison', miseEnLivraisonRoutes);
app.use('/api/moyens-transport', moyensTransportRoutes);
app.use('/api/ordre-transport', ordreTransportRoutes);
app.use('/api/reglements', reglementsRoutes);
app.use('/api/rubriques', rubriquesRoutes);
app.use('/api/tarifs', tarifsRoutes);
app.use('/api/taux', tauxRoutes);
app.use('/api/taxes-complements', taxesComplementsRoutes);
app.use('/api/transports', transportsRoutes);
app.use('/api/types-documents', typesDocumentsRoutes);
app.use('/api/unites-poids', unitesPoidRoutes);
app.use('/api/unites-volume', unitesVolumeRoutes);
app.use('/api/backups', backupsRoutes);
app.use('/api/suivi-traitements', suiviTraitementsRoutes);
app.use('/api/sommiers', sommiersRoutes);
app.use('/api/entrepots', entrepotsRoutes);
app.use('/api/apurements', apurementsRoutes);

// Portail client (option) : activé uniquement avec PORTAIL_CLIENT_ENABLED=true
if (process.env.PORTAIL_CLIENT_ENABLED === 'true') {
    app.use('/api/portail', require('./routes/portail'));
    app.use('/api/portail-admin', require('./routes/portailAdmin'));
    console.log('✓ Portail client activé');
}

// Alertes d'échéance sommiers (quotidien à 08h00 UTC)
require('./services/sommierAlertService').startSommierAlertScheduler();

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    // Respecte le statut porté par l'erreur (ex. 413 PayloadTooLargeError) ; 500 sinon.
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API available at http://localhost:${PORT}/api`);
});

module.exports = app;
