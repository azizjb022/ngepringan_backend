-- ============================================================
-- Migrasi: Tambah audit trail user (created_by & updated_by)
-- Tabel: warga & jimpitan
-- Tanggal: 2026-11-08
-- ============================================================

-- 1. Tabel Warga
ALTER TABLE warga
  ADD COLUMN IF NOT EXISTS created_by INT NULL AFTER saldo_deposit,
  ADD COLUMN IF NOT EXISTS updated_by INT NULL AFTER created_by,
  ADD CONSTRAINT fk_warga_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_warga_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL;

-- 2. Tabel Jimpitan
ALTER TABLE jimpitan
  ADD COLUMN IF NOT EXISTS created_by INT NULL AFTER petugas_id,
  ADD COLUMN IF NOT EXISTS updated_by INT NULL AFTER created_by,
  ADD CONSTRAINT fk_jimpitan_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_jimpitan_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL;
