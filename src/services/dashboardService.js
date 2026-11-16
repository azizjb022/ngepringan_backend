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

exports.getAnalyticsData = async () => {
  const [keuanganBulanan] = await pool.query(`
    SELECT DATE_FORMAT(tanggal, '%Y-%m') AS periode,
      COALESCE(SUM(CASE WHEN jenis = 'masuk' THEN nominal ELSE 0 END), 0) AS masuk,
      COALESCE(SUM(CASE WHEN jenis = 'keluar' THEN nominal ELSE 0 END), 0) AS keluar
    FROM transaksi_keuangan
    WHERE tanggal >= DATE_FORMAT(DATE_SUB(CURRENT_DATE(), INTERVAL 5 MONTH), '%Y-%m-01')
    GROUP BY DATE_FORMAT(tanggal, '%Y-%m')
    ORDER BY periode ASC
  `);
  const [jimpitanBulanan] = await pool.query(`
    SELECT DATE_FORMAT(tanggal, '%Y-%m') AS periode,
      COALESCE(SUM(nominal), 0) AS total, COUNT(id) AS transaksi
    FROM jimpitan
    WHERE tanggal >= DATE_FORMAT(DATE_SUB(CURRENT_DATE(), INTERVAL 5 MONTH), '%Y-%m-01')
    GROUP BY DATE_FORMAT(tanggal, '%Y-%m')
    ORDER BY periode ASC
  `);
  const [warga] = await pool.query(`
    SELECT COUNT(*) AS total, SUM(status = 'aktif') AS aktif,
      COUNT(DISTINCT rt) AS jumlah_rt
    FROM warga
  `);
  const [pendingSetoran] = await pool.query(`
    SELECT COUNT(*) AS jumlah, COALESCE(SUM(total_nominal), 0) AS nominal
    FROM setoran_jimpitan WHERE status = 'menunggu_validasi'
  `);
  const [rtBulanIni] = await pool.query(`
    SELECT rt, COALESCE(SUM(nominal), 0) AS total, COUNT(id) AS transaksi
    FROM jimpitan
    WHERE MONTH(tanggal) = MONTH(CURRENT_DATE()) AND YEAR(tanggal) = YEAR(CURRENT_DATE())
    GROUP BY rt ORDER BY total DESC
  `);

  return {
    keuangan_bulanan: keuanganBulanan.map((row) => ({ ...row, masuk: Number(row.masuk), keluar: Number(row.keluar) })),
    jimpitan_bulanan: jimpitanBulanan.map((row) => ({ ...row, total: Number(row.total), transaksi: Number(row.transaksi) })),
    warga: { total: Number(warga[0]?.total || 0), aktif: Number(warga[0]?.aktif || 0), jumlah_rt: Number(warga[0]?.jumlah_rt || 0) },
    setoran_menunggu: { jumlah: Number(pendingSetoran[0]?.jumlah || 0), nominal: Number(pendingSetoran[0]?.nominal || 0) },
    jimpitan_rt_bulan_ini: rtBulanIni.map((row) => ({ ...row, total: Number(row.total), transaksi: Number(row.transaksi) })),
  };
};
