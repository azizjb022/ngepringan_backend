const jimpitanService = require('../services/jimpitanService');

const isPetugas = (req) => req.user?.role === 'petugas_rt';
const petugasRT = (req) => req.user?.rt;

exports.getKonstanta = async (req, res) => {
  return res.status(200).json({ success: true, data: jimpitanService.getKonstanta() });
};

exports.getJimpitan = async (req, res) => {
  try {
    const filters = { ...req.query };

    // Petugas RT otomatis dibatasi ke RT-nya sendiri
    if (isPetugas(req)) {
      if (!petugasRT(req)) {
        return res.status(400).json({ success: false, message: 'Akun petugas belum memiliki RT.' });
      }
      filters.rt = petugasRT(req);
    }

    const data = await jimpitanService.fetchJimpitan(filters);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRekap = async (req, res) => {
  try {
    const result = await jimpitanService.fetchRekapPerRT(req.query);

    if (isPetugas(req)) {
      result.data = result.data.filter((r) => r.rt === petugasRT(req));
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getProgress = async (req, res) => {
  try {
    const rt = isPetugas(req) ? petugasRT(req) : req.query.rt;
    const data = await jimpitanService.fetchProgress({
      rt,
      tanggal: req.query.tanggal,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.createJimpitan = async (req, res) => {
  try {
    const {
      warga_id,
      tanggal,
      jumlah_hari,
      status_lapangan = 'lunas',
      catatan_lapangan,
      metode_bayar = 'tunai',
    } = req.body;

    if (!warga_id || !tanggal) {
      return res.status(400).json({ success: false, message: 'Warga dan tanggal wajib diisi!' });
    }

    const bukti_foto = req.file ? `uploads/${req.file.filename}` : null;
    const result = await jimpitanService.insertJimpitan({
      warga_id,
      tanggal,
      jumlah_hari,
      status_lapangan,
      catatan_lapangan,
      metode_bayar,
      petugas_id: req.user.id,
      created_by: req.user.id,
      updated_by: req.user.id,
      bukti_foto,
      allowed_rt: isPetugas(req) ? petugasRT(req) : null,
    });

    return res.status(201).json({
      success: true,
      message: `Jimpitan ${result.rt} berhasil dicatat (${result.status_lapangan}, Rp ${Number(result.nominal).toLocaleString('id-ID')}).`,
      data: result,
    });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.updateJimpitan = async (req, res) => {
  try {
    const { warga_id, tanggal, jumlah_hari, status_lapangan, catatan_lapangan } = req.body;
    if (!warga_id || !tanggal) return res.status(400).json({ success: false, message: 'Warga dan tanggal wajib diisi!' });
    const result = await jimpitanService.updateJimpitan(req.params.id, {
      warga_id,
      tanggal,
      jumlah_hari,
      status_lapangan,
      catatan_lapangan,
      updated_by: req.user.id,
      allowed_rt: isPetugas(req) ? petugasRT(req) : null,
    });
    return res.status(200).json({ success: true, message: 'Data jimpitan berhasil diubah.', data: result });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.topupDeposit = async (req, res) => {
  try {
    const { warga_id, nominal, keterangan } = req.body;
    if (!warga_id || !nominal) {
      return res.status(400).json({ success: false, message: 'Warga ID dan nominal topup wajib diisi!' });
    }
    const result = await jimpitanService.topupDeposit({
      warga_id,
      nominal,
      keterangan,
      user_id: req.user.id
    });
    return res.status(200).json({
      success: true,
      message: `Deposit untuk ${result.nama_kk} berhasil ditambahkan sebesar Rp ${Number(result.nominal_topup).toLocaleString('id-ID')}.`,
      data: result
    });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.autoDeductDeposit = async (req, res) => {
  try {
    const { rt: requestedRt, tanggal } = req.body;
    const rt = isPetugas(req) ? petugasRT(req) : requestedRt;
    const result = await jimpitanService.autoDeductDeposit({
      rt,
      tanggal: tanggal || new Date().toISOString().split('T')[0],
      petugas_id: req.user.id
    });
    return res.status(200).json({
      success: true,
      message: `${result.total_diproses} warga yang memiliki saldo deposit otomatis dipotong untuk tanggal ${result.tanggal}.`,
      data: result
    });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.getPendingSetor = async (req, res) => {
  try {
    const rt = isPetugas(req) ? petugasRT(req) : req.query.rt;
    const data = await jimpitanService.fetchPendingSetor({ rt });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.setorKeBendahara = async (req, res) => {
  try {
    const { rt: requestedRt, dari, sampai } = req.body;
    const rt = isPetugas(req) ? petugasRT(req) : requestedRt;
    if (!rt) {
      return res.status(400).json({ success: false, message: 'RT wajib dipilih!' });
    }
    const result = await jimpitanService.processSetorPerRT(rt, dari, sampai, req.user.id);
    return res.status(200).json({
      success: true,
      message: `Setoran ${rt} diajukan untuk validasi bendahara (Rp ${Number(result.total).toLocaleString('id-ID')}).`,
      data: result,
    });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.getSetoranMenunggu = async (req, res) => {
  try {
    const data = await jimpitanService.fetchSetoranMenunggu();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.terimaSetoran = async (req, res) => {
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

// ==========================================
// CONTROLLER: JADWAL & ABSENSI RONDA
// ==========================================
exports.getJadwalRonda = async (req, res) => {
  try {
    const data = await jimpitanService.getJadwalRonda(req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createJadwalRonda = async (req, res) => {
  try {
    const data = await jimpitanService.createJadwalRonda(req.body);
    return res.status(201).json({ success: true, message: 'Jadwal ronda berhasil ditambahkan.', data });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.updateJadwalRonda = async (req, res) => {
  try {
    const data = await jimpitanService.updateJadwalRonda(req.params.id, req.body);
    return res.status(200).json({ success: true, message: 'Jadwal ronda berhasil diperbarui.', data });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.deleteJadwalRonda = async (req, res) => {
  try {
    await jimpitanService.deleteJadwalRonda(req.params.id);
    return res.status(200).json({ success: true, message: 'Jadwal ronda berhasil dihapus.' });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.getAbsensiRonda = async (req, res) => {
  try {
    const data = await jimpitanService.getAbsensiRonda(req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// CONTROLLER: WHATSAPP NOTIFIKASI
// ==========================================
exports.getWhatsAppTemplate = async (req, res) => {
  try {
    const { warga_id, tanggal, type } = req.query;
    if (!warga_id) return res.status(400).json({ success: false, message: 'Warga ID wajib diisi.' });
    const data = await jimpitanService.buildWhatsAppMessage({ warga_id, tanggal, type });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

// ==========================================
// CONTROLLER: API PUBLIK CEK WARGA MANDIRI
// ==========================================
exports.cekWargaMandiri = async (req, res) => {
  try {
    const { keyword } = req.query;
    const data = await jimpitanService.cekWargaMandiri(keyword);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

// ==========================================
// CONTROLLER: ANALITIK & TREN PARTISIPASI RT
// ==========================================
exports.getAnalitikPartisipasi = async (req, res) => {
  try {
    const data = await jimpitanService.fetchAnalitikPartisipasi(req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// CONTROLLER: LAPORAN LEMBAR MATRIKS JIMPITAN WARGA
// ==========================================
exports.getMatrixRekap = async (req, res) => {
  try {
    const rt = isPetugas(req) ? petugasRT(req) : req.query.rt;
    const data = await jimpitanService.fetchMatrixRekap({
      ...req.query,
      rt,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
