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

exports.seedRt03AndPetugas = async () => {
  const bcrypt = require('bcryptjs');
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('password123', salt);

  const PETUGAS = [
    { nama: 'Dedi', username: 'dedi', email: 'dedi@ngepringan.id', rt: 'RT 01', no_hp: '081234560199' },
    { nama: 'Bayu', username: 'bayu', email: 'bayu@ngepringan.id', rt: 'RT 02', no_hp: '081234560299' },
    { nama: 'Lingga', username: 'lingga', email: 'lingga@ngepringan.id', rt: 'RT 03', no_hp: '081234560399' },
    { nama: 'Dedi', username: 'petugas_rt01', email: 'petugas01@ngepringan.id', rt: 'RT 01', no_hp: '081234560100' },
    { nama: 'Bayu', username: 'petugas_rt02', email: 'petugas02@ngepringan.id', rt: 'RT 02', no_hp: '081234560200' },
    { nama: 'Lingga', username: 'petugas_rt03', email: 'petugas03@ngepringan.id', rt: 'RT 03', no_hp: '081234560300' },
  ];

  for (const p of PETUGAS) {
    const [existing] = await pool.query('SELECT id, username FROM users WHERE username = ?', [p.username]);
    if (existing.length > 0) {
      await pool.query(
        'UPDATE users SET nama = ?, email = ?, password = ?, role = ?, rt = ?, no_hp = ?, is_active = 1 WHERE username = ?',
        [p.nama, p.email, hashedPassword, 'petugas_rt', p.rt, p.no_hp, p.username]
      );
    } else {
      await pool.query(
        `INSERT INTO users (nama, username, email, password, role, rt, no_hp, is_active)
         VALUES (?, ?, ?, ?, 'petugas_rt', ?, ?, 1)`,
        [p.nama, p.username, p.email, hashedPassword, p.rt, p.no_hp]
      );
    }
  }

  const WARGA_RT03 = [
    'Joko Widodo', 'Wahyu Hidayat', 'Anang Hermansyah', 'Tri Sutrisno',
    'Slamet Raharjo', 'Teguh Santoso', 'Heri Purwanto', 'Anton Wibowo',
    'Danang Prasetyo', 'Fajar Nugroho', 'Gunawan Wibisono', 'Indra Kusuma',
    'Kurniawan Dwi', 'Lukman Hakim', 'Muchlis Hadi', 'Rian Hidayatullah',
  ];

  let wargaInserted = 0;
  for (let i = 0; i < WARGA_RT03.length; i++) {
    const seq = i + 1;
    const no_kk = `340100000003${String(seq).padStart(4, '0')}`;
    const nama_kk = WARGA_RT03[i];
    const alamat = `Dusun Ngepringan, RT 03`;
    const no_hp = `0812345603${String(seq).padStart(2, '0')}`;

    const [exists] = await pool.query('SELECT id FROM warga WHERE no_kk = ? OR (nama_kk = ? AND rt = ?)', [
      no_kk,
      nama_kk,
      'RT 03',
    ]);

    if (exists.length === 0) {
      await pool.query(
        `INSERT INTO warga (no_kk, nama_kk, rt, alamat, no_hp, status, saldo_deposit)
         VALUES (?, ?, 'RT 03', ?, ?, 'aktif', 0)`,
        [no_kk, nama_kk, alamat, no_hp]
      );
      wargaInserted++;
    }
  }

  const [wargaSummary] = await pool.query('SELECT rt, COUNT(*) AS total FROM warga GROUP BY rt ORDER BY rt');
  return {
    petugas: ['dedi (RT 01)', 'bayu (RT 02)', 'lingga (RT 03)'],
    warga_rt03_inserted: wargaInserted,
    rekap_warga: wargaSummary,
  };
};
