/**
 * Prépare la base de test : clone la base de développement softtransit_gabon vers
 * softtransit_gabon_e2e (jamais l'inverse), puis crée trois comptes fictifs.
 * Les mots de passe sont générés une fois dans e2e-gabon/.env (non commité).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const backend = path.join(ROOT, '..', 'backend');
const { Client } = require(path.join(backend, 'node_modules', 'pg'));
const bcrypt = require(path.join(backend, 'node_modules', 'bcrypt'));

const parseEnv = (file) => Object.fromEntries(
    fs.readFileSync(file, 'utf8').split(/\r?\n/)
        .filter(l => l.includes('=') && !l.trim().startsWith('#'))
        .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const dev = parseEnv(path.join(backend, '.env'));
const SOURCE = dev.PG_DATABASE || 'softtransit_gabon';
const TARGET = 'softtransit_gabon_e2e';
if (!TARGET.endsWith('_e2e') || TARGET === SOURCE) throw new Error('Base cible invalide');

const envFile = path.join(ROOT, '.env');
const e2eEnv = fs.existsSync(envFile) ? parseEnv(envFile) : {};
const secret = () => 'Aa1-' + crypto.randomBytes(9).toString('hex');
for (const k of ['E2E_ADMIN_PASSWORD', 'E2E_MANAGER_PASSWORD', 'E2E_USER_PASSWORD']) {
    if (!e2eEnv[k]) e2eEnv[k] = secret();
}
fs.writeFileSync(envFile, Object.entries(e2eEnv).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');

const conn = { host: dev.PG_HOST || 'localhost', port: dev.PG_PORT || 5433, user: dev.PG_USER, password: dev.PG_PASSWORD };
const cli = ['-h', String(conn.host), '-p', String(conn.port), '-U', conn.user];
const run = (cmd, args, input) => {
    const r = spawnSync(cmd, args, { input, env: { ...process.env, PGPASSWORD: conn.password }, maxBuffer: 1 << 28 });
    if (r.status !== 0) throw new Error(`${cmd} a échoué : ${r.stderr.toString('latin1')}`);
    return r.stdout;
};

(async () => {
    const admin = new Client({ ...conn, database: 'postgres' });
    await admin.connect();
    await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [TARGET]);
    await admin.query(`DROP DATABASE IF EXISTS ${TARGET}`);
    await admin.query(`CREATE DATABASE ${TARGET} ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'French_France.1252' LC_CTYPE 'French_France.1252'`);
    await admin.end();

    const dump = run('pg_dump', [...cli, '-d', SOURCE, '--no-owner', '--no-privileges', '-E', 'UTF8']);
    run('psql', [...cli, '-d', TARGET, '-q', '-v', 'ON_ERROR_STOP=1'], dump);

    const db = new Client({ ...conn, database: TARGET });
    await db.connect();
    const perm = async (code) => (await db.query('SELECT id FROM permissions WHERE code = $1', [code])).rows[0].id;
    const addAgent = async (login, name, role, password) => {
        const hash = await bcrypt.hash(password, 10);
        const r = await db.query(
            `INSERT INTO agents (structur_id, NomAgent, Email, Login, password_hash, role, is_active)
             VALUES (1, $1, $2, $3, $4, $5, 1) RETURNING idagents`,
            [name, `${login}@e2e.test`, login, hash, role]);
        return r.rows[0].idagents;
    };
    const grant = (agent, permission, [v, c, e, d]) => db.query(
        `INSERT INTO agent_permissions (agent_id, permission_id, can_view, can_create, can_edit, can_delete) VALUES ($1,$2,$3,$4,$5,$6)`,
        [agent, permission, v, c, e, d]);

    await addAgent('e2e_admin', 'E2E Administrateur', 'ADMIN', e2eEnv.E2E_ADMIN_PASSWORD);
    const manager = await addAgent('e2e_manager', 'E2E Gestionnaire', 'USER', e2eEnv.E2E_MANAGER_PASSWORD);
    await addAgent('e2e_user', 'E2E Collaborateur', 'USER', e2eEnv.E2E_USER_PASSWORD);
    // gestionnaire : gère les agents et lit les cotations (rien d'autre)
    await grant(manager, await perm('AGENTS'), [1, 1, 1, 0]);
    await grant(manager, await perm('COTATIONS'), [1, 0, 0, 0]);
    await db.end();
    console.log(`Base ${TARGET} prête (clone de ${SOURCE}) ; comptes e2e_admin, e2e_manager, e2e_user créés.`);
})().catch(e => { console.error(e); process.exit(1); });
