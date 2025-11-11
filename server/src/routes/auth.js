const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  register,
  login,
  logout,
  getMe,
  updatePassword
} = require('../controllers/authController');

// Rotas públicas
router.post('/register', register);
router.post('/login', login);

// Rotas protegidas (requerem autenticação)
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/updatepassword', protect, updatePassword);

module.exports = router;
