const pool = require('../config/database');

const formatDateSql = (value) => {
  if (!value) return '';
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).split('T')[0];
};

// Tarif jimpitan per KK per hari (Rp)
const JIMPITAN_PER_HARI = Number(process.env.JIMPITAN_PER_HARI) || 500;

exports.getKonstanta = () => ({ nominal_per_hari: JIMPITAN_PER_HARI });

// Helper internal: catat absensi ronda otomatis saat petugas menginput jimpitan
async function recordAbsensiRonda(connection, { tanggal, petugas_id, rt }) {
  try {
    const [existing] = await connection.query(
      'SELECT id, total_catatan FROM absensi_ronda WHERE tanggal = ? AND petugas_id = ? AND rt = ?',
      [tanggal, petugas_id, rt]
    );
    if (existing.length > 0) {
      await connection.query(
        'UPDATE absensi_ronda SET total_catatan = total_catatan + 1, waktu_terakhir = NOW() WHERE id = ?',
        [existing[0].id]
      );
    } else {
      await connection.query(
        `INSERT INTO absensi_ronda (tanggal, petugas_id, rt, waktu_pertama, waktu_terakhir, total_catatan, status)
         VALUES (?, ?, ?, NOW(), NOW(), 1, 'hadir')`,
        [tanggal, petugas_id, rt]
      );
    }
  } catch (e) {
    console.warn('Absensi ronda notice:', e.message);
  }
}

exports.fetchJimpitan = async (filters = {}) => {
  const { rt, status_setor, status_lapangan, tanggal, warga_id, dari, sampai } = filters;
  let query = `
    SELECT j.*, w.nama_kk, w.no_kk, w.saldo_deposit,
           u.nama AS nama_petugas,
           uc.nama AS created_by_nama,
           uu.nama AS updated_by_nama
    FROM jimpitan j
    JOIN warga w ON j.warga_id = w.id
    JOIN users u ON j.petugas_id = u.id
    LEFT JOIN users uc ON j.created_by = uc.id
    LEFT JOIN users uu ON j.updated_by = uu.id
    WHERE 1=1
  `;
  const params = [];

  if (rt) {
    query += ' AND j.rt = ?';
    params.push(rt);
  }
  if (status_setor) {
    query += ' AND j.status_setor = ?';
    params.push(status_setor);
  }
  if (status_lapangan) {
    query += ' AND j.status_lapangan = ?';
    params.push(status_lapangan);
  }
  if (warga_id) {
    query += ' AND j.warga_id = ?';
    params.push(warga_id);
  }
  if (tanggal) {
    query += ' AND j.tanggal = ?';
    params.push(tanggal);
  }
  if (dari) {
    query += ' AND j.tanggal >= ?';
    params.push(dari);
  }
  if (sampai) {
    query += ' AND j.tanggal <= ?';
    params.push(sampai);
  }

  query += ' ORDER BY j.tanggal DESC, j.rt ASC, j.id DESC';
  const [rows] = await pool.query(query, params);
  return rows;
};

// Rekap jimpitan per RT untuk satu bulan (default bulan berjalan)
exports.fetchRekapPerRT = async (filters = {}) => {
  const now = new Date();
  const bulan = Number(filters.bulan) || now.getMonth() + 1;
  const tahun = Number(filters.tahun) || now.getFullYear();

  const [jimpitanRows] = await pool.query(
    `
    SELECT
      j.rt,
      COALESCE(SUM(j.nominal), 0) AS total_terkumpul,
      COALESCE(SUM(CASE WHEN j.status_setor = 'pending' THEN j.nominal ELSE 0 END), 0) AS total_pending,
      COALESCE(SUM(CASE WHEN j.status_setor = 'diajukan_ke_bendahara' THEN j.nominal ELSE 0 END), 0) AS total_diajukan,
      COALESCE(SUM(CASE WHEN j.status_setor = 'disetor_ke_bendahara' THEN j.nominal ELSE 0 END), 0) AS total_disetor,
      COUNT(j.id) AS jumlah_transaksi
    FROM jimpitan j
    WHERE MONTH(j.tanggal) = ? AND YEAR(j.tanggal) = ?
    GROUP BY j.rt
    `,
    [bulan, tahun]
  );

  const [wargaRows] = await pool.query(`
    SELECT
      rt,
      COUNT(*) AS jumlah_kk,
      SUM(CASE WHEN status = 'aktif' THEN 1 ELSE 0 END) AS kk_aktif,
      COALESCE(SUM(saldo_deposit), 0) AS total_deposit
    FROM warga
    GROUP BY rt
  `);

  const map = new Map();
  const ensure = (rt) => {
    if (!map.has(rt)) {
      map.set(rt, {
        rt,
        jumlah_kk: 0,
        kk_aktif: 0,
        total_deposit: 0,
        total_terkumpul: 0,
        total_pending: 0,
        total_diajukan: 0,
        total_disetor: 0,
        jumlah_transaksi: 0,
        target_bulan_ini: 0
      });
    }
    return map.get(rt);
  };

  wargaRows.forEach((r) => {
    const o = ensure(r.rt);
    o.jumlah_kk = Number(r.jumlah_kk);
    o.kk_aktif = Number(r.kk_aktif);
    o.total_deposit = Number(r.total_deposit);
    const hariDalamBulan = new Date(tahun, bulan, 0).getDate();
    o.target_bulan_ini = o.kk_aktif * JIMPITAN_PER_HARI * hariDalamBulan;
  });

  jimpitanRows.forEach((r) => {
    const o = ensure(r.rt);
    o.total_terkumpul = Number(r.total_terkumpul);
    o.total_pending = Number(r.total_pending);
    o.total_diajukan = Number(r.total_diajukan);
    o.total_disetor = Number(r.total_disetor);
    o.jumlah_transaksi = Number(r.jumlah_transaksi);
  });

  // Ambil rincian tanggal-tanggal jimpitan pending (belum disetor ke bendahara)
  const [pendingDatesRows] = await pool.query(`
    SELECT
      j.rt,
      DATE_FORMAT(j.tanggal, '%Y-%m-%d') AS tanggal,
      COUNT(j.id) AS jumlah_transaksi,
      COALESCE(SUM(j.nominal), 0) AS total_nominal,
      GROUP_CONCAT(DISTINCT u.nama SEPARATOR ', ') AS petugas_list
    FROM jimpitan j
    LEFT JOIN users u ON j.petugas_id = u.id
    WHERE j.status_setor = 'pending' AND j.nominal > 0
    GROUP BY j.rt, j.tanggal
    ORDER BY j.tanggal ASC
  `);

  const pendingByRT = new Map();
  pendingDatesRows.forEach((r) => {
    if (!pendingByRT.has(r.rt)) {
      pendingByRT.set(r.rt, {
        total_nominal: 0,
        total_transaksi: 0,
        total_hari: 0,
        dari_tanggal: null,
        sampai_tanggal: null,
        rincian: []
      });
    }
    const info = pendingByRT.get(r.rt);
    const nom = Number(r.total_nominal);
    const trx = Number(r.jumlah_transaksi);
    info.total_nominal += nom;
    info.total_transaksi += trx;
    info.total_hari += 1;
    if (!info.dari_tanggal || r.tanggal < info.dari_tanggal) info.dari_tanggal = r.tanggal;
    if (!info.sampai_tanggal || r.tanggal > info.sampai_tanggal) info.sampai_tanggal = r.tanggal;
    info.rincian.push({
      tanggal: r.tanggal,
      nominal: nom,
      transaksi: trx,
      petugas: r.petugas_list || '-'
    });
  });

  const listData = [...map.values()].sort((a, b) => String(a.rt).localeCompare(String(b.rt)));
  listData.forEach((item) => {
    const pInfo = pendingByRT.get(item.rt) || {
      total_nominal: 0,
      total_transaksi: 0,
      total_hari: 0,
      dari_tanggal: null,
      sampai_tanggal: null,
      rincian: []
    };
    item.pending_info = pInfo;
    // Sinkronkan total_pending dengan seluruh fisik uang pending yang ada
    if (pInfo.total_nominal > 0) {
      item.total_pending = pInfo.total_nominal;
    }
  });

  return {
    periode: { bulan, tahun },
    nominal_per_hari: JIMPITAN_PER_HARI,
    data: listData
  };
};

