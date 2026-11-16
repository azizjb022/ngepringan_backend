const pool = require('../config/database');

exports.fetchJadwalRapat = async () => {
  const [rows] = await pool.query(`
    SELECT r.*, u.nama AS pembuat,
      (SELECT COUNT(*) FROM presensi_rapat WHERE rapat_id = r.id AND keterangan = 'hadir') AS total_hadir
    FROM jadwal_rapat r
    JOIN users u ON r.created_by = u.id
    ORDER BY r.tanggal_waktu DESC
  `);
  return rows;
};

exports.insertJadwalRapat = async (data) => {
  const { judul_rapat, deskripsi, tanggal_waktu, lokasi, created_by } = data;
  const [result] = await pool.query(
    `INSERT INTO jadwal_rapat (judul_rapat, deskripsi, tanggal_waktu, lokasi, status, created_by)
     VALUES (?, ?, ?, ?, 'akan_datang', ?)`,
    [judul_rapat, deskripsi, tanggal_waktu, lokasi, created_by]
  );
  return result.insertId;
};

exports.getDetailRapatNotulensi = async (rapatId) => {
  const [rapat] = await pool.query('SELECT * FROM jadwal_rapat WHERE id = ?', [rapatId]);
  if (rapat.length === 0) throw { status: 404, message: 'Rapat tidak ditemukan' };

  const [notulensi] = await pool.query(`
    SELECT n.*, u.nama AS notulis 
    FROM notulensi n 
    JOIN users u ON n.created_by = u.id 
    WHERE n.rapat_id = ?
  `, [rapatId]);

  const [presensi] = await pool.query(`
    SELECT p.*, u.nama, u.rt 
    FROM presensi_rapat p 
    JOIN users u ON p.user_id = u.id 
    WHERE p.rapat_id = ?
  `, [rapatId]);

  return {
    rapat: rapat[0],
    notulensi: notulensi[0] || null,
    presensi
  };
};

exports.saveNotulensi = async (data) => {
  const { rapat_id, isi_notulensi, keputusan, dokumentasi_foto, created_by } = data;
  const [result] = await pool.query(
    `INSERT INTO notulensi (rapat_id, isi_notulensi, keputusan, dokumentasi_foto, created_by)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE 
     isi_notulensi = VALUES(isi_notulensi),
     keputusan = VALUES(keputusan),
     dokumentasi_foto = VALUES(dokumentasi_foto)`,
    [rapat_id, isi_notulensi, keputusan, JSON.stringify(dokumentasi_foto || []), created_by]
  );

  await pool.query("UPDATE jadwal_rapat SET status = 'selesai' WHERE id = ?", [rapat_id]);
  return result;
};

exports.submitPresensi = async (rapat_id, user_id, keterangan, catatan) => {
  const [result] = await pool.query(
    `INSERT INTO presensi_rapat (rapat_id, user_id, waktu_hadir, keterangan, catatan)
     VALUES (?, ?, NOW(), ?, ?)
     ON DUPLICATE KEY UPDATE 
     waktu_hadir = NOW(),
     keterangan = VALUES(keterangan),
     catatan = VALUES(catatan)`,
    [rapat_id, user_id, keterangan || 'hadir', catatan || null]
  );
  return result;
};