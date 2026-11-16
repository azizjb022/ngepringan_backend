CREATE TABLE IF NOT EXISTS setoran_jimpitan (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rt VARCHAR(10) NOT NULL,
  dari_tanggal DATE NOT NULL,
  sampai_tanggal DATE NOT NULL,
  total_nominal DECIMAL(12, 2) NOT NULL,
  jumlah_transaksi INT NOT NULL,
  status ENUM('menunggu_validasi', 'diterima', 'ditolak') NOT NULL DEFAULT 'menunggu_validasi',
  diajukan_oleh INT NOT NULL,
  diajukan_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  divalidasi_oleh INT NULL,
  divalidasi_at DATETIME NULL,
  transaksi_keuangan_id INT NULL,
  catatan_validasi VARCHAR(255) NULL,
  KEY idx_setoran_status (status),
  KEY idx_setoran_rt (rt),
  CONSTRAINT fk_setoran_pengaju FOREIGN KEY (diajukan_oleh) REFERENCES users(id),
  CONSTRAINT fk_setoran_validator FOREIGN KEY (divalidasi_oleh) REFERENCES users(id),
  CONSTRAINT fk_setoran_transaksi FOREIGN KEY (transaksi_keuangan_id) REFERENCES transaksi_keuangan(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE jimpitan
  MODIFY status_setor ENUM('pending', 'diajukan_ke_bendahara', 'disetor_ke_bendahara') NOT NULL DEFAULT 'pending',
  ADD COLUMN setoran_id INT NULL AFTER transaksi_keuangan_id,
  ADD KEY idx_jimpitan_setoran (setoran_id),
  ADD CONSTRAINT fk_jimpitan_setoran FOREIGN KEY (setoran_id) REFERENCES setoran_jimpitan(id);
