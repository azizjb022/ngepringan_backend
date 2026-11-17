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

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
}));

app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static folder untuk file upload
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/keuangan', keuanganRoutes);
app.use('/api/jimpitan', jimpitanRoutes);
app.use('/api/rapat', rapatRoutes);
app.use('/api/warga', wargaRoutes);

app.get('/', (req, res) => {
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