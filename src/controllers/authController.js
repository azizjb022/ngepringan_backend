const authService = require('../services/authService');

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username dan password wajib diisi!' });
    }
    const result = await authService.loginUser(username, password);
    return res.status(200).json({ success: true, message: 'Login berhasil!', data: result });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await authService.getUserById(req.user.id);
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};