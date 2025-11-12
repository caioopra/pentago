const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createGame,
  getGame,
  getMyGames,
  getGameHistory,
  abandonGame
} = require('../controllers/gameController');

// Todas as rotas requerem autenticação
router.use(protect);

// Criar ou entrar em partida
router.post('/create', createGame);

// Buscar partidas do usuário
router.get('/my-games', getMyGames);

// Histórico de partidas
router.get('/history', getGameHistory);

// Buscar partida específica
router.get('/:id', getGame);

// Abandonar partida
router.post('/:id/abandon', abandonGame);

module.exports = router;
