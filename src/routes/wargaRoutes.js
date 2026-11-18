const express = require('express');
const router = express.Router();
const wargaController = require('../controllers/wargaController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

const canManage = authorizeRoles('superadmin', 'ketua', 'sekretaris', 'bendahara', 'petugas_rt');

// Semua user terautentikasi boleh melihat data warga
router.get('/', verifyToken, wargaController.getWarga);
router.get('/rekap', verifyToken, wargaController.getRekap);
router.get('/:id', verifyToken, wargaController.getDetailWarga);

// Hanya pengurus tertentu yang boleh mengubah data warga
router.post('/seed-rt03', verifyToken, authorizeRoles('superadmin'), wargaController.seedRt03AndPetugas);
router.post('/', verifyToken, canManage, wargaController.createWarga);
router.put('/:id', verifyToken, canManage, wargaController.updateWarga);
router.delete('/:id', verifyToken, canManage, wargaController.deleteWarga);

module.exports = router;
