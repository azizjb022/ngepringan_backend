const express = require('express');
const router = express.Router();
const rapatController = require('../controllers/rapatController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// Ambil daftar rapat
router.get('/', verifyToken, rapatController.getRapat);

// Buat agenda rapat baru (Sekretaris, Ketua, Admin)
router.post(
  '/',
  verifyToken,
  authorizeRoles('superadmin', 'ketua', 'sekretaris'),
  rapatController.createRapat
);

// Detail rapat, notulensi, dan presensi
router.get('/:id', verifyToken, rapatController.getDetailRapat);

// Absensi rapat
router.post('/:id/presensi', verifyToken, rapatController.absenRapat);

// Simpan notulensi + dokumentasi foto (maksimal 5 file)
router.post(
  '/:id/notulensi',
  verifyToken,
  authorizeRoles('superadmin', 'sekretaris'),
  upload.array('dokumentasi_foto', 5),
  rapatController.simpanNotulensi
);

module.exports = router;