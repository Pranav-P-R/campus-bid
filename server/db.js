const path = require('path');
const fs = require('fs');
require('dotenv').config();

let dbClient = null;
let isPgPool = false;

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
  const { PGlite } = require('@electric-sql/pglite');
  const dataDir = path.resolve(__dirname, '../data/pglite_db');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const pglite = new PGlite(dataDir);
  await pglite.waitReady;
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
  } else {
    await db.exec(schemaSql);
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

