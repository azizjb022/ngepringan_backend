const express = require('express');
const router = express.Router();
const jimpitanController = require('../controllers/jimpitanController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// 1. Endpoint Publik Transparansi Warga (Tanpa Token)
router.get('/public/cek-warga', jimpitanController.cekWargaMandiri);

// 2. Endpoint Master & Rekap (Dengan Token)
router.get('/konstanta', verifyToken, jimpitanController.getKonstanta);
router.get('/rekap', verifyToken, jimpitanController.getRekap);
router.get('/progress', verifyToken, jimpitanController.getProgress);
router.get('/analitik-partisipasi', verifyToken, jimpitanController.getAnalitikPartisipasi);
router.get('/matrix-rekap', verifyToken, jimpitanController.getMatrixRekap);
router.get('/pending-setor', verifyToken, jimpitanController.getPendingSetor);
router.get('/setoran-menunggu', verifyToken, authorizeRoles('superadmin', 'bendahara'), jimpitanController.getSetoranMenunggu);

// 3. Jadwal & Absensi Ronda
router.get('/jadwal-ronda', verifyToken, jimpitanController.getJadwalRonda);
router.post('/jadwal-ronda', verifyToken, authorizeRoles('superadmin', 'ketua', 'sekretaris'), jimpitanController.createJadwalRonda);
router.put('/jadwal-ronda/:id', verifyToken, authorizeRoles('superadmin', 'ketua', 'sekretaris'), jimpitanController.updateJadwalRonda);
router.delete('/jadwal-ronda/:id', verifyToken, authorizeRoles('superadmin', 'ketua', 'sekretaris'), jimpitanController.deleteJadwalRonda);
router.get('/absensi-ronda', verifyToken, jimpitanController.getAbsensiRonda);

// 4. Deposit & WhatsApp
router.post('/deposit', verifyToken, jimpitanController.topupDeposit);
router.post('/auto-deduct-deposit', verifyToken, jimpitanController.autoDeductDeposit);
router.get('/notif-wa', verifyToken, jimpitanController.getWhatsAppTemplate);

// 5. Pencatatan Jimpitan Pokok
router.get('/', verifyToken, jimpitanController.getJimpitan);
router.post(
  '/',
  verifyToken,
  upload.single('bukti_foto'),
  jimpitanController.createJimpitan
);
router.put('/:id', verifyToken, upload.single('bukti_foto'), jimpitanController.updateJimpitan);

// 6. Setor jimpitan pending satu RT ke kas umum
router.post(
  '/setor',
  verifyToken,
  authorizeRoles('superadmin', 'bendahara', 'petugas_rt'),
  jimpitanController.setorKeBendahara
);

module.exports = router;
