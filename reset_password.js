// reset_password.js
const bcrypt = require('bcryptjs');
const pool = require('./src/config/database');

async function resetPasswords() {
  try {
    const plainPassword = 'password123';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);

    console.log('Generated hash:', hashedPassword);

    const [result] = await pool.query(
      'UPDATE users SET password = ? WHERE username IN (?, ?, ?, ?)',
      [hashedPassword, 'admin', 'bendahara', 'ketua', 'sekretaris']
    );

    console.log(`✅ Berhasil mereset password! ${result.affectedRows} user diperbarui.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Gagal mereset password:', error.message);
    process.exit(1);
  }
}

resetPasswords();