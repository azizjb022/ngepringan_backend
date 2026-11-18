-- ========================================================
-- SEED DATA: WARGA RT 03 & PETUGAS RT (DEDI, BAYU, LINGGA)
-- Untuk Database Supabase (PostgreSQL)
-- Buka Supabase Dashboard -> SQL Editor -> Tempel & Run
-- ========================================================

-- 1. SEED PETUGAS RT (Password default: password123)
-- Hash bcrypt untuk 'password123': $2b$10$lU7iR8i.Xyq6Zkg07JbL9Ovh8f1X/yQ3qZ6nOqVzM5rW0yYm9W8kG
INSERT INTO users (nama, username, email, password, role, rt, no_hp, is_active)
VALUES 
  ('Dedi', 'dedi', 'dedi@ngepringan.id', '$2b$10$lU7iR8i.Xyq6Zkg07JbL9Ovh8f1X/yQ3qZ6nOqVzM5rW0yYm9W8kG', 'petugas_rt', 'RT 01', '081234560199', 1),
  ('Bayu', 'bayu', 'bayu@ngepringan.id', '$2b$10$lU7iR8i.Xyq6Zkg07JbL9Ovh8f1X/yQ3qZ6nOqVzM5rW0yYm9W8kG', 'petugas_rt', 'RT 02', '081234560299', 1),
  ('Lingga', 'lingga', 'lingga@ngepringan.id', '$2b$10$lU7iR8i.Xyq6Zkg07JbL9Ovh8f1X/yQ3qZ6nOqVzM5rW0yYm9W8kG', 'petugas_rt', 'RT 03', '081234560399', 1),
  ('Dedi', 'petugas_rt01', 'petugas01@ngepringan.id', '$2b$10$lU7iR8i.Xyq6Zkg07JbL9Ovh8f1X/yQ3qZ6nOqVzM5rW0yYm9W8kG', 'petugas_rt', 'RT 01', '081234560100', 1),
  ('Bayu', 'petugas_rt02', 'petugas02@ngepringan.id', '$2b$10$lU7iR8i.Xyq6Zkg07JbL9Ovh8f1X/yQ3qZ6nOqVzM5rW0yYm9W8kG', 'petugas_rt', 'RT 02', '081234560200', 1),
  ('Lingga', 'petugas_rt03', 'petugas03@ngepringan.id', '$2b$10$lU7iR8i.Xyq6Zkg07JbL9Ovh8f1X/yQ3qZ6nOqVzM5rW0yYm9W8kG', 'petugas_rt', 'RT 03', '081234560300', 1)
ON CONFLICT (username) DO UPDATE 
SET nama = EXCLUDED.nama,
    password = EXCLUDED.password,
    role = EXCLUDED.role,
    rt = EXCLUDED.rt,
    no_hp = EXCLUDED.no_hp,
    is_active = 1;

-- 2. SEED WARGA RT 03 (16 KEPALA KELUARGA)
INSERT INTO warga (no_kk, nama_kk, rt, alamat, no_hp, status, saldo_deposit)
VALUES
  ('3401000000030001', 'Joko Widodo', 'RT 03', 'Dusun Ngepringan, RT 03', '081234560301', 'aktif', 0),
  ('3401000000030002', 'Wahyu Hidayat', 'RT 03', 'Dusun Ngepringan, RT 03', '081234560302', 'aktif', 0),
  ('3401000000030003', 'Anang Hermansyah', 'RT 03', 'Dusun Ngepringan, RT 03', '081234560303', 'aktif', 0),
  ('3401000000030004', 'Tri Sutrisno', 'RT 03', 'Dusun Ngepringan, RT 03', '081234560304', 'aktif', 0),
  ('3401000000030005', 'Slamet Raharjo', 'RT 03', 'Dusun Ngepringan, RT 03', '081234560305', 'aktif', 0),
  ('3401000000030006', 'Teguh Santoso', 'RT 03', 'Dusun Ngepringan, RT 03', '081234560306', 'aktif', 0),
  ('3401000000030007', 'Heri Purwanto', 'RT 03', 'Dusun Ngepringan, RT 03', '081234560307', 'aktif', 0),
  ('3401000000030008', 'Anton Wibowo', 'RT 03', 'Dusun Ngepringan, RT 03', '081234560308', 'aktif', 0),
  ('3401000000030009', 'Danang Prasetyo', 'RT 03', 'Dusun Ngepringan, RT 03', '081234560309', 'aktif', 0),
  ('3401000000030010', 'Fajar Nugroho', 'RT 03', 'Dusun Ngepringan, RT 03', '081234560310', 'aktif', 0),
  ('3401000000030011', 'Gunawan Wibisono', 'RT 03', 'Dusun Ngepringan, RT 03', '081234560311', 'aktif', 0),
  ('3401000000030012', 'Indra Kusuma', 'RT 03', 'Dusun Ngepringan, RT 03', '081234560312', 'aktif', 0),
  ('3401000000030013', 'Kurniawan Dwi', 'RT 03', 'Dusun Ngepringan, RT 03', '081234560313', 'aktif', 0),
  ('3401000000030014', 'Lukman Hakim', 'RT 03', 'Dusun Ngepringan, RT 03', '081234560314', 'aktif', 0),
  ('3401000000030015', 'Muchlis Hadi', 'RT 03', 'Dusun Ngepringan, RT 03', '081234560315', 'aktif', 0),
  ('3401000000030016', 'Rian Hidayatullah', 'RT 03', 'Dusun Ngepringan, RT 03', '081234560316', 'aktif', 0)
ON CONFLICT (no_kk) DO NOTHING;
