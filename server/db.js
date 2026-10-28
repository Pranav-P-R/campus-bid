const path = require('path');
const fs = require('fs');
const { PGlite } = require('@electric-sql/pglite');
require('dotenv').config();

let dbClient = null;
let isPgPool = false;

function hasStalePgliteLock(dataDir) {
  const lockPath = path.join(dataDir, 'postmaster.pid');
  if (!fs.existsSync(lockPath)) return false;

  const firstLine = fs.readFileSync(lockPath, 'utf8').split(/\r?\n/, 1)[0].trim();
  return firstLine === '-42';
}

async function openPglite(dataDir) {
  let pglite = new PGlite(dataDir);

  try {
    await pglite.waitReady;
    return pglite;
  } catch (err) {
    if (!hasStalePgliteLock(dataDir)) throw err;

    const lockPath = path.join(dataDir, 'postmaster.pid');
    await pglite.close();
    fs.unlinkSync(lockPath);
    console.warn('Removed stale PGlite lock file and retrying database startup.');

    pglite = new PGlite(dataDir);
    await pglite.waitReady;
    return pglite;
  }
}

async function getDb() {
  if (dbClient) return dbClient;

  if (process.env.DATABASE_URL) {
    try {
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      await pool.query('SELECT 1');
      console.log('Connected to PostgreSQL via DATABASE_URL');
      dbClient = pool;
      isPgPool = true;
      return dbClient;
    } catch (err) {
      console.warn('Could not connect to PostgreSQL via DATABASE_URL, falling back to embedded PGlite:', err.message);
    }
  }

  // Fallback to embedded persistent PGlite
  const dataDir = path.resolve(__dirname, '../data/pglite_db');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const pglite = await openPglite(dataDir);
  console.log('Connected to embedded PostgreSQL (PGlite) persistent database at', dataDir);
  dbClient = pglite;
  isPgPool = false;
  return dbClient;
}

async function initDb() {
  const db = await getDb();
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  if (isPgPool) {
    await db.query(schemaSql);
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) NOT NULL DEFAULT 'buyer'`);
  } else {
    await db.exec(schemaSql);
    await db.exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) NOT NULL DEFAULT 'buyer'`);
  }
  console.log('Database schema verified & ready.');
}

async function query(text, params = []) {
  const db = await getDb();
  return db.query(text, params);
}

/**
 * Execute operations within an atomic transaction.
 * @param {Function} callback - async (tx) => { ... }
 */
async function transaction(callback) {
  const db = await getDb();
  if (isPgPool) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const tx = {
        query: (text, params) => client.query(text, params)
      };
      const result = await callback(tx);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    // PGlite transaction
    return db.transaction(async (tx) => {
      return callback({
        query: (text, params) => tx.query(text, params)
      });
    });
  }
}

module.exports = {
  getDb,
  initDb,
  query,
  transaction
};
