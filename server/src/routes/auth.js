const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authValidation } = require('../middleware/validate');
const { authLimiter, createLimiter } = require('../middleware/rateLimiter');
const {
  register,
  login,
  logout,
  getMe,
  updatePassword
} = require('../controllers/authController');

// Rotas públicas (com rate limiting)
router.post('/register', createLimiter, authValidation.register, register);
router.post('/login', authLimiter, authValidation.login, login);

// Rotas protegidas (requerem autenticação)
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/updatepassword', protect, authValidation.updatePassword, updatePassword);

module.exports = router;
