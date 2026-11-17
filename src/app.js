const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const keuanganRoutes = require('./routes/keuanganRoutes');
const jimpitanRoutes = require('./routes/jimpitanRoutes');
const rapatRoutes = require('./routes/rapatRoutes');
const wargaRoutes = require('./routes/wargaRoutes');

const app = express();

// 1. Prioritas Utama: Header CORS & penanganan langsung preflight OPTIONS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Static folder untuk file upload
const uploadsPath = process.env.VERCEL
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));

// Routes: Mendukung /api/xxx maupun /xxx untuk kompatibilitas Vercel Serverless
app.use(['/api/auth', '/auth'], authRoutes);
app.use(['/api/dashboard', '/dashboard'], dashboardRoutes);
app.use(['/api/keuangan', '/keuangan'], keuanganRoutes);
app.use(['/api/jimpitan', '/jimpitan'], jimpitanRoutes);
app.use(['/api/rapat', '/rapat'], rapatRoutes);
app.use(['/api/warga', '/warga'], wargaRoutes);

app.get(['/', '/api'], (req, res) => {
  res.json({ message: 'API Karang Taruna Dusun Ngepringan Berjalan!', status: 'online' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Terjadi kesalahan pada server.',
  });
});

module.exports = app;