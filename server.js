require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Server aktif di: http://localhost:${PORT}`);
  console.log(`📡 Lingkungan: ${process.env.NODE_ENV || 'development'}`);
  console.log(`===============================================`);
});