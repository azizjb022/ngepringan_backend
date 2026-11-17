const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.split(' ')[1] 
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Akses ditolak! Token tidak ditemukan.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ngepringan_super_secret_key_2026_jwt');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token tidak valid atau sudah kedaluwarsa.'
    });
  }
};

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak! Anda tidak memiliki izin untuk tindakan ini.'
      });
    }
    next();
  };
};

module.exports = { verifyToken, authorizeRoles }; // Wajib diekspor seperti ini