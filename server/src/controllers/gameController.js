const Game = require('../models/Game');
const User = require('../models/User');

/**
 * Utilitário: Converte board de quadrantes para matriz 6x6
 */
const convertToFullBoard = (board) => {
  const fullBoard = Array(6).fill().map(() => Array(6).fill(0));

  for (let q = 0; q < 4; q++) {
    const startRow = Math.floor(q / 2) * 3;
    const startCol = (q % 2) * 3;

    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      fullBoard[startRow + row][startCol + col] = board[q][i];
    }
  }

  return fullBoard;
};

/**
 * Utilitário: Verifica se um jogador venceu
 */
const checkPlayerWin = (board, player) => {
  const fullBoard = convertToFullBoard(board);
  const directions = [
    [0, 1],   // horizontal
    [1, 0],   // vertical
    [1, 1],   // diagonal
    [1, -1]   // anti-diagonal
  ];

  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 6; col++) {
      if (fullBoard[row][col] === player) {
        for (let [dRow, dCol] of directions) {
          let count = 0;
          let r = row;
          let c = col;

          while (r >= 0 && r < 6 && c >= 0 && c < 6 && fullBoard[r][c] === player) {
            count++;
            if (count >= 5) return true;
            r += dRow;
            c += dCol;
          }
        }
      }
    }
  }
  return false;
};

/**
 * Utilitário: Verifica se o tabuleiro está cheio (empate)
 */
const isBoardFull = (board) => {
  for (let q = 0; q < 4; q++) {
    for (let c = 0; c < 9; c++) {
      if (board[q][c] === 0) return false;
    }
  }
  return true;
};

/**
 * Utilitário: Verifica condição de vitória
 */
const checkWinCondition = (board) => {
  if (checkPlayerWin(board, 1)) return { winner: 1 };
  if (checkPlayerWin(board, 2)) return { winner: 2 };
  if (isBoardFull(board)) return { draw: true };
  return null;
};

/**
 * @desc    Criar nova partida ou entrar na fila
 * @route   POST /api/games/create
 * @access  Private
 */
exports.createGame = async (req, res) => {
  try {
    const userId = req.user._id;

    // Verificar se o usuário já está em uma partida ativa
    const existingGame = await Game.findOne({
      $or: [
        { 'player1.userId': userId, status: { $in: ['waiting', 'playing'] } },
        { 'player2.userId': userId, status: { $in: ['waiting', 'playing'] } }
      ]
    });

    if (existingGame) {
      return res.status(400).json({
        success: false,
        message: 'Você já está em uma partida ativa.',
        gameId: existingGame._id
      });
    }

    // Procurar por uma partida esperando jogador
    const waitingGame = await Game.findOne({
      status: 'waiting',
      'player2.userId': null
    }).populate('player1.userId', 'name avatar');

    if (waitingGame) {
      // Entrar na partida existente como player2
      waitingGame.player2 = {
        userId: userId,
        playerNumber: 2,
        connected: true
      };
      waitingGame.status = 'playing';
      await waitingGame.save();

      await waitingGame.populate('player2.userId', 'name avatar');

      return res.status(200).json({
        success: true,
        message: 'Você entrou em uma partida!',
        game: waitingGame,
        playerNumber: 2
      });
    }

    // Criar nova partida esperando outro jogador
    const newGame = await Game.create({
      player1: {
        userId: userId,
        playerNumber: 1,
        connected: true
      },
      status: 'waiting'
    });

    await newGame.populate('player1.userId', 'name avatar');

    res.status(201).json({
      success: true,
      message: 'Partida criada! Aguardando outro jogador...',
      game: newGame,
      playerNumber: 1
    });
  } catch (error) {
    console.error('Erro ao criar partida:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar partida.'
    });
  }
};

/**
 * @desc    Buscar partida por ID
 * @route   GET /api/games/:id
 * @access  Private
 */
