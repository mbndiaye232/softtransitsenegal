const rateLimit = require('express-rate-limit');

// Bypass explicite pour les tests e2e (jamais défini en prod) : évite que la
// suite de sécurité, qui appelle /register et /login en boucle, ne se fasse
// elle-même limiter. Activé via DISABLE_RATE_LIMIT=true dans backend/.env.test.
const DISABLED = process.env.DISABLE_RATE_LIMIT === 'true';
const passthrough = (req, res, next) => next();
const make = (options) => (DISABLED ? passthrough : rateLimit(options));

// Réponse JSON cohérente avec le reste de l'API quand la limite est atteinte.
const handler = (req, res) => {
    res.status(429).json({
        error: 'Trop de requêtes. Veuillez réessayer plus tard.',
        code: 'RATE_LIMITED',
    });
};

const common = {
    standardHeaders: 'draft-7', // en-têtes RateLimit-*
    legacyHeaders: false,
    handler,
};

/**
 * Connexion : anti-brute-force. 10 tentatives / 15 min / IP.
 * Les connexions réussies ne sont pas comptées (on ne pénalise pas un usage normal).
 */
const loginLimiter = make({
    ...common,
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
});

/**
 * Réinitialisation de mot de passe (demande + validation) : anti-abus / anti-spam.
 * 5 requêtes / heure / IP.
 */
const passwordResetLimiter = make({
    ...common,
    windowMs: 60 * 60 * 1000,
    limit: 5,
});

/**
 * Inscription : empêche la création massive de sociétés. 5 / heure / IP.
 */
const registerLimiter = make({
    ...common,
    windowMs: 60 * 60 * 1000,
    limit: 5,
});

module.exports = { loginLimiter, passwordResetLimiter, registerLimiter };
