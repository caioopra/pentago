const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authValidation } = require('../middleware/validate');
const {
  register,
  login,
  logout,
  getMe,
  updatePassword
} = require('../controllers/authController');

// Rotas públicas
router.post('/register', authValidation.register, register);
router.post('/login', authValidation.login, login);

// Rotas protegidas (requerem autenticação)
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/updatepassword', protect, authValidation.updatePassword, updatePassword);

module.exports = router;
