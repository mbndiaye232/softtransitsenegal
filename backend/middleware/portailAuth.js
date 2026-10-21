const jwt = require('jsonwebtoken');
const pool = require('../config/database');

/**
 * Authentification du portail client. Le jeton est signé avec l'audience « portail » : il est refusé par
 * l'API du personnel, et inversement un jeton du personnel est refusé ici. Le compte doit être ACTIF et
 * rattaché à un client : req.portail.idclients vient de la base, jamais de la requête.
 */
module.exports = async function portailAuth(req, res, next) {
    const h = req.headers.authorization;
    if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Connexion requise' });
    try {
        const decoded = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET, { audience: 'portail' });
        const [rows] = await pool.query(
            `SELECT id, idclients, email, nom FROM client_users
             WHERE id = ? AND statut = 'ACTIF' AND idclients IS NOT NULL`,
            [decoded.clientUserId]
        );
        if (!rows.length) return res.status(401).json({ error: 'Accès désactivé ou session expirée' });
        req.portail = rows[0];
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Session invalide ou expirée' });
    }
};