exports.getGame = async (req, res) => {
  try {
    const game = await Game.findById(req.params.id)
      .populate('player1.userId', 'name avatar')
      .populate('player2.userId', 'name avatar')
      .populate('winner', 'name avatar');

    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Partida não encontrada.'
      });
    }

    // Verificar se o usuário faz parte da partida
    const userId = req.user._id.toString();
    const player1Id = game.player1.userId._id.toString();
    const player2Id = game.player2.userId?._id.toString();

    if (userId !== player1Id && userId !== player2Id) {
      return res.status(403).json({
        success: false,
        message: 'Você não faz parte desta partida.'
      });
    }

    const playerNumber = game.getPlayerNumber(userId);

    res.status(200).json({
      success: true,
      game,
      playerNumber
    });
  } catch (error) {
    console.error('Erro ao buscar partida:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar partida.'
    });
  }
};

/**
 * @desc    Listar partidas ativas do usuário
 * @route   GET /api/games/my-games
 * @access  Private
 */
exports.getMyGames = async (req, res) => {
  try {
    const userId = req.user._id;

    const games = await Game.find({
      $or: [
        { 'player1.userId': userId },
        { 'player2.userId': userId }
      ],
      status: { $in: ['waiting', 'playing'] }
    })
      .populate('player1.userId', 'name avatar')
      .populate('player2.userId', 'name avatar')
      .sort({ lastActivity: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      games
    });
  } catch (error) {
    console.error('Erro ao buscar partidas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar partidas.'
    });
  }
};

/**
 * @desc    Listar partidas finalizadas (histórico)
 * @route   GET /api/games/history
 * @access  Private
 */
exports.getGameHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const games = await Game.find({
      $or: [
        { 'player1.userId': userId },
        { 'player2.userId': userId }
      ],
      status: { $in: ['finished', 'abandoned'] }
    })
      .populate('player1.userId', 'name avatar')
      .populate('player2.userId', 'name avatar')
      .populate('winner', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Game.countDocuments({
      $or: [
        { 'player1.userId': userId },
        { 'player2.userId': userId }
      ],
      status: { $in: ['finished', 'abandoned'] }
    });

    res.status(200).json({
      success: true,
      games,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar histórico.'
    });
  }
};

/**
 * @desc    Abandonar partida
 * @route   POST /api/games/:id/abandon
 * @access  Private
 */
exports.abandonGame = async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);

    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Partida não encontrada.'
      });
    }

    const userId = req.user._id.toString();
    const playerNumber = game.getPlayerNumber(userId);

    if (!playerNumber) {
      return res.status(403).json({
        success: false,
        message: 'Você não faz parte desta partida.'
      });
    }

    if (game.status === 'finished' || game.status === 'abandoned') {
      return res.status(400).json({
        success: false,
        message: 'Esta partida já foi finalizada.'
      });
    }

    // Marcar como abandonada
    game.status = 'abandoned';
    game.result = 'abandoned';

    // O oponente vence por W.O.
    if (playerNumber === 1 && game.player2.userId) {
      game.winner = game.player2.userId;
      game.result = 'player2_win';
    } else if (playerNumber === 2 && game.player1.userId) {
      game.winner = game.player1.userId;
      game.result = 'player1_win';
    }

    await game.save();

    res.status(200).json({
      success: true,
      message: 'Você abandonou a partida.',
      game
    });
  } catch (error) {
    console.error('Erro ao abandonar partida:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao abandonar partida.'
    });
  }
};

/**
 * @desc    Validar e realizar movimento (usado pelo Socket.io)
 * @internal
 */
