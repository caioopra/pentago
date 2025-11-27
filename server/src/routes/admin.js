const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { adminValidation } = require('../middleware/validate');
const adminController = require('../controllers/adminController');

// Todas as rotas requerem autenticação e role admin
router.use(protect);
router.use(authorize('admin'));

// Rotas de usuários
router.get('/users', adminValidation.getUsers, adminController.getUsers);
router.get('/users/:id', adminValidation.userAction, adminController.getUser);
router.put('/users/:id/ban', adminValidation.banUser, adminController.banUser);
router.put('/users/:id/unban', adminValidation.userAction, adminController.unbanUser);
router.delete('/users/:id', adminValidation.userAction, adminController.deleteUser);
router.put('/users/:id/promote', adminValidation.userAction, adminController.promoteUser);
router.put('/users/:id/demote', adminValidation.userAction, adminController.demoteUser);

// Rotas de estatísticas e configurações
router.get('/stats', adminController.getStats);
router.get('/config', adminController.getConfig);
router.put('/config', adminController.updateConfig);

// Rotas de jogos
router.get('/games', adminValidation.getGames, adminController.getGames);
router.delete('/games/:id', adminValidation.gameAction, adminController.deleteGame);

module.exports = router;