exports.insertJimpitan = async (data) => {
  const {
    warga_id,
    tanggal,
    jumlah_hari,
    petugas_id,
    created_by,
    updated_by,
    bukti_foto,
    allowed_rt,
    status_lapangan = 'lunas',
    catatan_lapangan = null,
    metode_bayar = 'tunai',
  } = data;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [wargaRows] = await connection.query(
      'SELECT id, rt, status, nama_kk, saldo_deposit FROM warga WHERE id = ? FOR UPDATE',
      [warga_id]
    );
    if (wargaRows.length === 0) {
      throw { status: 404, message: 'Data warga tidak ditemukan.' };
    }
    const warga = wargaRows[0];

    if (warga.status !== 'aktif') {
      throw { status: 400, message: `Warga ${warga.nama_kk} berstatus tidak aktif.` };
    }

    if (allowed_rt && warga.rt !== allowed_rt) {
      throw {
        status: 403,
        message: `Anda (${allowed_rt}) tidak dapat mencatat warga dari ${warga.rt}.`
      };
    }

    const hari = Math.max(1, parseInt(jumlah_hari, 10) || 1);
    let nominal = 0;

    // Jika status nihil atau rumah tutup mudik, nominal 0 (pencatatan kunjungan ronda)
    if (status_lapangan === 'kosong_nihil' || status_lapangan === 'rumah_tutup_mudik') {
      nominal = 0;
    } else {
      nominal = hari * JIMPITAN_PER_HARI;
    }

    // Jika metode bayar deposit, potong saldo deposit warga
    let updatedDeposit = Number(warga.saldo_deposit || 0);
    if (metode_bayar === 'deposit' && nominal > 0) {
      if (updatedDeposit < nominal) {
        throw {
          status: 400,
          message: `Saldo deposit ${warga.nama_kk} tidak cukup (tersedia Rp ${updatedDeposit.toLocaleString('id-ID')}, dibutuhkan Rp ${nominal.toLocaleString('id-ID')}).`
        };
      }
      updatedDeposit -= nominal;
      await connection.query('UPDATE warga SET saldo_deposit = ? WHERE id = ?', [updatedDeposit, warga.id]);
    }

    // Cek apakah sudah ada catatan kunjungan pada tanggal ini (misal sebelumnya dicatat kosong_nihil)
    const [existingRows] = await connection.query(
      'SELECT id, status_lapangan, status_setor FROM jimpitan WHERE warga_id = ? AND tanggal = ? FOR UPDATE',
      [warga_id, tanggal]
    );

    let resultId = null;
    if (existingRows.length > 0) {
      const existing = existingRows[0];
      if (existing.status_setor !== 'pending') {
        throw { status: 400, message: 'Jimpitan pada tanggal ini sudah disetor ke bendahara.' };
      }
      await connection.query(
        `UPDATE jimpitan
         SET jumlah_hari = ?, nominal = ?, status_lapangan = ?, catatan_lapangan = ?, metode_bayar = ?, petugas_id = ?, updated_by = ?, bukti_foto = COALESCE(?, bukti_foto), updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          hari,
          nominal,
          status_lapangan,
          catatan_lapangan || null,
          metode_bayar,
          petugas_id,
          updated_by || petugas_id,
          bukti_foto || null,
          existing.id,
        ]
      );
      resultId = existing.id;
    } else {
      const [insertResult] = await connection.query(
        `INSERT INTO jimpitan
           (warga_id, rt, tanggal, jumlah_hari, nominal, status_lapangan, catatan_lapangan, metode_bayar, petugas_id, created_by, updated_by, bukti_foto, status_setor)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          warga_id,
          warga.rt,
          tanggal,
          hari,
          nominal,
          status_lapangan,
          catatan_lapangan,
          metode_bayar,
          petugas_id,
          created_by || petugas_id,
          updated_by || petugas_id,
          bukti_foto || null,
        ]
      );
      resultId = insertResult.insertId;
    }

    // Otomatis catat absensi ronda petugas
    await recordAbsensiRonda(connection, { tanggal, petugas_id, rt: warga.rt });

    await connection.commit();
    return {
      id: resultId,
      nominal,
      jumlah_hari: hari,
      rt: warga.rt,
      status_lapangan,
      catatan_lapangan,
      metode_bayar,
      saldo_deposit: updatedDeposit
    };
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      throw {
        status: 409,
        message: `Jimpitan KK tersebut untuk tanggal ${tanggal} sudah dicatat sebelumnya.`
      };
    }
    throw error;
  } finally {
    connection.release();
  }
};

exports.updateJimpitan = async (id, data) => {
  const { warga_id, tanggal, jumlah_hari, allowed_rt, status_lapangan = 'lunas', catatan_lapangan, updated_by } = data;
  const [existingRows] = await pool.query('SELECT * FROM jimpitan WHERE id = ?', [id]);
  if (!existingRows.length) throw { status: 404, message: 'Data jimpitan tidak ditemukan.' };
  if (existingRows[0].status_setor !== 'pending') {
    throw { status: 400, message: 'Jimpitan yang sudah diajukan atau disetor tidak dapat diubah.' };
  }

  const [wargaRows] = await pool.query('SELECT id, rt, status, nama_kk FROM warga WHERE id = ?', [warga_id]);
  if (!wargaRows.length) throw { status: 404, message: 'Data warga tidak ditemukan.' };
  const warga = wargaRows[0];
  if (warga.status !== 'aktif') throw { status: 400, message: `Warga ${warga.nama_kk} berstatus tidak aktif.` };
  if (allowed_rt && warga.rt !== allowed_rt) throw { status: 403, message: `Anda tidak dapat mencatat warga dari ${warga.rt}.` };

  const hari = Math.max(1, parseInt(jumlah_hari, 10) || 1);
  let nominal = 0;
  if (status_lapangan !== 'kosong_nihil' && status_lapangan !== 'rumah_tutup_mudik') {
    nominal = hari * JIMPITAN_PER_HARI;
  }

  try {
    await pool.query(
      `UPDATE jimpitan
       SET warga_id = ?, rt = ?, tanggal = ?, jumlah_hari = ?, nominal = ?, status_lapangan = ?, catatan_lapangan = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status_setor = 'pending'`,
      [warga_id, warga.rt, tanggal, hari, nominal, status_lapangan, catatan_lapangan || null, updated_by || null, id]
    );
    return { id: Number(id), nominal, jumlah_hari: hari, rt: warga.rt, status_lapangan };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw { status: 409, message: `Jimpitan ${warga.nama_kk} untuk tanggal ${tanggal} sudah dicatat.` };
    throw error;
  }
};

