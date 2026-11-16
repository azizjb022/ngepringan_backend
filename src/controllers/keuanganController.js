const keuanganService = require('../services/keuanganService');
const jimpitanService = require('../services/jimpitanService');

exports.getSetoranJimpitan = async (req, res) => {
  try {
    const data = await jimpitanService.fetchSetoranMenunggu();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.terimaSetoranJimpitan = async (req, res) => {
  try {
    const result = await jimpitanService.terimaSetoran(req.params.id, req.user.id);
    return res.status(200).json({
      success: true,
      message: `Setoran diterima dan masuk kas (Rp ${Number(result.total).toLocaleString('id-ID')}).`,
      data: result,
    });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.terimaGrupSetoranJimpitan = async (req, res) => {
  try {
    const result = await jimpitanService.terimaSetoranGrup(req.body.setoran_ids, req.user.id);
    return res.status(200).json({ success: true, message: `Setoran diterima dan masuk kas (Rp ${Number(result.total).toLocaleString('id-ID')}).`, data: result });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.getKategori = async (req, res) => {
  try {
    const data = await keuanganService.fetchKategori();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTransaksi = async (req, res) => {
  try {
    const data = await keuanganService.fetchTransaksi(req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createTransaksi = async (req, res) => {
  try {
    const { tanggal, kategori_id, jenis, nominal, keterangan } = req.body;
    if (!tanggal || !kategori_id || !jenis || !nominal || !keterangan) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi!' });
    }
    const bukti_nota = req.file ? `uploads/${req.file.filename}` : null;
    const insertId = await keuanganService.insertTransaksi({
      tanggal, kategori_id, jenis, nominal, keterangan, bukti_nota, created_by: req.user.id
    });
    return res.status(201).json({ success: true, message: 'Transaksi berhasil disimpan!', data: { id: insertId } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLaporan = async (req, res) => {
  try {
    const transaksi = await keuanganService.fetchTransaksi(req.query);
    const ringkasan = transaksi.reduce((result, row) => {
      const nominal = Number(row.nominal || 0);
      if (row.jenis === 'masuk') result.total_masuk += nominal;
      else result.total_keluar += nominal;
      const key = row.nama_kategori || 'Tanpa kategori';
      if (!result.per_kategori[key]) result.per_kategori[key] = { masuk: 0, keluar: 0 };
      result.per_kategori[key][row.jenis] += nominal;
      return result;
    }, { total_masuk: 0, total_keluar: 0, per_kategori: {} });
    return res.status(200).json({
      success: true,
      data: { transaksi, ringkasan: { ...ringkasan, saldo: ringkasan.total_masuk - ringkasan.total_keluar } },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
