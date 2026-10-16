/**
 * Accès PostgreSQL avec une interface compatible mysql2/promise.
 *
 * Le code métier a été écrit pour mysql2 ; ce module conserve la même API
 * pour éviter de réécrire les ~600 requêtes :
 *   - pool.query(sql, params) -> [rows, fields] pour un SELECT,
 *                                [{ insertId, affectedRows }] pour INSERT/UPDATE/DELETE
 *   - placeholders `?`, tableaux (IN (?)), tableaux de tableaux (VALUES ?), objets (SET ?)
 *   - pool.getConnection() -> connexion avec beginTransaction/commit/rollback/release
 *   - backticks MySQL retirés, LIKE -> ILIKE (MySQL compare sans tenir compte de la casse)
 *   - noms de colonnes renvoyés dans leur casse d'origine (IDDossiers et non iddossiers),
 *     d'après config/column-names.json et les alias écrits dans la requête
 */
const { Pool, types, defaults } = require('pg');
const columnNames = require('./column-names.json');
require('dotenv').config();

// Mêmes types JS que mysql2 (timezone '+00:00') : BIGINT -> number, dates en UTC
types.setTypeParser(20, (v) => Number(v));
types.setTypeParser(1082, (v) => new Date(`${v}T00:00:00Z`));
types.setTypeParser(1114, (v) => new Date(`${v.replace(' ', 'T')}Z`));
defaults.parseInputDatesAsUTC = true;

// Render fournit une seule chaîne DATABASE_URL (TLS obligatoire) ; en local on
// utilise les variables PG_HOST/PG_PORT/PG_USER/PG_PASSWORD/PG_DATABASE séparées.
const pgPool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
    })
  : new Pool({
      host: process.env.PG_HOST || 'localhost',
      port: parseInt(process.env.PG_PORT || '5433'),
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      database: process.env.PG_DATABASE || 'softtransit',
      max: 10,
    });

// Métadonnées chargées au démarrage : nom de table par OID, colonne identité par table
let meta = null;
async function loadMeta() {
  if (!meta) {
    const { rows } = await pgPool.query(`
      SELECT c.oid, c.relname,
             (SELECT a.attname FROM pg_attribute a
               WHERE a.attrelid = c.oid AND a.attidentity <> '' LIMIT 1) AS identity
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'`);
    meta = { tableByOid: new Map(), identityByTable: new Map() };
    for (const r of rows) {
      meta.tableByOid.set(r.oid, r.relname);
      if (r.identity) meta.identityByTable.set(r.relname, r.identity);
    }
  }
  return meta;
}

// Traduit une requête mysql2 en requête pg : placeholders, backticks, LIKE
function translate(sql, params = []) {
  const values = [];
  const push = (v) => {
    if (v === undefined) v = null;
    if (typeof v === 'boolean') v = v ? 1 : 0;
    values.push(v);
    return `$${values.length}`;
  };
  const expand = (p) => {
    if (Array.isArray(p)) {
      return p.map((item) => (Array.isArray(item) ? `(${item.map(push).join(', ')})` : push(item))).join(', ');
    }
    if (p && typeof p === 'object' && !(p instanceof Date) && !Buffer.isBuffer(p)) {
      return Object.entries(p).map(([k, v]) => `${k} = ${push(v)}`).join(', ');
    }
    return push(p);
  };

  let out = '';
  let paramIndex = 0;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'") {
      let j = i + 1;
      while (j < sql.length && !(sql[j] === "'" && sql[j + 1] !== "'")) j += sql[j] === "'" ? 2 : 1;
      out += sql.slice(i, j + 1);
      i = j;
    } else if (ch === '`') {
      // identifiant MySQL : on retire simplement les backticks
    } else if (ch === '?') {
      out += expand(params[paramIndex++]);
    } else if (/[Ll]/.test(ch) && /^LIKE\b/i.test(sql.slice(i, i + 5)) && !/\w/.test(sql[i - 1] || '')) {
      out += 'ILIKE';
      i += 3;
    } else {
      out += ch;
    }
  }
  return { text: out, values };
}

// Casse d'origine des noms de colonnes d'un résultat
function restoreCase(sql, fields, m) {
  const aliases = new Map();
  const tokens = new Map();
  for (const t of sql.match(/[A-Za-z_]\w*/g) || []) if (t !== t.toLowerCase()) tokens.set(t.toLowerCase(), t);
  for (const [, a] of sql.matchAll(/\bAS\s+[`"]?([A-Za-z_]\w*)/gi)) aliases.set(a.toLowerCase(), a);

  return fields.map((f) => {
    const table = m.tableByOid.get(f.tableID);
    return aliases.get(f.name)
      || (table && columnNames[table] && columnNames[table][f.name])
      || tokens.get(f.name)
      || f.name;
  });
}

async function run(client, sql, params) {
  const m = await loadMeta();
  let { text, values } = translate(sql, params);

  const insert = text.match(/^\s*INSERT\s+INTO\s+(\w+)/i);
  const identity = insert && meta.identityByTable.get(insert[1].toLowerCase());
  if (identity && !/\bRETURNING\b/i.test(text)) text = `${text.replace(/;\s*$/, '')} RETURNING ${identity}`;

  let res;
  try {
    res = await client.query({ text, values });
  } catch (err) {
    // Codes d'erreur mysql2 testés par les routes
    const mysqlCode = {
      23505: 'ER_DUP_ENTRY',
      23503: /is still referenced/.test(err.detail || '') ? 'ER_ROW_IS_REFERENCED_2' : 'ER_NO_REFERENCED_ROW_2',
      42703: 'ER_BAD_FIELD_ERROR',
    }[err.code];
    err.pgCode = err.code;
    if (mysqlCode) err.code = mysqlCode;
    err.sqlMessage = err.message;
    throw err;
  }

  if (res.command === 'SELECT' || (res.fields.length && !insert)) {
    const names = restoreCase(sql, res.fields, m);
    const rows = res.rows.map((row) => {
      const o = {};
      res.fields.forEach((f, i) => { o[names[i]] = row[f.name]; });
      return o;
    });
    return [rows, res.fields];
  }
  const header = { affectedRows: res.rowCount, insertId: identity && res.rows[0] ? Number(res.rows[0][identity]) : 0 };
  return [header, undefined];
}

function wrapClient(client) {
  return {
    query: (sql, params) => run(client, sql, params),
    beginTransaction: () => client.query('BEGIN'),
    commit: () => client.query('COMMIT'),
    rollback: () => client.query('ROLLBACK'),
    release: () => client.release(),
  };
}

const pool = {
  query: (sql, params) => run(pgPool, sql, params),
  getConnection: async () => wrapClient(await pgPool.connect()),
  end: () => pgPool.end(),
};

pgPool.query('SELECT 1')
  .then(() => console.log('✓ Database connected successfully'))
  .catch((err) => console.error('✗ Database connection failed:', err.message));

module.exports = pool;
