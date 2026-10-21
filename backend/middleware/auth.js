const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    // M2 : le jeton n'est accepté QUE via l'en-tête Authorization (jamais en
    // query string, pour éviter sa fuite dans les logs/historique/Referer).
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    try {
        // M1 : pas de secret de repli — JWT_SECRET est garanti présent au démarrage (server.js).
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Un jeton du portail client n'ouvre jamais l'API du personnel
        if (decoded.aud === 'portail') return res.status(401).json({ error: 'Invalid token' });

        const userId = decoded.userId || decoded.id;
        const [users] = await pool.query(
            `SELECT a.IDAgents as id, a.NomAgent as name, a.Email as email,
                    a.Login as login, a.role, a.structur_id, a.is_active,
                    s.NomSociete as company_name, s.is_provider
             FROM agents a
             JOIN structur s ON a.structur_id = s.IDSociete
             WHERE a.IDAgents = ? AND a.is_active = 1`,
            [userId]
        );

        if (!users.length) {
            return res.status(401).json({ error: 'User not found or inactive' });
        }

        req.user = users[0];
        console.log('AuthMiddleware: User found:', req.user.id, 'Role:', req.user.role, 'IsProvider:', req.user.is_provider);
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(401).json({ error: 'Invalid token' });
    }
};

/**
 * Middleware to check if user has required role
 */
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};

/**
 * Middleware super admin : role SUPER_ADMIN uniquement
 */
const requireSuperAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Accès réservé au super administrateur' });
    }
    next();
};

/**
 * Middleware to check functional permissions
 */
const checkPermission = (resourceCode, accessLevel) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // SUPER_ADMIN a tous les droits
        if (req.user.role === 'SUPER_ADMIN') {
            return next();
        }

        // ADMIN de sa propre société a tous les droits sur sa société
        if (req.user.role === 'ADMIN') {
            return next();
        }

        try {
            const [permissions] = await pool.query(
                `SELECT ap.*
                 FROM agent_permissions ap
                 JOIN permissions p ON ap.permission_id = p.id
                 WHERE ap.agent_id = ? AND p.code = ?`,
                [req.user.id, resourceCode]
            );

            if (permissions.length === 0) {
                return res.status(403).json({ error: `No permission assigned for ${resourceCode}` });
            }

            const perm = permissions[0];
            if (perm[accessLevel] === 1) {
                return next();
            }

            res.status(403).json({ error: `Insufficient privilege: ${accessLevel} on ${resourceCode}` });
        } catch (error) {
            console.error('Permission check error:', error);
            res.status(500).json({ error: 'Internal server error during permission check' });
        }
    };
};

/**
 * Middleware tenant : isole les données par société
 */
const tenantMiddleware = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    req.structur_id = req.user.structur_id;

    // SUPER_ADMIN peut accéder à toutes les sociétés
    if (req.user.role === 'SUPER_ADMIN') {
        const target_structur_id = req.query.structur_id || req.body.structur_id;
        if (target_structur_id) {
            req.structur_id = target_structur_id;
            req.is_viewing_all = false;
        } else if (req.method === 'GET') {
            req.is_viewing_all = true;
        }
    }

    next();
};

module.exports = {
    authMiddleware,
    requireRole,
    requireSuperAdmin,
    checkPermission,
    tenantMiddleware
};
