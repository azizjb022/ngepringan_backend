-- ============================================================
-- Migrasi: Data Warga (per KK) & Jimpitan per KK
-- Dibuat: 2026-10-19
-- ============================================================

-- Tabel data warga (per Kepala Keluarga / KK)
CREATE TABLE IF NOT EXISTS warga (
  id INT AUTO_INCREMENT PRIMARY KEY,
  no_kk VARCHAR(30) NULL COMMENT 'Nomor Kartu Keluarga',
  nama_kk VARCHAR(100) NOT NULL COMMENT 'Nama Kepala Keluarga',
  rt VARCHAR(10) NOT NULL COMMENT 'RT tempat tinggal',
  alamat VARCHAR(255) NULL,
  no_hp VARCHAR(20) NULL,
  status ENUM('aktif', 'tidak_aktif') NOT NULL DEFAULT 'aktif',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_warga_rt (rt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabel jimpitan (detail pembayaran per KK)
CREATE TABLE IF NOT EXISTS jimpitan (
  id INT AUTO_INCREMENT PRIMARY KEY,
  warga_id INT NOT NULL,
  rt VARCHAR(10) NOT NULL,
  tanggal DATE NOT NULL COMMENT 'Tanggal pencatatan/pembayaran',
  jumlah_hari INT NOT NULL DEFAULT 1 COMMENT 'Jumlah hari yang dibayar (untuk tunggakan)',
  nominal DECIMAL(12, 2) NOT NULL COMMENT 'jumlah_hari x tarif per hari',
  petugas_id INT NOT NULL,
  status_setor ENUM('pending', 'disetor_ke_bendahara') NOT NULL DEFAULT 'pending',
  bukti_foto VARCHAR(255) NULL,
  transaksi_keuangan_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_jimpitan_rt (rt),
  KEY idx_jimpitan_tanggal (tanggal),
  KEY idx_jimpitan_warga (warga_id),
  KEY idx_jimpitan_status (status_setor),
  CONSTRAINT fk_jimpitan_warga FOREIGN KEY (warga_id) REFERENCES warga (id),
  CONSTRAINT fk_jimpitan_petugas FOREIGN KEY (petugas_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
