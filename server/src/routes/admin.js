const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// Todas as rotas requerem autenticação e role admin
router.use(protect);
router.use(authorize('admin'));

// Rotas de usuários
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUser);
router.put('/users/:id/ban', adminController.banUser);
router.put('/users/:id/unban', adminController.unbanUser);
router.delete('/users/:id', adminController.deleteUser);
router.put('/users/:id/promote', adminController.promoteUser);
router.put('/users/:id/demote', adminController.demoteUser);

// Rotas de estatísticas e configurações
router.get('/stats', adminController.getStats);
router.get('/config', adminController.getConfig);

// Rotas de jogos
router.get('/games', adminController.getGames);
router.delete('/games/:id', adminController.deleteGame);

module.exports = router;
