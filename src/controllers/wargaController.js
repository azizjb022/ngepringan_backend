const wargaService = require('../services/wargaService');

const isPetugas = (req) => req.user?.role === 'petugas_rt';
const petugasRT = (req) => req.user?.rt;

exports.getWarga = async (req, res) => {
  try {
    const filters = { ...req.query };

    // Petugas RT hanya dapat melihat warga di RT-nya sendiri
    if (isPetugas(req)) {
      if (!petugasRT(req)) {
        return res.status(400).json({ success: false, message: 'Akun petugas belum memiliki RT.' });
      }
      filters.rt = petugasRT(req);
    }

    const data = await wargaService.fetchWarga(filters);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRekap = async (req, res) => {
  try {
    let data = await wargaService.getRekapRT();
    if (isPetugas(req)) {
      data = data.filter((r) => r.rt === petugasRT(req));
    }
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDetailWarga = async (req, res) => {
  try {
    const data = await wargaService.getWargaById(req.params.id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.createWarga = async (req, res) => {
  try {
    const data = { ...req.body };
    if (isPetugas(req)) {
      data.rt = petugasRT(req);
    }
    data.created_by = req.user.id;
    data.updated_by = req.user.id;

    const { nama_kk, rt } = data;
    if (!nama_kk || !rt) {
      return res.status(400).json({ success: false, message: 'Nama Kepala Keluarga dan RT wajib diisi!' });
    }
    const insertId = await wargaService.insertWarga(data);
    return res.status(201).json({ success: true, message: 'Data warga berhasil disimpan!', data: { id: insertId } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateWarga = async (req, res) => {
  try {
    const data = { ...req.body };
    if (isPetugas(req)) {
      data.rt = petugasRT(req);
    }
    data.updated_by = req.user.id;

    const { nama_kk, rt } = data;
    if (!nama_kk || !rt) {
      return res.status(400).json({ success: false, message: 'Nama Kepala Keluarga dan RT wajib diisi!' });
    }
    await wargaService.updateWarga(req.params.id, data);
    return res.status(200).json({ success: true, message: 'Data warga berhasil diperbarui!' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteWarga = async (req, res) => {
  try {
    await wargaService.deleteWarga(req.params.id);
    return res.status(200).json({ success: true, message: 'Data warga berhasil dihapus!' });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};
