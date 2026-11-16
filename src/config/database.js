const mysql = require('mysql2/promise'); // <-- WAJIB /promise
require('dotenv').config();

const pool = mysql.createPool({
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

// Tes koneksi saat inisialisasi
pool.getConnection()
  .then(conn => {
    console.log('✅ Berhasil terhubung ke database MySQL [ngepringan]');
    conn.release();
  })
  .catch(err => {
    console.error('❌ Gagal koneksi ke database:', err.message);
  });

module.exports = pool;