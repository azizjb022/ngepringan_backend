let app;
let initError = null;

try {
  app = require('../src/app');
} catch (err) {
  initError = err;
  console.error('Fatal initialization error:', err);
}

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  if (initError || !app) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        success: false,
        message: 'Gagal menginisialisasi server backend.',
        error: initError?.message || 'Aplikasi tidak dapat dimuat.',
      })
    );
  }

  return app(req, res);
};
