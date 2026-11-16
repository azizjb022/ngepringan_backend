const pool = require('../config/database');

exports.getSummaryData = async () => {
  const [kasSummary] = await pool.query(`
    SELECT 
      COALESCE(SUM(CASE WHEN jenis = 'masuk' THEN nominal ELSE 0 END), 0) AS total_masuk,
      COALESCE(SUM(CASE WHEN jenis = 'keluar' THEN nominal ELSE 0 END), 0) AS total_keluar
    FROM transaksi_keuangan
  `);

  const totalMasuk = parseFloat(kasSummary[0].total_masuk);
  const totalKeluar = parseFloat(kasSummary[0].total_keluar);
  const saldoKas = totalMasuk - totalKeluar;

  const [jimpitanPerRT] = await pool.query(`
    SELECT 
      rt, 
      COALESCE(SUM(nominal), 0) AS total_jimpitan,
      COUNT(id) AS jumlah_penarikan
    FROM jimpitan
    WHERE MONTH(tanggal) = MONTH(CURRENT_DATE()) AND YEAR(tanggal) = YEAR(CURRENT_DATE())
    GROUP BY rt
    ORDER BY rt ASC
  `);

  const [rapatMendatang] = await pool.query(`
    SELECT id, judul_rapat, deskripsi, tanggal_waktu, lokasi 
    FROM jadwal_rapat 
    WHERE tanggal_waktu >= NOW() AND status = 'akan_datang'
    ORDER BY tanggal_waktu ASC 
    LIMIT 1
  `);

  const [transaksiTerbaru] = await pool.query(`
    SELECT t.id, t.tanggal, t.jenis, t.nominal, t.keterangan, k.nama_kategori
    FROM transaksi_keuangan t
    JOIN kategori_keuangan k ON t.kategori_id = k.id
    ORDER BY t.tanggal DESC, t.id DESC
    LIMIT 5
  `);

  return {
    keuangan: { saldo: saldoKas, total_masuk: totalMasuk, total_keluar: totalKeluar },
    jimpitan_bulan_ini: jimpitanPerRT,
    rapat_berikutnya: rapatMendatang[0] || null,
    transaksi_terbaru: transaksiTerbaru
  };
};

exports.fetchKategori = async () => {
  const [rows] = await pool.query(
    'SELECT * FROM kategori_keuangan ORDER BY id ASC'
  );
  return rows;
};

exports.fetchTransaksi = async (filters = {}) => {
  const { jenis, kategori_id, dari, sampai } = filters;
  let query = `
    SELECT t.*, k.nama_kategori, u.nama AS dicatat_oleh
    FROM transaksi_keuangan t
    JOIN kategori_keuangan k ON t.kategori_id = k.id
    LEFT JOIN users u ON t.created_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (jenis) {
    query += ' AND t.jenis = ?';
    params.push(jenis);
  }
  if (kategori_id) {
    query += ' AND t.kategori_id = ?';
    params.push(kategori_id);
  }
  if (dari) {
    query += ' AND t.tanggal >= ?';
    params.push(dari);
  }
  if (sampai) {
    query += ' AND t.tanggal <= ?';
    params.push(sampai);
  }

  query += ' ORDER BY t.tanggal DESC, t.id DESC';
  const [rows] = await pool.query(query, params);
  return rows;
};

exports.insertTransaksi = async (data) => {
  const { tanggal, kategori_id, jenis, nominal, keterangan, bukti_nota, created_by } = data;
  const [result] = await pool.query(
    `INSERT INTO transaksi_keuangan
       (tanggal, kategori_id, jenis, nominal, keterangan, bukti_nota, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tanggal, kategori_id, jenis, nominal, keterangan, bukti_nota || null, created_by]
  );
  return result.insertId;
};