// Progres pengambilan per rumah (KK) pada RT & tanggal tertentu
exports.fetchProgress = async ({ rt, tanggal }) => {
  if (!rt) {
    throw { status: 400, message: 'RT wajib dipilih.' };
  }
  if (!tanggal) {
    throw { status: 400, message: 'Tanggal wajib diisi.' };
  }

  const [rows] = await pool.query(
    `SELECT
        w.id, w.nama_kk, w.no_kk, w.rt, w.alamat, w.no_hp, w.saldo_deposit,
        j.id AS jimpitan_id, j.tanggal, j.nominal, j.jumlah_hari, j.status_setor,
        j.status_lapangan, j.catatan_lapangan, j.metode_bayar,
        u.nama AS petugas,
        uc.nama AS created_by_nama,
        uu.nama AS updated_by_nama,
        (j.id IS NOT NULL) AS sudah_dicatat
     FROM warga w
     LEFT JOIN jimpitan j ON j.warga_id = w.id AND j.tanggal = ?
     LEFT JOIN users u ON j.petugas_id = u.id
     LEFT JOIN users uc ON j.created_by = uc.id
     LEFT JOIN users uu ON j.updated_by = uu.id
     WHERE w.rt = ? AND w.status = 'aktif'
     ORDER BY w.nama_kk ASC`,
    [tanggal, rt]
  );

  const [historyRows] = await pool.query(
    `SELECT warga_id, MIN(tanggal) AS tanggal_awal, COALESCE(SUM(nominal), 0) AS total_bayar
     FROM jimpitan
     WHERE rt = ? AND tanggal <= ?
     GROUP BY warga_id`,
    [rt, tanggal]
  );
  const historyMap = new Map(historyRows.map((row) => [row.warga_id, row]));
  rows.forEach((row) => {
    const history = historyMap.get(row.id);
    const tanggalAwal = history?.tanggal_awal
      ? (history.tanggal_awal instanceof Date ? history.tanggal_awal.toISOString().split('T')[0] : String(history.tanggal_awal).split('T')[0])
      : tanggal;
    const hariWajib = Math.max(1, Math.floor((new Date(`${tanggal}T00:00:00`) - new Date(`${tanggalAwal}T00:00:00`)) / 86400000) + 1);
    const tunggakan = Math.max(0, hariWajib * JIMPITAN_PER_HARI - Number(history?.total_bayar || 0));

    // Lunas hari ini jika tercatat dan nominal > 0 serta status bukan kosong_nihil atau rumah_tutup_mudik
    const isLunasHariIni = Boolean(
      row.jimpitan_id &&
      Number(row.nominal) > 0 &&
      row.status_lapangan !== 'kosong_nihil' &&
      row.status_lapangan !== 'rumah_tutup_mudik'
    );

    // KETENTUAN USER: Jika kosong/nihil maka nominal kurangnya TIDAK 0!
    // Minimal 1 hari tarif (Rp 500) atau sebesar total tunggakan yang ada
    const nominalKurang = isLunasHariIni ? 0 : Math.max(JIMPITAN_PER_HARI, tunggakan);
    const hariKurang = Math.max(1, Math.ceil(nominalKurang / JIMPITAN_PER_HARI));

    row.tunggakan = tunggakan;
    row.nominal_kurang = nominalKurang;
    row.hari_kurang = hariKurang;
    row.is_lunas = isLunasHariIni;
    row.nominal_tampil = isLunasHariIni ? Number(row.nominal || 0) : -nominalKurang;
  });

  const lunasRows = rows.filter((r) => r.is_lunas);
  const totalTerkumpul = lunasRows.reduce((sum, r) => sum + Number(r.nominal || 0), 0);

  const counts = {
    lunas: lunasRows.length,
    titip_tetangga: rows.filter((r) => r.status_lapangan === 'titip_tetangga' && r.is_lunas).length,
    kosong_nihil: rows.filter((r) => r.status_lapangan === 'kosong_nihil').length,
    rumah_tutup_mudik: rows.filter((r) => r.status_lapangan === 'rumah_tutup_mudik').length,
  };

  const perPetugasMap = new Map();
  lunasRows.forEach((r) => {
    const key = r.petugas || 'Tidak diketahui';
    if (!perPetugasMap.has(key)) {
      perPetugasMap.set(key, { petugas: key, jumlah: 0, nominal: 0 });
    }
    const item = perPetugasMap.get(key);
    item.jumlah += 1;
    item.nominal += Number(r.nominal || 0);
  });

  return {
    rt,
    tanggal,
    total_kk: rows.length,
    sudah: lunasRows.length,
    belum: rows.length - lunasRows.length,
    total_terkumpul: totalTerkumpul,
    target: rows.length * JIMPITAN_PER_HARI,
    nominal_per_hari: JIMPITAN_PER_HARI,
    counts,
    per_petugas: [...perPetugasMap.values()],
    warga: rows.map((r) => ({
      id: r.id,
      nama_kk: r.nama_kk,
      no_kk: r.no_kk,
      rt: r.rt,
      alamat: r.alamat,
      no_hp: r.no_hp,
      saldo_deposit: Number(r.saldo_deposit || 0),
      sudah_bayar: Boolean(r.is_lunas),
      sudah_dikunjungi: Boolean(r.jimpitan_id),
      nominal_kurang: Number(r.nominal_kurang || 0),
      hari_kurang: Number(r.hari_kurang || 1),
      jimpitan_id: r.jimpitan_id,
      nominal: r.nominal ? Number(r.nominal) : 0,
      nominal_tampil: Number(r.nominal_tampil || 0),
      tunggakan: Number(r.tunggakan || 0),
      jumlah_hari: r.jumlah_hari || 0,
      status_lapangan: r.status_lapangan || (r.is_lunas ? 'lunas' : 'belum'),
      catatan_lapangan: r.catatan_lapangan,
      metode_bayar: r.metode_bayar || 'tunai',
      status_setor: r.status_setor,
      petugas: r.petugas,
      created_by_nama: r.created_by_nama,
      updated_by_nama: r.updated_by_nama,
    })),
  };
};

