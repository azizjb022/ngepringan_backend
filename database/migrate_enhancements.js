const pool = require('../src/config/database');

async function migrate() {
  console.log('Running enhancements migration...');

  const [wCols] = await pool.query("SHOW COLUMNS FROM warga LIKE 'saldo_deposit'");
  if (wCols.length === 0) {
    await pool.query("ALTER TABLE warga ADD COLUMN saldo_deposit DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER status");
    console.log('Added saldo_deposit to warga');
  }

  const [jCols1] = await pool.query("SHOW COLUMNS FROM jimpitan LIKE 'status_lapangan'");
  if (jCols1.length === 0) {
    await pool.query("ALTER TABLE jimpitan ADD COLUMN status_lapangan ENUM('lunas', 'kosong_nihil', 'titip_tetangga', 'rumah_tutup_mudik') NOT NULL DEFAULT 'lunas' AFTER nominal");
    console.log('Added status_lapangan to jimpitan');
  }

  const [jCols2] = await pool.query("SHOW COLUMNS FROM jimpitan LIKE 'catatan_lapangan'");
  if (jCols2.length === 0) {
    await pool.query("ALTER TABLE jimpitan ADD COLUMN catatan_lapangan VARCHAR(255) NULL AFTER status_lapangan");
    console.log('Added catatan_lapangan to jimpitan');
  }

  const [jCols3] = await pool.query("SHOW COLUMNS FROM jimpitan LIKE 'metode_bayar'");
  if (jCols3.length === 0) {
    await pool.query("ALTER TABLE jimpitan ADD COLUMN metode_bayar ENUM('tunai', 'deposit') NOT NULL DEFAULT 'tunai' AFTER catatan_lapangan");
    console.log('Added metode_bayar to jimpitan');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS jadwal_ronda (
      id INT AUTO_INCREMENT PRIMARY KEY,
      hari ENUM('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu') NOT NULL,
      rt VARCHAR(10) NULL COMMENT 'RT tugas ronda, atau NULL jika lintas RT',
      nama_regu VARCHAR(100) NOT NULL,
      anggota TEXT NOT NULL,
      keterangan VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_jadwal_hari (hari)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('Ensured jadwal_ronda table');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS absensi_ronda (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tanggal DATE NOT NULL,
      petugas_id INT NOT NULL,
      rt VARCHAR(10) NOT NULL,
      waktu_pertama DATETIME NOT NULL,
      waktu_terakhir DATETIME NOT NULL,
      total_catatan INT NOT NULL DEFAULT 1,
      status ENUM('hadir', 'izin', 'alpa') NOT NULL DEFAULT 'hadir',
      catatan VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_absensi_tanggal_petugas_rt (tanggal, petugas_id, rt),
      CONSTRAINT fk_absensi_petugas FOREIGN KEY (petugas_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('Ensured absensi_ronda table');

  const [jRows] = await pool.query('SELECT COUNT(*) as cnt FROM jadwal_ronda');
  if (jRows[0].cnt === 0) {
    await pool.query(`
      INSERT INTO jadwal_ronda (hari, rt, nama_regu, anggota, keterangan) VALUES
      ('Senin', 'RT 01', 'Regu Garuda', 'Budi, Joko, Doni', 'Ronda malam Selasa'),
      ('Selasa', 'RT 01', 'Regu Rajawali', 'Eko, Faisal, Galih', 'Ronda malam Rabu'),
      ('Rabu', 'RT 01', 'Regu Jalak', 'Hadi, Ilham, Jafar', 'Ronda malam Kamis'),
      ('Kamis', 'RT 01', 'Regu Merpati', 'Kurnia, Lukman, Mahesa', 'Ronda malam Jumat'),
      ('Jumat', 'RT 01', 'Regu Kakatua', 'Naufal, Oki, Pandu', 'Ronda malam Sabtu'),
      ('Sabtu', 'RT 01', 'Regu Elang', 'Qori, Rian, Surya', 'Ronda akhir pekan'),
      ('Minggu', 'RT 01', 'Regu Cendrawasih', 'Taufik, Ujang, Vito', 'Ronda malam Senin')
    `);
    console.log('Seeded sample jadwal_ronda');
  }

  console.log('Migration completed successfully!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
