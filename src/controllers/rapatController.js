const rapatService = require('../services/rapatService');

exports.getRapat = async (req, res) => {
  try {
    const data = await rapatService.fetchJadwalRapat();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createRapat = async (req, res) => {
  try {
    const { judul_rapat, deskripsi, tanggal_waktu, lokasi } = req.body;
    if (!judul_rapat || !tanggal_waktu || !lokasi) {
      return res.status(400).json({ success: false, message: 'Judul, tanggal/waktu, dan lokasi wajib diisi!' });
    }
    const insertId = await rapatService.insertJadwalRapat({
      judul_rapat, deskripsi, tanggal_waktu, lokasi, created_by: req.user.id
    });
    return res.status(201).json({ success: true, message: 'Jadwal rapat berhasil dibuat!', data: { id: insertId } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDetailRapat = async (req, res) => {
  try {
    const data = await rapatService.getDetailRapatNotulensi(req.params.id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.simpanNotulensi = async (req, res) => {
  try {
    const { isi_notulensi, keputusan } = req.body;
    if (!isi_notulensi) {
      return res.status(400).json({ success: false, message: 'Isi notulensi tidak boleh kosong!' });
    }
    const dokumentasi_foto = req.files ? req.files.map(f => `uploads/${f.filename}`) : [];
    await rapatService.saveNotulensi({
      rapat_id: req.params.id,
      isi_notulensi,
      keputusan,
      dokumentasi_foto,
      created_by: req.user.id
    });
    return res.status(200).json({ success: true, message: 'Notulensi rapat berhasil disimpan!' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.absenRapat = async (req, res) => {
  try {
    const { keterangan, catatan } = req.body;
    await rapatService.submitPresensi(req.params.id, req.user.id, keterangan, catatan);
    return res.status(200).json({ success: true, message: 'Presensi berhasil dicatat!' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};