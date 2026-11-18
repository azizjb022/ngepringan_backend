require('dotenv').config();

let pool;

let rawDbUrl = String(process.env.DATABASE_URL || '').trim();
rawDbUrl = rawDbUrl.replace(/^DATABASE_URL\s*=\s*/i, '');
rawDbUrl = rawDbUrl.replace(/^psql\s+/i, '');
rawDbUrl = rawDbUrl.replace(/^["']+|["']+$/g, '').trim();

if (rawDbUrl && (rawDbUrl.startsWith('postgres') || rawDbUrl.includes('@'))) {
  // ========================================================
  // CLOUD DATABASE: POSTGRESQL / SUPABASE (Untuk Vercel / Cloud)
  // ========================================================
  const { Pool } = require('pg');

  let poolConfig = {
    ssl: {
      rejectUnauthorized: false
    }
  };

  // Ekstraksi parameter database mandiri agar karakter khusus pada password tidak memicu "Invalid URL"
  const uriRegex = /^(?:postgres(?:ql)?:\/\/)?([^:]+):(.*)@([^:/]+)(?::(\d+))?(?:\/([^?#]+))?(?:[?#].*)?$/;
  const match = rawDbUrl.match(uriRegex);

  if (match) {
    const [, user, password, host, port, database] = match;
    poolConfig.user = user;
    poolConfig.password = password;
    poolConfig.host = host;
    poolConfig.port = Number(port) || 5432;
    poolConfig.database = database || 'postgres';
  } else {
    try {
      const u = new URL(rawDbUrl);
      poolConfig.user = decodeURIComponent(u.username);
      poolConfig.password = decodeURIComponent(u.password);
      poolConfig.host = u.hostname;
      poolConfig.port = Number(u.port) || 5432;
      poolConfig.database = u.pathname.replace(/^\//, '') || 'postgres';
    } catch {
      poolConfig.connectionString = rawDbUrl;
    }
  }

  const pgPool = new Pool(poolConfig);

  // Helper untuk mentransformasikan query MySQL ke PostgreSQL
  function transformSql(sql) {
    if (typeof sql !== 'string') return sql;
    let s = sql;
    // 0. Transformasi CURRENT_DATE() -> CURRENT_DATE (Postgres tidak pakai tanda kurung)
    s = s.replace(/\bCURRENT_DATE\(\)/gi, 'CURRENT_DATE');
    // 0.1 Transformasi nested DATE_SUB di dalam DATE_FORMAT menjadi cast ::date
    s = s.replace(/DATE_FORMAT\(DATE_SUB\(CURRENT_DATE(?:\(\))?,\s*INTERVAL\s+(\d+)\s+MONTH\),\s*'%Y-%m-01'\)/gi, (m, d) => `TO_CHAR(CURRENT_DATE - INTERVAL '${d} months', 'YYYY-MM-01')::date`);
    // 0.2 Transformasi boolean sum: SUM(col = 'val') -> SUM(CASE WHEN col = 'val' THEN 1 ELSE 0 END)
    s = s.replace(/\bSUM\(([a-zA-Z0-9_]+)\s*=\s*('[^']+'|\w+)\)/gi, (m, col, val) => `SUM(CASE WHEN ${col} = ${val} THEN 1 ELSE 0 END)`);
    // 1. Transformasi fungsi tanggal & agregat MySQL -> PostgreSQL
    s = s.replace(/\bDAY\(([^)]+)\)/gi, (m, c) => `EXTRACT(DAY FROM ${c})`);
    s = s.replace(/\bMONTH\(([^)]+)\)/gi, (m, c) => `EXTRACT(MONTH FROM ${c})`);
    s = s.replace(/\bYEAR\(([^)]+)\)/gi, (m, c) => `EXTRACT(YEAR FROM ${c})`);
    s = s.replace(/\bDATE_FORMAT\(([^,]+),\s*'%Y-%m-01'\)/gi, (m, c) => `TO_CHAR(${c}, 'YYYY-MM-01')`);
    s = s.replace(/\bDATE_FORMAT\(([^,]+),\s*'%Y-%m-%d'\)/gi, (m, c) => `TO_CHAR(${c}, 'YYYY-MM-DD')`);
    s = s.replace(/\bDATE_FORMAT\(([^,]+),\s*'%Y-%m'\)/gi, (m, c) => `TO_CHAR(${c}, 'YYYY-MM')`);
    s = s.replace(/\bDATE_ADD\(([^,]+),\s*INTERVAL\s+(\d+)\s+DAY\)/gi, (m, c, d) => `(${c}::date + INTERVAL '${d} days')`);
    s = s.replace(/\bDATE_SUB\(([^,]+),\s*INTERVAL\s+(\d+)\s+DAY\)/gi, (m, c, d) => `(${c}::date - INTERVAL '${d} days')`);
    s = s.replace(/\bDATE_SUB\(([^,]+),\s*INTERVAL\s+(\d+)\s+MONTH\)/gi, (m, c, d) => `(${c}::date - INTERVAL '${d} months')`);
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
