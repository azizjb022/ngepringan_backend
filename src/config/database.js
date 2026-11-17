require('dotenv').config();

let pool;

if (process.env.DATABASE_URL) {
  // ========================================================
  // CLOUD DATABASE: POSTGRESQL / SUPABASE (Untuk Vercel / Cloud)
  // ========================================================
  const { Pool } = require('pg');

  const cleanDbUrl = String(process.env.DATABASE_URL || '').trim().replace(/^["']|["']$/g, '');

  const pgPool = new Pool({
    connectionString: cleanDbUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  // Helper untuk mentransformasikan query MySQL ke PostgreSQL
  function transformSql(sql) {
    if (typeof sql !== 'string') return sql;
    let s = sql;
    // 1. Transformasi fungsi tanggal & agregat MySQL -> PostgreSQL
    s = s.replace(/\bMONTH\(([^)]+)\)/gi, (m, c) => `EXTRACT(MONTH FROM ${c})`);
    s = s.replace(/\bYEAR\(([^)]+)\)/gi, (m, c) => `EXTRACT(YEAR FROM ${c})`);
    s = s.replace(/\bDATE_FORMAT\(([^,]+),\s*'%Y-%m-%d'\)/gi, (m, c) => `TO_CHAR(${c}, 'YYYY-MM-DD')`);
    s = s.replace(/\bDATE_FORMAT\(([^,]+),\s*'%Y-%m'\)/gi, (m, c) => `TO_CHAR(${c}, 'YYYY-MM')`);
    s = s.replace(/\bDATE_ADD\(([^,]+),\s*INTERVAL\s+(\d+)\s+DAY\)/gi, (m, c, d) => `(${c} + INTERVAL '${d} days')`);
    s = s.replace(/\bDATE_SUB\(([^,]+),\s*INTERVAL\s+(\d+)\s+DAY\)/gi, (m, c, d) => `(${c} - INTERVAL '${d} days')`);
    s = s.replace(/\bGROUP_CONCAT\(DISTINCT\s+([^)]+)\s+SEPARATOR\s+('[^']+')\)/gi, (m, c, sep) => `STRING_AGG(DISTINCT ${c}::text, ${sep})`);
    s = s.replace(/\bGROUP_CONCAT\(([^)]+)\s+SEPARATOR\s+('[^']+')\)/gi, (m, c, sep) => `STRING_AGG(${c}::text, ${sep})`);

    // 2. Transformasi parameter ? -> $1, $2, $3, ...
    let paramIndex = 0;
    s = s.replace(/\?/g, () => `$${++paramIndex}`);
    return s;
  }

  // Wrapper query agar kompatibel dengan pemanggilan gaya MySQL: const [rows] = await pool.query(sql, params)
  async function executePgQuery(clientOrPool, sql, params = []) {
    const finalSql = transformSql(sql);
    const result = await clientOrPool.query(finalSql, params);
    const rows = result.rows || [];
    // Simulasikan properti insertId dan affectedRows milik MySQL
    if (result.rowCount !== undefined) {
      rows.affectedRows = result.rowCount;
    }
    if (rows[0] && rows[0].id) {
      rows.insertId = rows[0].id;
    }
    return [rows, result.fields];
  }

  pool = {
    query: (sql, params) => executePgQuery(pgPool, sql, params),
    getConnection: async () => {
      const client = await pgPool.connect();
      return {
        query: (sql, params) => executePgQuery(client, sql, params),
        beginTransaction: () => client.query('BEGIN'),
        commit: () => client.query('COMMIT'),
        rollback: () => client.query('ROLLBACK'),
        release: () => client.release(),
      };
    },
    end: () => pgPool.end(),
  };

  pgPool.on('error', (err) => {
    console.error('Unexpected idle client error in PostgreSQL pool:', err.message);
  });

  if (!process.env.VERCEL) {
    pgPool.connect()
      .then(client => {
        console.log('✅ Berhasil terhubung ke database Supabase (PostgreSQL)');
        client.release();
      })
      .catch(err => {
        console.error('❌ Gagal koneksi ke database PostgreSQL:', err.message);
      });
  }

} else if (process.env.VERCEL) {
  // ========================================================
  // CLOUD ENVIRONMENT (VERCEL) TAPI DATABASE_URL BELUM DIATUR
  // ========================================================
  console.error('❌ PERINGATAN: DATABASE_URL belum diatur di Vercel Environment Variables!');
  pool = {
    query: async () => {
      throw new Error('DATABASE_URL belum diatur di Vercel Environment Variables. Silakan tambahkan connection string database Anda di Vercel Settings -> Environment Variables.');
    },
    getConnection: async () => {
      throw new Error('DATABASE_URL belum diatur di Vercel Environment Variables.');
    },
    end: () => Promise.resolve(),
  };

} else {
  // ========================================================
  // LOCAL DATABASE: MYSQL (XAMPP / Komputer Lokal)
  // ========================================================
  const mysql = require('mysql2/promise');

  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ngepringan',
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+07:00',
    charset: 'utf8mb4'
  });

  if (!process.env.VERCEL) {
    pool.getConnection()
      .then(conn => {
        console.log('✅ Berhasil terhubung ke database MySQL [ngepringan]');
        conn.release();
      })
      .catch(err => {
        console.error('❌ Gagal koneksi ke database MySQL:', err.message);
      });
  }
}

module.exports = pool;
