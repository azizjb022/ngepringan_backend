-- ============================================================
-- Migrasi: Fitur Lanjutan Jimpitan (Status Lapangan, Deposit, Jadwal & Absensi Ronda)
-- Tanggal: 2026-11-07
-- ============================================================

-- 1. Tambah kolom saldo_deposit pada tabel warga
SET @dbname = DATABASE();
SET @tablename = "warga";
SET @columnname = "saldo_deposit";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE warga ADD COLUMN saldo_deposit DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER status;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 2. Tambah kolom status_lapangan, catatan_lapangan, dan metode_bayar pada jimpitan
SET @tablename = "jimpitan";
SET @columnname = "status_lapangan";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE jimpitan ADD COLUMN status_lapangan ENUM('lunas', 'kosong_nihil', 'titip_tetangga', 'rumah_tutup_mudik') NOT NULL DEFAULT 'lunas' AFTER nominal;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = "catatan_lapangan";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE jimpitan ADD COLUMN catatan_lapangan VARCHAR(255) NULL AFTER status_lapangan;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = "metode_bayar";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE jimpitan ADD COLUMN metode_bayar ENUM('tunai', 'deposit') NOT NULL DEFAULT 'tunai' AFTER catatan_lapangan;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 3. Tabel Jadwal Ronda Pemuda Karang Taruna
CREATE TABLE IF NOT EXISTS jadwal_ronda (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hari ENUM('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu') NOT NULL,
  rt VARCHAR(10) NULL COMMENT 'RT tugas ronda, atau NULL jika lintas RT',
  nama_regu VARCHAR(100) NOT NULL COMMENT 'Contoh: Regu A, Regu Elang',
  anggota TEXT NOT NULL COMMENT 'Nama-nama anggota pemuda ronda',
  keterangan VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_jadwal_hari (hari)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Tabel Absensi Ronda Otomatis
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
