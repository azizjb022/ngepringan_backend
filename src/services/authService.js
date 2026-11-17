const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.loginUser = async (username, password) => {
  console.log('Login attempt:', { username, password });

  const [rows] = await pool.query(
    'SELECT id, nama, username, email, password, role, rt, no_hp, is_active FROM users WHERE username = ? OR email = ? LIMIT 1',
    [username, username]
  );

  if (rows.length === 0) {
    console.log('❌ User tidak ditemukan di DB');
    throw { status: 401, message: 'Username atau password salah!' };
  }

  const user = rows[0];
  console.log('Found user:', user.username, 'Active:', user.is_active);

  const isMatch = await bcrypt.compare(password, user.password);
  console.log('Password match status:', isMatch);

  if (!isMatch) {
    console.log('❌ Password bcrypt tidak cocok');
    throw { status: 401, message: 'Username atau password salah!' };
  }

  const token = jwt.sign(
    { id: user.id, nama: user.nama, username: user.username, role: user.role, rt: user.rt },
    process.env.JWT_SECRET || 'ngepringan_super_secret_key_2026_jwt',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const { password: _, ...userData } = user;
  return { token, user: userData };
};

exports.getUserById = async (id) => {
  const [rows] = await pool.query(
    'SELECT id, nama, username, email, role, rt, no_hp, created_at FROM users WHERE id = ?',
    [id]
  );
  if (rows.length === 0) {
    throw { status: 404, message: 'User tidak ditemukan' };
  }
  return rows[0];
};