exports.validateAndPlacePiece = async (gameId, userId, quadrant, cell) => {
  try {
    const game = await Game.findById(gameId);

    if (!game) {
      return { success: false, message: 'Partida não encontrada.' };
    }

    if (game.status !== 'playing') {
      return { success: false, message: 'A partida não está em andamento.' };
    }

    if (game.gamePhase !== 'place') {
      return { success: false, message: 'Não é a fase de colocar peças.' };
    }

    if (!game.isPlayerTurn(userId)) {
      return { success: false, message: 'Não é seu turno.' };
    }

    // Validar posição
    if (quadrant < 0 || quadrant > 3 || cell < 0 || cell > 8) {
      return { success: false, message: 'Posição inválida.' };
    }

    if (game.boardState[quadrant][cell] !== 0) {
      return { success: false, message: 'Célula já ocupada.' };
    }

    // Realizar movimento
    const playerNumber = game.getPlayerNumber(userId);
    game.boardState[quadrant][cell] = playerNumber;
    game.gamePhase = 'rotate';
    game.lastActivity = new Date();

    // Adicionar ao histórico
    game.moveHistory.push({
      player: playerNumber,
      action: 'place',
      quadrant,
      cell
    });

    // Verificar vitória após colocar peça
    const winCheck = checkWinCondition(game.boardState);
    if (winCheck) {
      if (winCheck.winner) {
        game.status = 'finished';
        game.result = `player${winCheck.winner}_win`;
        game.winner = winCheck.winner === 1 ? game.player1.userId : game.player2.userId;
      } else if (winCheck.draw) {
        game.status = 'finished';
        game.result = 'draw';
      }
    }

    await game.save();

    return {
      success: true,
      game,
      winCheck
    };
  } catch (error) {
    console.error('Erro ao colocar peça:', error);
    return { success: false, message: 'Erro ao processar movimento.' };
  }
};

/**
 * @desc    Validar e realizar rotação (usado pelo Socket.io)
 * @internal
 */
exports.validateAndRotateQuadrant = async (gameId, userId, quadrant, direction) => {
  try {
    const game = await Game.findById(gameId);

    if (!game) {
      return { success: false, message: 'Partida não encontrada.' };
    }

    if (game.status !== 'playing') {
      return { success: false, message: 'A partida não está em andamento.' };
    }

    if (game.gamePhase !== 'rotate') {
      return { success: false, message: 'Não é a fase de rotacionar.' };
    }

    if (!game.isPlayerTurn(userId)) {
      return { success: false, message: 'Não é seu turno.' };
    }

    // Validar parâmetros
    if (quadrant < 0 || quadrant > 3) {
      return { success: false, message: 'Quadrante inválido.' };
    }

    if (direction !== 'left' && direction !== 'right') {
      return { success: false, message: 'Direção inválida.' };
    }

    // Realizar rotação
    const quad = game.boardState[quadrant];
    const rotated = new Array(9);

    if (direction === 'right') {
      rotated[0] = quad[6];
      rotated[1] = quad[3];
      rotated[2] = quad[0];
      rotated[3] = quad[7];
      rotated[4] = quad[4];
      rotated[5] = quad[1];
      rotated[6] = quad[8];
      rotated[7] = quad[5];
      rotated[8] = quad[2];
    } else {
      rotated[0] = quad[2];
      rotated[1] = quad[5];
      rotated[2] = quad[8];
      rotated[3] = quad[1];
      rotated[4] = quad[4];
      rotated[5] = quad[7];
      rotated[6] = quad[0];
      rotated[7] = quad[3];
      rotated[8] = quad[6];
    }

    game.boardState[quadrant] = rotated;

    // Adicionar ao histórico
    const playerNumber = game.getPlayerNumber(userId);
    game.moveHistory.push({
      player: playerNumber,
      action: 'rotate',
      quadrant,
      direction
    });

    // Verificar vitória após rotação
    const winCheck = checkWinCondition(game.boardState);
    if (winCheck) {
      if (winCheck.winner) {
        game.status = 'finished';
        game.result = `player${winCheck.winner}_win`;
        game.winner = winCheck.winner === 1 ? game.player1.userId : game.player2.userId;
      } else if (winCheck.draw) {
        game.status = 'finished';
        game.result = 'draw';
      }
    } else {
      // Trocar turno apenas se não houver vitória
      game.switchTurn();
    }

    await game.save();

    return {
      success: true,
      game,
      winCheck
    };
  } catch (error) {
    console.error('Erro ao rotacionar quadrante:', error);
    return { success: false, message: 'Erro ao processar rotação.' };
  }
};

module.exports = exports;
