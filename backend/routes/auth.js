const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const {
    hashPassword,
    comparePassword,
    generateToken,
    generateResetToken,
    validateEmail,
    validatePassword
} = require('../utils/auth');
const { authMiddleware } = require('../middleware/auth');
const { sendMail } = require('../services/mailer');
const escapeHtml = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const { loginLimiter, passwordResetLimiter, registerLimiter } = require('../middleware/rateLimit');

/**
 * POST /api/auth/register
 * Register a new company (structur) with admin user
 */
router.post('/register', registerLimiter, async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const {
            // Company info
            companyName,
            companyEmail,
            companyAddress,
            companyPhone,
            countryId,
            // Admin user info
            adminName,
            adminEmail,
            adminLogin,
            adminPassword
        } = req.body;

        // Validation
        if (!companyName || !companyEmail || !adminName || !adminEmail || !adminLogin || !adminPassword) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (!validateEmail(companyEmail) || !validateEmail(adminEmail)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        const passwordValidation = validatePassword(adminPassword);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.message });
        }

        await connection.beginTransaction();

        // Check if company email or login already exists
        const [existingCompany] = await connection.query(
            'SELECT IDSociete FROM structur WHERE Emailstructur = ?',
            [companyEmail]
        );

        if (existingCompany.length > 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'Company email already registered' });
        }

        const [existingUser] = await connection.query(
            'SELECT IDAgents FROM agents WHERE LOWER(Login) = LOWER(?) OR LOWER(Email) = LOWER(?)',
            [adminLogin, adminEmail]
        );

        if (existingUser.length > 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'Login or email already exists' });
        }

        // Create company (structur)
        const [companyResult] = await connection.query(
            `INSERT INTO structur (
        NomSociete,
        Emailstructur,
        adrSociete,
        telSociete,
        IDPays,
        is_active,
        created_at
      ) VALUES (?, ?, ?, ?, ?, 1, NOW())`,
            [companyName, companyEmail, companyAddress || '', companyPhone || '', countryId || null]
        );

        const structurId = companyResult.insertId;

        // Hash password
        const passwordHash = await hashPassword(adminPassword);

        // Create admin user
        const [userResult] = await connection.query(
            `INSERT INTO agents (
        structur_id,
        NomAgent,
        Email,
        Login,
        password_hash,
        role,
        is_active
      ) VALUES (?, ?, ?, ?, ?, 'ADMIN', 1)`,
            [structurId, adminName, adminEmail, adminLogin, passwordHash]
        );

        await connection.commit();

        // Generate token
        const token = generateToken(userResult.insertId, structurId, 'ADMIN');

        res.status(201).json({
            message: 'Registration successful',
            token,
            user: {
                id: userResult.insertId,
                name: adminName,
                email: adminEmail,
                login: adminLogin,
                role: 'ADMIN',
                structur_id: structurId
            },
            company: {
                id: structurId,
                name: companyName,
                email: companyEmail
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    } finally {
        connection.release();
    }
});