// Topup deposit jimpitan warga (bayar di muka)
exports.topupDeposit = async ({ warga_id, nominal, keterangan, user_id }) => {
  const nominalNum = Number(nominal);
  if (!nominalNum || nominalNum <= 0) {
    throw { status: 400, message: 'Nominal deposit harus lebih besar dari 0.' };
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [warga] = await connection.query('SELECT id, nama_kk, rt, saldo_deposit FROM warga WHERE id = ? FOR UPDATE', [warga_id]);
    if (!warga.length) throw { status: 404, message: 'Warga tidak ditemukan.' };

    const newSaldo = Number(warga[0].saldo_deposit || 0) + nominalNum;
    await connection.query('UPDATE warga SET saldo_deposit = ? WHERE id = ?', [newSaldo, warga_id]);

    await connection.commit();
    return {
      warga_id,
      nama_kk: warga[0].nama_kk,
      nominal_topup: nominalNum,
      saldo_baru: newSaldo,
      estimasi_hari: Math.floor(newSaldo / JIMPITAN_PER_HARI)
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Potong deposit otomatis untuk warga yang punya saldo pada tanggal tertentu
exports.autoDeductDeposit = async ({ rt, tanggal, petugas_id }) => {
  if (!rt || !tanggal) throw { status: 400, message: 'RT dan tanggal wajib ditentukan.' };

  const [wargaEligible] = await pool.query(
    `SELECT w.id, w.nama_kk, w.rt, w.saldo_deposit
     FROM warga w
     LEFT JOIN jimpitan j ON j.warga_id = w.id AND j.tanggal = ?
     WHERE w.rt = ? AND w.status = 'aktif' AND j.id IS NULL AND w.saldo_deposit >= ?`,
    [tanggal, rt, JIMPITAN_PER_HARI]
  );

  const results = [];
  for (const w of wargaEligible) {
    try {
      const res = await exports.insertJimpitan({
        warga_id: w.id,
        tanggal,
        jumlah_hari: 1,
        petugas_id,
        status_lapangan: 'lunas',
        metode_bayar: 'deposit',
        catatan_lapangan: 'Potong deposit otomatis harian'
      });
      results.push({ warga_id: w.id, nama_kk: w.nama_kk, success: true, ...res });
    } catch (err) {
      results.push({ warga_id: w.id, nama_kk: w.nama_kk, success: false, message: err.message });
    }
  }

  return {
    rt,
    tanggal,
    total_diproses: results.filter((r) => r.success).length,
    detail: results
  };
};

// Detail rincian tanggal-tanggal jimpitan yang belum disetor ke bendahara
exports.fetchPendingSetor = async ({ rt }) => {
  if (!rt) throw { status: 400, message: 'RT wajib dipilih.' };

  const [dateRows] = await pool.query(
    `SELECT
       DATE_FORMAT(j.tanggal, '%Y-%m-%d') AS tanggal,
       COUNT(j.id) AS jumlah_transaksi,
       COALESCE(SUM(j.nominal), 0) AS total_nominal,
       GROUP_CONCAT(DISTINCT u.nama SEPARATOR ', ') AS petugas_list
     FROM jimpitan j
     LEFT JOIN users u ON j.petugas_id = u.id
     WHERE j.rt = ? AND j.status_setor = 'pending' AND j.nominal > 0
     GROUP BY j.tanggal
     ORDER BY j.tanggal ASC`,
    [rt]
  );

  const [transaksiRows] = await pool.query(
    `SELECT
       j.id, j.tanggal, j.nominal, j.jumlah_hari, j.status_lapangan, j.metode_bayar,
       w.nama_kk, w.no_kk, w.alamat,
       u.nama AS petugas_nama
     FROM jimpitan j
     JOIN warga w ON j.warga_id = w.id
     LEFT JOIN users u ON j.petugas_id = u.id
     WHERE j.rt = ? AND j.status_setor = 'pending' AND j.nominal > 0
     ORDER BY j.tanggal ASC, w.nama_kk ASC`,
    [rt]
  );

  const totalNominal = dateRows.reduce((sum, r) => sum + Number(r.total_nominal), 0);
  const totalTransaksi = dateRows.reduce((sum, r) => sum + Number(r.jumlah_transaksi), 0);
  const dariTanggal = dateRows.length ? dateRows[0].tanggal : null;
  const sampaiTanggal = dateRows.length ? dateRows[dateRows.length - 1].tanggal : null;

  return {
    rt,
    total_nominal: totalNominal,
    total_transaksi: totalTransaksi,
    total_hari: dateRows.length,
    dari_tanggal: dariTanggal,
    sampai_tanggal: sampaiTanggal,
    rincian_tanggal: dateRows.map((r) => ({
      tanggal: r.tanggal,
      nominal: Number(r.total_nominal),
      transaksi: Number(r.jumlah_transaksi),
      petugas: r.petugas_list || '-'
    })),
    daftar_transaksi: transaksiRows.map((t) => ({
      ...t,
      tanggal: formatDateSql(t.tanggal),
      nominal: Number(t.nominal)
    }))
  };
};

// Ajukan setoran jimpitan pending satu RT untuk divalidasi bendahara
exports.processSetorPerRT = async (rt, dari, sampai, userId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    if (!dari || !sampai || dari > sampai) {
      throw { status: 400, message: 'Rentang tanggal setoran tidak valid.' };
    }

    const [pending] = await connection.query(
      `SELECT * FROM jimpitan
       WHERE rt = ? AND tanggal BETWEEN ? AND ? AND status_setor = 'pending'
       FOR UPDATE`,
      [rt, dari, sampai]
    );

    if (pending.length === 0) {
      throw { status: 400, message: `Tidak ada jimpitan pending untuk ${rt} pada rentang tanggal tersebut.` };
    }

    const total = pending.reduce((sum, row) => sum + Number(row.nominal), 0);

    const [setoranResult] = await connection.query(
      `INSERT INTO setoran_jimpitan
       (rt, dari_tanggal, sampai_tanggal, total_nominal, jumlah_transaksi, diajukan_oleh)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [rt, dari, sampai, total, pending.length, userId]
    );

    await connection.query(
      `UPDATE jimpitan
       SET status_setor = 'diajukan_ke_bendahara', setoran_id = ?
       WHERE rt = ? AND tanggal BETWEEN ? AND ? AND status_setor = 'pending'`,
      [setoranResult.insertId, rt, dari, sampai]
    );

    await connection.commit();
    return { id: setoranResult.insertId, total, jumlah: pending.length, dari, sampai };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

exports.fetchSetoranMenunggu = async () => {
  const [rows] = await pool.query(`
    SELECT s.*, u.nama AS nama_pengaju
    FROM setoran_jimpitan s
    JOIN users u ON s.diajukan_oleh = u.id
    WHERE s.status = 'menunggu_validasi'
    ORDER BY s.diajukan_at ASC, s.id ASC
  `);
  const ids = rows.map((row) => row.id);
  let dailyRows = [];
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    const [result] = await pool.query(
      `SELECT j.setoran_id, DATE_FORMAT(j.tanggal, '%Y-%m-%d') AS tanggal,
              SUM(j.nominal) AS total_nominal, COUNT(j.id) AS jumlah_transaksi,
              u.nama AS nama_pengaju
       FROM jimpitan j
       JOIN setoran_jimpitan s ON s.id = j.setoran_id
       JOIN users u ON u.id = s.diajukan_oleh
       WHERE j.setoran_id IN (${placeholders})
       GROUP BY j.setoran_id, j.tanggal, u.nama
       ORDER BY j.tanggal ASC`,
      ids
    );
    dailyRows = result;
  }
  const dailyBySetoran = new Map();
  dailyRows.forEach((detail) => {
    if (!dailyBySetoran.has(detail.setoran_id)) dailyBySetoran.set(detail.setoran_id, []);
    dailyBySetoran.get(detail.setoran_id).push(detail);
  });
  const groups = new Map();
  rows.forEach((row) => {
    if (!groups.has(row.rt)) groups.set(row.rt, { rt: row.rt, dari_tanggal: row.dari_tanggal, sampai_tanggal: row.sampai_tanggal, total_nominal: 0, jumlah_transaksi: 0, setoran_ids: [], detail_per_tanggal: [] });
    const group = groups.get(row.rt);
    group.dari_tanggal = String(group.dari_tanggal) < String(row.dari_tanggal) ? group.dari_tanggal : row.dari_tanggal;
    group.sampai_tanggal = String(group.sampai_tanggal) > String(row.sampai_tanggal) ? group.sampai_tanggal : row.sampai_tanggal;
    group.total_nominal += Number(row.total_nominal);
    group.jumlah_transaksi += Number(row.jumlah_transaksi);
    group.setoran_ids.push(row.id);
    const details = dailyBySetoran.get(row.id) || [{
      tanggal: row.dari_tanggal,
      total_nominal: row.total_nominal,
      jumlah_transaksi: row.jumlah_transaksi,
      nama_pengaju: row.nama_pengaju,
    }];
    details.forEach((detail) => {
      group.detail_per_tanggal.push({
        id: `${row.id}-${detail.tanggal}`,
        dari_tanggal: detail.tanggal,
        sampai_tanggal: detail.tanggal,
        total_nominal: Number(detail.total_nominal),
        jumlah_transaksi: Number(detail.jumlah_transaksi),
        nama_pengaju: detail.nama_pengaju || row.nama_pengaju,
      });
    });
  });
  return [...groups.values()];
};

exports.terimaSetoran = async (setoranId, validatorId) => {
  return exports.terimaSetoranGrup([setoranId], validatorId);
};

exports.terimaSetoranGrup = async (setoranIds, validatorId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const ids = [...new Set((setoranIds || []).map(Number).filter(Boolean))];
    if (!ids.length) throw { status: 400, message: 'Setoran yang diterima tidak ditemukan.' };
    const placeholders = ids.map(() => '?').join(',');

    const [setoranRows] = await connection.query(
      `SELECT * FROM setoran_jimpitan WHERE id IN (${placeholders}) FOR UPDATE`,
      ids
    );
    if (setoranRows.length !== ids.length) {
      throw { status: 404, message: 'Pengajuan setoran tidak ditemukan.' };
    }
    const setoran = setoranRows[0];
    if (setoranRows.some((item) => item.status !== 'menunggu_validasi')) {
      throw { status: 400, message: 'Pengajuan setoran ini sudah diproses.' };
    }

    const [jimpitanRows] = await connection.query(
      `SELECT * FROM jimpitan
       WHERE setoran_id IN (${placeholders}) AND status_setor = 'diajukan_ke_bendahara'
       FOR UPDATE`,
      ids
    );
    if (jimpitanRows.length === 0) {
      throw { status: 400, message: 'Detail jimpitan pada pengajuan ini tidak ditemukan.' };
    }

    const total = jimpitanRows.reduce((sum, row) => sum + Number(row.nominal), 0);
    const dari = setoranRows.reduce((min, row) => formatDateSql(row.dari_tanggal) < formatDateSql(min) ? row.dari_tanggal : min, setoran.dari_tanggal);
    const sampai = setoranRows.reduce((max, row) => formatDateSql(row.sampai_tanggal) > formatDateSql(max) ? row.sampai_tanggal : max, setoran.sampai_tanggal);
    const dariText = formatDateSql(dari);
    const sampaiText = formatDateSql(sampai);
    const [kasResult] = await connection.query(
      `INSERT INTO transaksi_keuangan
       (tanggal, kategori_id, jenis, nominal, keterangan, bukti_nota, created_by)
       VALUES (CURRENT_DATE(), 1, 'masuk', ?, ?, NULL, ?)`,
      [
        total,
        `Penerimaan jimpitan ${setoran.rt} (${dariText === sampaiText ? dariText : `${dariText} s/d ${sampaiText}`})`,
        validatorId,
      ]
    );

    await connection.query(
      `UPDATE setoran_jimpitan
       SET status = 'diterima', divalidasi_oleh = ?, divalidasi_at = NOW(),
           transaksi_keuangan_id = ?, total_nominal = ?, jumlah_transaksi = ?
       WHERE id IN (${placeholders})`,
      [validatorId, kasResult.insertId, total, jimpitanRows.length, ...ids]
    );
    await connection.query(
      `UPDATE jimpitan
       SET status_setor = 'disetor_ke_bendahara', transaksi_keuangan_id = ?
       WHERE setoran_id IN (${placeholders}) AND status_setor = 'diajukan_ke_bendahara'`,
      [kasResult.insertId, ...ids]
    );

    await connection.commit();
    return { transaksi_id: kasResult.insertId, total, jumlah: jimpitanRows.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// ==========================================
// FITUR BARU: JADWAL & ABSENSI RONDA PEMUDA
// ==========================================
exports.getJadwalRonda = async (filters = {}) => {
  const { hari, rt } = filters;
  let query = 'SELECT * FROM jadwal_ronda WHERE 1=1';
  const params = [];
  if (hari) {
    query += ' AND hari = ?';
    params.push(hari);
  }
  if (rt) {
    query += ' AND (rt = ? OR rt IS NULL)';
    params.push(rt);
  }
  query += ` ORDER BY FIELD(hari, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'), id ASC`;
  const [rows] = await pool.query(query, params);
  return rows;
};

exports.createJadwalRonda = async (data) => {
  const { hari, rt, nama_regu, anggota, keterangan } = data;
  if (!hari || !nama_regu || !anggota) {
    throw { status: 400, message: 'Hari, nama regu, dan anggota wajib diisi!' };
  }
  const [result] = await pool.query(
    'INSERT INTO jadwal_ronda (hari, rt, nama_regu, anggota, keterangan) VALUES (?, ?, ?, ?, ?)',
    [hari, rt || null, nama_regu, anggota, keterangan || null]
  );
  return { id: result.insertId, ...data };
};

exports.updateJadwalRonda = async (id, data) => {
  const { hari, rt, nama_regu, anggota, keterangan } = data;
  const [result] = await pool.query(
    'UPDATE jadwal_ronda SET hari = ?, rt = ?, nama_regu = ?, anggota = ?, keterangan = ? WHERE id = ?',
    [hari, rt || null, nama_regu, anggota, keterangan || null, id]
  );
  if (result.affectedRows === 0) throw { status: 404, message: 'Jadwal ronda tidak ditemukan.' };
  return { id: Number(id), ...data };
};

exports.deleteJadwalRonda = async (id) => {
  const [result] = await pool.query('DELETE FROM jadwal_ronda WHERE id = ?', [id]);
  if (result.affectedRows === 0) throw { status: 404, message: 'Jadwal ronda tidak ditemukan.' };
  return { id: Number(id) };
};

exports.getAbsensiRonda = async (filters = {}) => {
  const { tanggal, rt, dari, sampai } = filters;
  let query = `
    SELECT a.*, u.nama AS nama_petugas, u.username
    FROM absensi_ronda a
    JOIN users u ON a.petugas_id = u.id
    WHERE 1=1
  `;
  const params = [];
  if (tanggal) {
    query += ' AND a.tanggal = ?';
    params.push(tanggal);
  }
  if (rt) {
    query += ' AND a.rt = ?';
    params.push(rt);
  }
  if (dari) {
    query += ' AND a.tanggal >= ?';
    params.push(dari);
  }
  if (sampai) {
    query += ' AND a.tanggal <= ?';
    params.push(sampai);
  }
  query += ' ORDER BY a.tanggal DESC, a.waktu_pertama ASC';
  const [rows] = await pool.query(query, params);
  return rows;
};

// ==========================================
// FITUR BARU: NOTIFIKASI & PESAN WHATSAPP
// ==========================================
exports.buildWhatsAppMessage = async ({ warga_id, tanggal, type = 'konfirmasi' }) => {
  const [warga] = await pool.query('SELECT * FROM warga WHERE id = ?', [warga_id]);
  if (!warga.length) throw { status: 404, message: 'Warga tidak ditemukan.' };
  const w = warga[0];

  let rawPhone = String(w.no_hp || '').trim().replace(/[^0-9]/g, '');
  if (rawPhone.startsWith('0')) {
    rawPhone = '62' + rawPhone.slice(1);
  }

  let text = '';
  if (type === 'konfirmasi') {
    const tgl = tanggal || new Date().toISOString().split('T')[0];
    const [j] = await pool.query(
      `SELECT j.*, u.nama AS petugas_nama FROM jimpitan j
       JOIN users u ON j.petugas_id = u.id
       WHERE j.warga_id = ? AND j.tanggal = ?`,
      [warga_id, tgl]
    );

    const nominal = j.length ? Number(j[0].nominal) : JIMPITAN_PER_HARI;
    const petugas = j.length ? j[0].petugas_nama : 'Petugas Ronda Karang Taruna';
    const statusLap = j.length ? j[0].status_lapangan : 'lunas';

    text = `*KONFIRMASI JIMPITAN DUSUN NGEPRINGAN*\n\n` +
      `Kepada Yth. Bpk/Ibu *${w.nama_kk}* (${w.rt}):\n` +
      `Alhamdulillah, pencatatan jimpitan tanggal *${tgl}* telah diterima oleh *${petugas}*.\n\n` +
      `• Status: *${statusLap.toUpperCase().replace('_', ' ')}*\n` +
      `• Nominal: *Rp ${nominal.toLocaleString('id-ID')}*\n` +
      `• Sisa Deposit Anda: *Rp ${Number(w.saldo_deposit || 0).toLocaleString('id-ID')}*\n\n` +
      `Maturnuwun atas partisipasi Anda dalam membangun kerukunan dan kas sosial Dusun Ngepringan. 🙏`;
  } else if (type === 'rekap') {
    const now = new Date();
    const bulan = now.getMonth() + 1;
    const tahun = now.getFullYear();
    const [sums] = await pool.query(
      `SELECT COALESCE(SUM(nominal), 0) AS total, COUNT(id) AS hari
       FROM jimpitan
       WHERE warga_id = ? AND MONTH(tanggal) = ? AND YEAR(tanggal) = ?`,
      [warga_id, bulan, tahun]
    );
    const total = Number(sums[0]?.total || 0);
    const hari = Number(sums[0]?.hari || 0);

    text = `*REKAP BULANAN JIMPITAN DUSUN NGEPRINGAN*\n\n` +
      `Kepada Yth. Bpk/Ibu *${w.nama_kk}* (${w.rt}):\n` +
      `Rekapitulasi jimpitan Anda untuk bulan *${bulan}/${tahun}*:\n\n` +
      `• Terkumpul: *Rp ${total.toLocaleString('id-ID')}* (${hari} malam)\n` +
      `• Sisa Saldo Deposit: *Rp ${Number(w.saldo_deposit || 0).toLocaleString('id-ID')}*\n\n` +
      `Semoga berkah dan senantiasa dimurahkan rezeki oleh Allah SWT. Salam hangat dari Pemuda Karang Taruna Dusun Ngepringan.`;
  }

  const waUrl = rawPhone ? `https://wa.me/${rawPhone}?text=${encodeURIComponent(text)}` : null;

  return {
    warga_id: w.id,
    nama_kk: w.nama_kk,
    no_hp: w.no_hp,
    clean_phone: rawPhone,
    type,
    message: text,
    wa_url: waUrl
  };
};

// ==========================================
// FITUR BARU: API PUBLIK CEK MANDIRI WARGA
// ==========================================
exports.cekWargaMandiri = async (keyword) => {
  if (!keyword || String(keyword).trim().length < 2) {
    throw { status: 400, message: 'Masukkan No. KK atau Nama Kepala Keluarga minimal 2 karakter.' };
  }

  const search = `%${String(keyword).trim()}%`;
  const [wargas] = await pool.query(
    `SELECT id, no_kk, nama_kk, rt, alamat, status, saldo_deposit, created_at
     FROM warga
     WHERE (no_kk LIKE ? OR nama_kk LIKE ?) AND status = 'aktif'
     ORDER BY nama_kk ASC LIMIT 10`,
    [search, search]
  );

  if (!wargas.length) {
    return { found: false, message: 'Data warga tidak ditemukan atau status tidak aktif.' };
  }

  // Jika cocok 1 warga persis atau pencarian tertarget
  const target = wargas[0];
  const [history] = await pool.query(
    `SELECT j.id, j.tanggal, j.nominal, j.status_lapangan, j.metode_bayar, j.status_setor, u.nama AS petugas
     FROM jimpitan j
     LEFT JOIN users u ON j.petugas_id = u.id
     WHERE j.warga_id = ?
     ORDER BY j.tanggal DESC
     LIMIT 30`,
    [target.id]
  );

  const [rekapBulanIni] = await pool.query(
    `SELECT
       COALESCE(SUM(nominal), 0) AS total_nominal,
       COALESCE(SUM(CASE WHEN nominal > 0 THEN jumlah_hari ELSE 0 END), 0) AS total_hari
     FROM jimpitan
     WHERE warga_id = ? AND MONTH(tanggal) = MONTH(CURRENT_DATE()) AND YEAR(tanggal) = YEAR(CURRENT_DATE())`,
    [target.id]
  );

  // Masking nomor KK untuk privasi warga (contoh: 330412******0001)
  const maskNoKK = (kk) => {
    if (!kk) return '-';
    if (kk.length <= 6) return kk;
    return kk.slice(0, 4) + '******' + kk.slice(-4);
  };

  // Ringkasan transparansi dusun bulan ini
  const [dusunSummary] = await pool.query(`
    SELECT
      COALESCE(SUM(nominal), 0) AS total_dusun_bulan_ini,
      COUNT(id) AS total_transaksi
    FROM jimpitan
    WHERE MONTH(tanggal) = MONTH(CURRENT_DATE()) AND YEAR(tanggal) = YEAR(CURRENT_DATE())
  `);

  return {
    found: true,
    total_matches: wargas.length,
    warga: {
      id: target.id,
      nama_kk: target.nama_kk,
      no_kk_masked: maskNoKK(target.no_kk),
      rt: target.rt,
      alamat: target.alamat,
      saldo_deposit: Number(target.saldo_deposit || 0),
    },
    statistik: {
      bulan_ini_nominal: Number(rekapBulanIni[0]?.total_nominal || 0),
      bulan_ini_hari: Number(rekapBulanIni[0]?.total_hari || 0),
      tarif_per_hari: JIMPITAN_PER_HARI,
    },
    transparansi_dusun: {
      total_jimpitan_bulan_ini: Number(dusunSummary[0]?.total_dusun_bulan_ini || 0),
      total_transaksi_bulan_ini: Number(dusunSummary[0]?.total_transaksi || 0)
    },
    riwayat_terakhir: history.map((h) => ({
      ...h,
      nominal: Number(h.nominal)
    }))
  };
};

// ==========================================
// FITUR BARU: ANALITIK & TREN PARTISIPASI RT
// ==========================================
exports.fetchAnalitikPartisipasi = async (filters = {}) => {
  const now = new Date();
  const bulan = Number(filters.bulan) || now.getMonth() + 1;
  const tahun = Number(filters.tahun) || now.getFullYear();

  const hariDalamBulan = new Date(tahun, bulan, 0).getDate();
  const hariIni = (now.getMonth() + 1 === bulan && now.getFullYear() === tahun) ? now.getDate() : hariDalamBulan;

  const [wargaPerRT] = await pool.query(`
    SELECT rt, COUNT(*) AS jumlah_kk,
      SUM(CASE WHEN status = 'aktif' THEN 1 ELSE 0 END) AS kk_aktif,
      COALESCE(SUM(saldo_deposit), 0) AS total_deposit
    FROM warga
    GROUP BY rt
  `);

  const [jimpitanData] = await pool.query(`
    SELECT
      rt,
      COALESCE(SUM(nominal), 0) AS total_terkumpul,
      COUNT(id) AS total_catatan,
      SUM(CASE WHEN status_lapangan = 'lunas' OR status_lapangan IS NULL THEN 1 ELSE 0 END) AS count_lunas,
      SUM(CASE WHEN status_lapangan = 'kosong_nihil' THEN 1 ELSE 0 END) AS count_kosong,
      SUM(CASE WHEN status_lapangan = 'titip_tetangga' THEN 1 ELSE 0 END) AS count_titip,
      SUM(CASE WHEN status_lapangan = 'rumah_tutup_mudik' THEN 1 ELSE 0 END) AS count_tutup
    FROM jimpitan
    WHERE MONTH(tanggal) = ? AND YEAR(tanggal) = ?
    GROUP BY rt
  `, [bulan, tahun]);

  const jimpitanMap = new Map(jimpitanData.map((d) => [d.rt, d]));

  const rtList = wargaPerRT.map((w) => {
    const jd = jimpitanMap.get(w.rt) || {};
    const kkAktif = Number(w.kk_aktif || 0);
    const targetBulan = kkAktif * JIMPITAN_PER_HARI * hariDalamBulan;
    const targetBerjalan = kkAktif * JIMPITAN_PER_HARI * hariIni;
    const terkumpul = Number(jd.total_terkumpul || 0);
    const tunggakan = Math.max(0, targetBerjalan - terkumpul);
    const kepatuhanPersen = targetBerjalan > 0 ? Math.min(100, Math.round((terkumpul / targetBerjalan) * 100)) : 0;
    const tunggakanPersen = 100 - kepatuhanPersen;

    return {
      rt: w.rt,
      kk_aktif: kkAktif,
      target_bulan: targetBulan,
      target_berjalan: targetBerjalan,
      total_terkumpul: terkumpul,
      tunggakan,
      kepatuhan_persen: kepatuhanPersen,
      tunggakan_persen: tunggakanPersen,
      count_lunas: Number(jd.count_lunas || 0),
      count_kosong: Number(jd.count_kosong || 0),
      count_titip: Number(jd.count_titip || 0),
      count_tutup: Number(jd.count_tutup || 0),
      total_deposit: Number(w.total_deposit || 0)
    };
  });

  // Urutkan berdasarkan tingkat kepatuhan tertinggi
  rtList.sort((a, b) => b.kepatuhan_persen - a.kepatuhan_persen);
  rtList.forEach((item, index) => {
    item.ranking = index + 1;
  });

  const summary = {
    total_kk_aktif: rtList.reduce((sum, r) => sum + r.kk_aktif, 0),
    total_terkumpul: rtList.reduce((sum, r) => sum + r.total_terkumpul, 0),
    total_target_berjalan: rtList.reduce((sum, r) => sum + r.target_berjalan, 0),
    total_tunggakan: rtList.reduce((sum, r) => sum + r.tunggakan, 0),
    rata_kepatuhan_persen: rtList.length
      ? Math.round(rtList.reduce((sum, r) => sum + r.kepatuhan_persen, 0) / rtList.length)
      : 0
  };

  return {
    periode: { bulan, tahun, hari_dalam_bulan: hariDalamBulan, hari_berjalan: hariIni },
    summary,
    rt_list: rtList
  };
};

// ==========================================
// FITUR: LAPORAN LEMBAR MATRIKS JIMPITAN WARGA
// Mendukung Mode Bulanan (1 - 30/31) & Mode Rentang Tanggal Bebas (Custom Date Range)
// Dilengkapi Sistem FIFO Pelunasan Utang Tertua Lintas Bulan
// ==========================================
exports.fetchMatrixRekap = async (filters = {}) => {
  const now = new Date();
  const rt = filters.rt || '';

  // Mode: Custom Range jika disediakan dari_tanggal & sampai_tanggal
  const isCustomRange = Boolean(filters.dari_tanggal && filters.sampai_tanggal);
  let startDate = '';
  let endDate = '';
  let bulan = Number(filters.bulan) || now.getMonth() + 1;
  let tahun = Number(filters.tahun) || now.getFullYear();

  if (isCustomRange) {
    startDate = String(filters.dari_tanggal).split('T')[0];
    endDate = String(filters.sampai_tanggal).split('T')[0];
  } else {
    const hariDalamBulan = new Date(tahun, bulan, 0).getDate();
    startDate = `${tahun}-${String(bulan).padStart(2, '0')}-01`;
    endDate = `${tahun}-${String(bulan).padStart(2, '0')}-${String(hariDalamBulan).padStart(2, '0')}`;
  }

  // Buat daftar hari / kolom
  const startObj = new Date(startDate + 'T00:00:00');
  const endObj = new Date(endDate + 'T00:00:00');
  const hariList = [];
  const hariListDetail = [];

  let curLoop = new Date(startObj);
  while (curLoop <= endObj) {
    const y = curLoop.getFullYear();
    const m = String(curLoop.getMonth() + 1).padStart(2, '0');
    const d = String(curLoop.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    const dayNum = curLoop.getDate();
    // Pada mode bulanan gunakan integer 1..31 untuk backward compatibility tampilan
    const key = isCustomRange ? dateStr : dayNum;

    hariList.push(key);
    hariListDetail.push({
      key,
      dayNum,
      dateStr,
      label: isCustomRange ? `${dayNum}/${curLoop.getMonth() + 1}` : String(dayNum)
    });

    curLoop.setDate(curLoop.getDate() + 1);
  }

  // Ambil data seluruh KK aktif di wilayah RT
  let wargaQuery = `
    SELECT id, no_kk, nama_kk, rt, alamat
    FROM warga
    WHERE status = 'aktif'
  `;
  const wargaParams = [];
  if (rt) {
    wargaQuery += ' AND rt = ?';
    wargaParams.push(rt);
  }
  wargaQuery += ' ORDER BY nama_kk ASC';
  const [wargas] = await pool.query(wargaQuery, wargaParams);

  // Ambil data riwayat tanggal awal dan total bayar sebelum startDate
  // untuk menghitung sisa tunggakan bulan-bulan sebelumnya (tunggakan lalu)
  let priorQuery = `
    SELECT warga_id, MIN(tanggal) AS tanggal_awal, COALESCE(SUM(nominal), 0) AS total_bayar_sebelum
    FROM jimpitan
    WHERE tanggal < ?
  `;
  const priorParams = [startDate];
  if (rt) {
    priorQuery += ' AND rt = ?';
    priorParams.push(rt);
  }
  priorQuery += ' GROUP BY warga_id';
  const [priorRows] = await pool.query(priorQuery, priorParams);
  const priorMap = new Map(priorRows.map((r) => [r.warga_id, r]));

  // Ambil seluruh pembayaran jimpitan yang relevan (dalam rentang tanggal ini, atau setelahnya yang melunasi periode ini)
  let jimpitanQuery = `
    SELECT warga_id, rt, tanggal, DAY(tanggal) AS hari, nominal, jumlah_hari, status_lapangan, metode_bayar
    FROM jimpitan
    WHERE (
      (tanggal >= ? AND tanggal <= ?)
      OR
      (tanggal > ? AND tanggal <= DATE_ADD(?, INTERVAL 90 DAY) AND jumlah_hari > 1)
      OR
      (tanggal < ? AND tanggal >= DATE_SUB(?, INTERVAL 90 DAY) AND jumlah_hari > 1)
    )
  `;
  const jimpitanParams = [startDate, endDate, endDate, endDate, startDate, startDate];
  if (rt) {
    jimpitanQuery += ' AND rt = ?';
    jimpitanParams.push(rt);
  }
  jimpitanQuery += ' ORDER BY tanggal ASC';
  const [jimpitans] = await pool.query(jimpitanQuery, jimpitanParams);

  // Group pembayaran per warga
  const paymentsByWarga = new Map();
  jimpitans.forEach((j) => {
    if (!paymentsByWarga.has(j.warga_id)) {
      paymentsByWarga.set(j.warga_id, []);
    }
    paymentsByWarga.get(j.warga_id).push({
      ...j,
      tanggal: formatDateSql(j.tanggal)
    });
  });

  const dailyTotals = {};
  hariList.forEach((k) => (dailyTotals[k] = 0));
  let grandTotal = 0;

  const namaBulanIndo = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const rows = wargas.map((w, index) => {
    const pList = paymentsByWarga.get(w.id) || [];
    const days = {};
    hariList.forEach((k) => {
      days[k] = { paid: false, symbol: '', nominal: 0, status: null };
    });

    // 1. Hitung tunggakan sebelum startDate (tunggakan lalu)
    const prior = priorMap.get(w.id);
    let tunggakanLaluHari = 0;
    let tunggakanLaluNominal = 0;

    if (prior && prior.tanggal_awal) {
      const tAwal = prior.tanggal_awal instanceof Date
        ? prior.tanggal_awal.toISOString().split('T')[0]
        : String(prior.tanggal_awal).split('T')[0];

      if (tAwal < startDate) {
        const daysBefore = Math.max(0, Math.floor((new Date(`${startDate}T00:00:00`) - new Date(`${tAwal}T00:00:00`)) / 86400000));
        const wajibSebelum = daysBefore * JIMPITAN_PER_HARI;
        const bayarSebelum = Number(prior.total_bayar_sebelum || 0);
        tunggakanLaluNominal = Math.max(0, wajibSebelum - bayarSebelum);
        tunggakanLaluHari = Math.ceil(tunggakanLaluNominal / JIMPITAN_PER_HARI);
      }
    }

    // 2. Tandai status non-lunas (kosong_nihil, rumah_tutup_mudik) pada tanggal kunjungan
    pList
      .filter((p) => p.status_lapangan === 'kosong_nihil' || p.status_lapangan === 'rumah_tutup_mudik')
      .forEach((p) => {
        const pDateStr = p.tanggal;
        const dayNum = parseInt(pDateStr.split('-')[2], 10);
        const key = isCustomRange ? pDateStr : dayNum;
        if (days[key]) {
          days[key] = {
            paid: false,
            symbol: p.status_lapangan === 'kosong_nihil' ? '○' : 'T',
            nominal: 0,
            status: p.status_lapangan
          };
        }
      });

    // 3. Alokasikan pembayaran lunas secara FIFO (Pelunasan Utang Tertua Terlebih Dahulu Lintas Bulan)
    const lunasList = pList
      .filter((p) => p.status_lapangan === 'lunas' || p.status_lapangan === 'titip_tetangga' || (!p.status_lapangan && Number(p.nominal) > 0))
      .sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

    lunasList.forEach((p) => {
      let toAllocate = p.jumlah_hari || Math.max(1, Math.round(Number(p.nominal) / JIMPITAN_PER_HARI));
      const pDateStr = p.tanggal;

      // PRINSIP FIFO LINTAS BULAN:
      // Jika warga masih memiliki sisa tunggakan dari sebelum periode ini (tunggakanLaluHari > 0),
      // maka pembayaran ini pertama kali harus melunasi sisa tunggakan lama tersebut!
      if (tunggakanLaluHari > 0) {
        const payPrior = Math.min(toAllocate, tunggakanLaluHari);
        tunggakanLaluHari -= payPrior;
        tunggakanLaluNominal = tunggakanLaluHari * JIMPITAN_PER_HARI;
        toAllocate -= payPrior;
      }

      if (toAllocate <= 0) return;

      // Tahap A: Lunasi utang tertua dalam rentang hari yang ditampilkan, s/d tanggal pembayaran pDate
      for (const h of hariListDetail) {
        if (toAllocate <= 0) break;

        // Jangan melompati tanggal pembayaran jika pembayaran terjadi di dalam periode ini
        if (h.dateStr > pDateStr) {
          break;
        }

        if (!days[h.key].paid) {
          days[h.key] = {
            paid: true,
            symbol: '✓',
            nominal: JIMPITAN_PER_HARI,
            status: p.status_lapangan || 'lunas'
          };
          toAllocate--;
        }
      }

      // Tahap B: Jika utang s/d tanggal pembayaran sudah lunas semua dan masih ada toAllocate,
      // alokasikan ke hari-hari setelah tanggal pembayaran (pembayaran di muka / advance)
      if (toAllocate > 0) {
        for (const h of hariListDetail) {
          if (toAllocate <= 0) break;
          if (!days[h.key].paid) {
            days[h.key] = {
              paid: true,
              symbol: '✓',
              nominal: JIMPITAN_PER_HARI,
              status: p.status_lapangan || 'lunas'
            };
            toAllocate--;
          }
        }
      }
    });

    // Hitung total warga pada periode ini
    let totalNominalWarga = 0;
    let totalHariWarga = 0;
    hariList.forEach((k) => {
      if (days[k].paid) {
        totalNominalWarga += JIMPITAN_PER_HARI;
        totalHariWarga += 1;
        dailyTotals[k] += JIMPITAN_PER_HARI;
        grandTotal += JIMPITAN_PER_HARI;
      }
    });

    return {
      no: index + 1,
      id: w.id,
      nama_kk: w.nama_kk.toUpperCase(),
      no_kk: w.no_kk,
      rt: w.rt,
      alamat: w.alamat,
      tunggakan_lalu_hari: tunggakanLaluHari,
      tunggakan_lalu_nominal: tunggakanLaluNominal,
      days,
      total_nominal: totalNominalWarga,
      total_hari: totalHariWarga
    };
  });

  const headerPeriode = isCustomRange
    ? `${startDate} s/d ${endDate}`
    : `${namaBulanIndo[bulan - 1]?.toUpperCase()} ${tahun}`;

  return {
    mode: isCustomRange ? 'rentang' : 'bulanan',
    is_custom_range: isCustomRange,
    header: {
      judul: `DAFTAR JIMPITAN WARGA ${rt ? rt.toUpperCase() : 'SEMUA RT'}`,
      wilayah: `DUSUN NGEPRINGAN`,
      periode: headerPeriode,
      rt: rt || 'Semua RT',
      bulan,
      tahun,
      start_date: startDate,
      end_date: endDate,
      tarif_per_hari: JIMPITAN_PER_HARI
    },
    hari_list: hariList,
    hari_list_detail: hariListDetail,
    daily_totals: dailyTotals,
    grand_total: grandTotal,
    total_warga: wargas.length,
    rows
  };
};

exports.JIMPITAN_PER_HARI = JIMPITAN_PER_HARI;
