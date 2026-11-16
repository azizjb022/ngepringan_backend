const express = require('express');
const router = express.Router();
const keuanganController = require('../controllers/keuanganController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware'); // <-- tanpa tanda kurung kurawal

router.get('/kategori', verifyToken, keuanganController.getKategori);
router.get('/transaksi', verifyToken, keuanganController.getTransaksi);
router.get('/laporan', verifyToken, keuanganController.getLaporan);
router.get('/setoran-jimpitan', verifyToken, authorizeRoles('superadmin', 'bendahara'), keuanganController.getSetoranJimpitan);
router.post('/setoran-jimpitan/terima', verifyToken, authorizeRoles('superadmin', 'bendahara'), keuanganController.terimaGrupSetoranJimpitan);
router.post('/setoran-jimpitan/:id/terima', verifyToken, authorizeRoles('superadmin', 'bendahara'), keuanganController.terimaSetoranJimpitan);
router.post(
  '/transaksi',
  verifyToken,
  authorizeRoles('superadmin', 'bendahara'),
  upload.single('bukti_nota'),
  keuanganController.createTransaksi
);

module.exports = router;