/**
 * POST /api/auth/login
 * Login with email/login and password
 */
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { login, password } = req.body;

        if (!login || !password) {
            return res.status(400).json({ error: 'Login and password are required' });
        }

        // Find user by login or email (insensible à la casse, comme sous MySQL)
        const [users] = await pool.query(
            `SELECT
        a.IDAgents as id,
        a.structur_id,
        a.NomAgent as name,
        a.Email as email,
        a.Login as login,
        a.password_hash,
        a.role,
        a.FonctionAgent as "function",
        a.is_active,
        a.two_factor_enabled,
        g.LibelleGroupe as group_name,
        s.NomSociete as company_name,
        s.is_active as company_active
      FROM agents a
      JOIN structur s ON a.structur_id = s.IDSociete
      LEFT JOIN groupes g ON a.IDGroupes = g.IDGroupes
      WHERE (LOWER(a.Login) = LOWER(?) OR LOWER(a.Email) = LOWER(?))`,
            [login, login]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];

        // Check if user and company are active
        if (!user.is_active) {
            return res.status(403).json({ error: 'User account is inactive' });
        }

        if (!user.company_active) {
            return res.status(403).json({ error: 'Company account is inactive' });
        }

        // Verify password
        const passwordMatch = await comparePassword(password, user.password_hash);

        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await pool.query(
            'UPDATE agents SET last_login = NOW() WHERE IDAgents = ?',
            [user.id]
        );

        // Generate token
        const token = generateToken(user.id, user.structur_id, user.role);

        const isDeclarant = user.role === 'USER' && (
            (user.group_name || '').toLowerCase().includes('clarant') ||
            (user.function || '').toLowerCase().includes('clarant')
        );

        const gn = (user.group_name || '').toLowerCase();
        const fn = (user.function || '').toLowerCase();
        const isResponsable = (
            gn.includes('responsable') || fn.includes('responsable') ||
            gn.includes('chef transit') || fn.includes('chef transit') ||
            gn.includes('chef de transit') || fn.includes('chef de transit')
        );
        const isFacturier = (
            gn.includes('facturier') || fn.includes('facturier') ||
            gn.includes('facturation') || fn.includes('facturation')
        );
        const isDirecteur = (
            gn.includes('directeur') || fn.includes('directeur') ||
            gn.includes('directrice') || fn.includes('directrice') ||
            gn.includes('daf') || fn.includes('daf') ||
            gn.includes('dg') || fn.includes('dg')
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                login: user.login,
                role: user.role,
                structur_id: user.structur_id,
                company_name: user.company_name,
                two_factor_enabled: user.two_factor_enabled,
                group_name: user.group_name,
                function: user.function,
                is_declarant: isDeclarant,
                is_responsable: isResponsable,
                is_facturier: isFacturier,
                is_directeur: isDirecteur
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const [users] = await pool.query(
            `SELECT
        a.IDAgents as id,
        a.structur_id,
        a.NomAgent as name,
        a.Email as email,
        a.Login as login,
        a.role,
        a.FonctionAgent as "function",
        a.Tel as phone,
        a.two_factor_enabled,
        g.LibelleGroupe as group_name,
        s.NomSociete as company_name,
        s.Emailstructur as company_email
      FROM agents a
      JOIN structur s ON a.structur_id = s.IDSociete
      LEFT JOIN groupes g ON a.IDGroupes = g.IDGroupes
      WHERE a.IDAgents = ?`,
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const u = users[0];
        u.is_declarant = u.role === 'USER' && (
            (u.group_name || '').toLowerCase().includes('clarant') ||
            (u.function || '').toLowerCase().includes('clarant')
        );

        const gn = (u.group_name || '').toLowerCase();
        const fn = (u.function || '').toLowerCase();
        u.is_responsable = (
            gn.includes('responsable') || fn.includes('responsable') ||
            gn.includes('chef transit') || fn.includes('chef transit') ||
            gn.includes('chef de transit') || fn.includes('chef de transit')
        );
        u.is_facturier = (
            gn.includes('facturier') || fn.includes('facturier') ||
            gn.includes('facturation') || fn.includes('facturation')
        );
        u.is_directeur = (
            gn.includes('directeur') || fn.includes('directeur') ||
            gn.includes('directrice') || fn.includes('directrice') ||
            gn.includes('daf') || fn.includes('daf') ||
            gn.includes('dg') || fn.includes('dg')
        );

        res.json({ user: u });

    } catch (error) {
        console.error('Get user error:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !validateEmail(email)) {
            return res.status(400).json({ error: 'Valid email is required' });
        }

        const [users] = await pool.query(
            'SELECT IDAgents, NomAgent, Email FROM agents WHERE LOWER(Email) = LOWER(?) AND is_active = 1',
            [email]
        );

        // Always return success to prevent email enumeration
        if (users.length === 0) {
            return res.json({ message: 'If the email exists, a reset link has been sent' });
        }

        const user = users[0];
        const resetToken = generateResetToken();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Save reset token
        await pool.query(
            'UPDATE agents SET reset_token = ?, reset_token_expires = ? WHERE IDAgents = ?',
            [resetToken, expiresAt, user.IDAgents]
        );

        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
        try {
            await sendMail({
                to: user.Email,
                subject: 'Réinitialisation de votre mot de passe',
                html: `<p>Bonjour ${escapeHtml(user.NomAgent || '')},</p>` +
                      `<p>Pour choisir un nouveau mot de passe, cliquez sur ce lien (valable 5 minutes) :</p>` +
                      `<p><a href="${resetLink}">${resetLink}</a></p>` +
                      `<p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`
            });
        } catch (mailErr) {
            console.error('Envoi du mail de réinitialisation impossible:', mailErr.message);
        }
        if (process.env.NODE_ENV === 'development') {
            console.log(`Lien de réinitialisation (dev) pour ${user.Email}: ${resetLink}`);
        }

        res.json({
            message: 'If the email exists, a reset link has been sent',
            // Remove this in production:
            resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', passwordResetLimiter, async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }

        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.message });
        }

        // Find user with valid token
        const [users] = await pool.query(
            `SELECT IDAgents, Email
       FROM agents
       WHERE reset_token = ?
       AND reset_token_expires > NOW()
       AND is_active = 1`,
            [token]
        );

        if (users.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const user = users[0];

        // Hash new password
        const passwordHash = await hashPassword(newPassword);

        // Update password and clear reset token
        await pool.query(
            `UPDATE agents
       SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL
       WHERE IDAgents = ?`,
            [passwordHash, user.IDAgents]
        );

        res.json({ message: 'Password reset successful' });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

module.exports = router;
