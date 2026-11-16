-- Mencegah satu KK dicatat dua kali pada tanggal yang sama
-- (penting saat beberapa petugas RT bekerja bersamaan)
ALTER TABLE jimpitan
  ADD UNIQUE KEY uq_jimpitan_warga_tanggal (warga_id, tanggal);
