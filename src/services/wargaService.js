const pool = require('../config/database');

exports.fetchWarga = async (filters = {}) => {
  const { rt, status, q } = filters;
  let query = `
    SELECT w.*, uc.nama AS created_by_nama, uu.nama AS updated_by_nama
    FROM warga w
    LEFT JOIN users uc ON w.created_by = uc.id
    LEFT JOIN users uu ON w.updated_by = uu.id
    WHERE 1=1
  `;
  const params = [];

  if (rt) {
    query += ' AND w.rt = ?';
    params.push(rt);
  }
  if (status) {
    query += ' AND w.status = ?';
    params.push(status);
  }
  if (q) {
    query += ' AND (w.nama_kk LIKE ? OR w.no_kk LIKE ? OR w.alamat LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  query += ' ORDER BY w.rt ASC, w.nama_kk ASC';
  const [rows] = await pool.query(query, params);
  return rows;
};

exports.getWargaById = async (id) => {
  const [rows] = await pool.query(
    `SELECT w.*, uc.nama AS created_by_nama, uu.nama AS updated_by_nama
     FROM warga w
     LEFT JOIN users uc ON w.created_by = uc.id
     LEFT JOIN users uu ON w.updated_by = uu.id
     WHERE w.id = ?`,
    [id]
  );
  if (rows.length === 0) {
    throw { status: 404, message: 'Data warga tidak ditemukan' };
  }
  return rows[0];
};

exports.insertWarga = async (data) => {
  const { no_kk, nama_kk, rt, alamat, no_hp, status, created_by, updated_by } = data;
  const [result] = await pool.query(
    `INSERT INTO warga (no_kk, nama_kk, rt, alamat, no_hp, status, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      no_kk || null,
      nama_kk,
      rt,
      alamat || null,
      no_hp || null,
      status || 'aktif',
      created_by || null,
      updated_by || null,
    ]
  );
  return result.insertId;
};

exports.updateWarga = async (id, data) => {
  const { no_kk, nama_kk, rt, alamat, no_hp, status, updated_by } = data;
  const [result] = await pool.query(
    `UPDATE warga
     SET no_kk = ?, nama_kk = ?, rt = ?, alamat = ?, no_hp = ?, status = ?, updated_by = ?
     WHERE id = ?`,
    [
      no_kk || null,
      nama_kk,
      rt,
      alamat || null,
      no_hp || null,
      status || 'aktif',
      updated_by || null,
      id,
    ]
  );
  if (result.affectedRows === 0) {
    throw { status: 404, message: 'Data warga tidak ditemukan' };
  }
  return true;
};

exports.deleteWarga = async (id) => {
  try {
    const [result] = await pool.query('DELETE FROM warga WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      throw { status: 404, message: 'Data warga tidak ditemukan' };
    }
    return true;
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      throw {
        status: 400,
        message: 'Warga ini sudah memiliki riwayat jimpitan. Ubah status menjadi "tidak aktif" sebagai gantinya.'
      };
    }
    throw error;
  }
};

exports.getRekapRT = async () => {
  const [rows] = await pool.query(`
    SELECT
      rt,
      COUNT(*) AS jumlah_kk,
      SUM(CASE WHEN status = 'aktif' THEN 1 ELSE 0 END) AS kk_aktif
    FROM warga
    GROUP BY rt
    ORDER BY rt ASC
  `);
  return rows;
};

exports.getDaftarRT = async () => {
  const [rows] = await pool.query(
    "SELECT DISTINCT rt FROM warga WHERE rt IS NOT NULL AND rt <> '' ORDER BY rt ASC"
  );
  return rows.map((r) => r.rt);
};
