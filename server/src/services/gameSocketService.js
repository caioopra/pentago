const Game = require('../models/Game');
const jwt = require('jsonwebtoken');
const {
  validateAndPlacePiece,
  validateAndRotateQuadrant
} = require('../controllers/gameController');

/**
 * Serviço de Socket.io para gerenciar partidas em tempo real
 */
class GameSocketService {
  constructor(io) {
    this.io = io;
    this.connectedPlayers = new Map(); // socketId -> { userId, gameId }
  }

  /**
   * Inicializa os event handlers do Socket.io
   */
  initialize() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Cliente conectado: ${socket.id}`);

      // Autenticação do socket
      socket.on('authenticate', async (token) => {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          socket.userId = decoded.id;
          console.log(`✅ Usuário autenticado: ${socket.userId}`);

          // Emitir confirmação
          socket.emit('authenticated', { success: true });
        } catch (error) {
          console.error('❌ Erro na autenticação do socket:', error);
          socket.emit('auth_error', { message: 'Token inválido.' });
          socket.disconnect();
        }
      });

      // Entrar em uma partida
      socket.on('join_game', async (data) => {
        await this.handleJoinGame(socket, data);
      });

      // Colocar peça
      socket.on('place_piece', async (data) => {
        await this.handlePlacePiece(socket, data);
      });

      // Rotacionar quadrante
      socket.on('rotate_quadrant', async (data) => {
        await this.handleRotateQuadrant(socket, data);
      });

      // Sair da partida
      socket.on('leave_game', async () => {
        await this.handleLeaveGame(socket);
      });

      // Desconexão
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  /**
   * Handler: Entrar em uma partida
   */
  async handleJoinGame(socket, data) {
    try {
      if (!socket.userId) {
        socket.emit('error', { message: 'Você precisa estar autenticado.' });
        return;
      }

      const { gameId } = data;

      const game = await Game.findById(gameId)
        .populate('player1.userId', 'name avatar')
        .populate('player2.userId', 'name avatar');

      if (!game) {
        socket.emit('error', { message: 'Partida não encontrada.' });
        return;
      }

      // Verificar se o usuário faz parte da partida
      const playerNumber = game.getPlayerNumber(socket.userId);

      if (!playerNumber) {
        socket.emit('error', { message: 'Você não faz parte desta partida.' });
        return;
      }

      // Entrar na sala (room) da partida
      socket.join(`game_${gameId}`);

      // Atualizar socketId do jogador
      if (playerNumber === 1) {
        game.player1.socketId = socket.id;
        game.player1.connected = true;
      } else {
        game.player2.socketId = socket.id;
        game.player2.connected = true;
      }

      await game.save();

      // Armazenar informações do jogador conectado
      this.connectedPlayers.set(socket.id, {
        userId: socket.userId,
        gameId: gameId
      });

      console.log(`🎮 Jogador ${playerNumber} entrou na partida ${gameId}`);

      // Emitir estado atual da partida
      socket.emit('game_joined', {
        success: true,
        game,
        playerNumber
      });

      // Notificar o oponente
      socket.to(`game_${gameId}`).emit('opponent_connected', {
        playerNumber
      });

      // Se ambos conectados e status 'playing', emitir game_start
      if (game.status === 'playing' && game.player1.connected && game.player2.connected) {
        this.io.to(`game_${gameId}`).emit('game_start', {
          game
        });
      }
    } catch (error) {
      console.error('Erro ao entrar na partida:', error);
      socket.emit('error', { message: 'Erro ao entrar na partida.' });
    }
  }

  /**
   * Handler: Colocar peça
   */
  async handlePlacePiece(socket, data) {
    try {
      if (!socket.userId) {
        socket.emit('error', { message: 'Você precisa estar autenticado.' });
        return;
      }

      const { gameId, quadrant, cell } = data;

      // Validar e processar movimento
      const result = await validateAndPlacePiece(gameId, socket.userId, quadrant, cell);

      if (!result.success) {
        socket.emit('error', { message: result.message });
        return;
      }

      // Buscar game atualizado com populate
      const game = await Game.findById(gameId)
        .populate('player1.userId', 'name avatar')
        .populate('player2.userId', 'name avatar')
        .populate('winner', 'name avatar');

      // Broadcast do movimento para todos na sala
      this.io.to(`game_${gameId}`).emit('piece_placed', {
        quadrant,
        cell,
        player: game.getPlayerNumber(socket.userId),
        gameState: {
          boardState: game.boardState,
          currentTurn: game.currentTurn,
          gamePhase: game.gamePhase,
          status: game.status
        }
      });

      // Se houver vitória ou empate
      if (result.winCheck) {
        this.io.to(`game_${gameId}`).emit('game_over', {
          winner: result.winCheck.winner || null,
          draw: result.winCheck.draw || false,
          game
        });

        console.log(`🏁 Partida ${gameId} finalizada`);
      }
    } catch (error) {
      console.error('Erro ao colocar peça:', error);
      socket.emit('error', { message: 'Erro ao processar movimento.' });
    }
  }

  /**
   * Handler: Rotacionar quadrante
   */
  async handleRotateQuadrant(socket, data) {
    try {
      if (!socket.userId) {
        socket.emit('error', { message: 'Você precisa estar autenticado.' });
        return;
      }

      const { gameId, quadrant, direction } = data;

      // Validar e processar rotação
      const result = await validateAndRotateQuadrant(gameId, socket.userId, quadrant, direction);

      if (!result.success) {
        socket.emit('error', { message: result.message });
        return;
      }

      // Buscar game atualizado com populate
      const game = await Game.findById(gameId)
        .populate('player1.userId', 'name avatar')
        .populate('player2.userId', 'name avatar')
        .populate('winner', 'name avatar');

      // Broadcast da rotação para todos na sala
      this.io.to(`game_${gameId}`).emit('quadrant_rotated', {
        quadrant,
        direction,
        player: game.getPlayerNumber(socket.userId),
        gameState: {
          boardState: game.boardState,
          currentTurn: game.currentTurn,
          gamePhase: game.gamePhase,
          status: game.status
        }
      });

      // Se houver vitória ou empate
      if (result.winCheck) {
        this.io.to(`game_${gameId}`).emit('game_over', {
          winner: result.winCheck.winner || null,
          draw: result.winCheck.draw || false,
          game
        });

        console.log(`🏁 Partida ${gameId} finalizada`);
      }
    } catch (error) {
      console.error('Erro ao rotacionar quadrante:', error);
      socket.emit('error', { message: 'Erro ao processar rotação.' });
    }
  }

  /**
   * Handler: Sair da partida
   */
  async handleLeaveGame(socket) {
    try {
      const playerInfo = this.connectedPlayers.get(socket.id);

      if (!playerInfo) return;

      const { gameId } = playerInfo;

      const game = await Game.findById(gameId);

      if (game) {
        const playerNumber = game.getPlayerNumber(socket.userId);

        if (playerNumber === 1) {
          game.player1.connected = false;
        } else if (playerNumber === 2) {
          game.player2.connected = false;
        }

        await game.save();

        // Notificar oponente
        socket.to(`game_${gameId}`).emit('opponent_disconnected', {
          playerNumber
        });

        console.log(`👋 Jogador ${playerNumber} saiu da partida ${gameId}`);
      }

      socket.leave(`game_${gameId}`);
      this.connectedPlayers.delete(socket.id);
    } catch (error) {
      console.error('Erro ao sair da partida:', error);
    }
  }

  /**
   * Handler: Desconexão
   */
  async handleDisconnect(socket) {
    console.log(`🔌 Cliente desconectado: ${socket.id}`);

    const playerInfo = this.connectedPlayers.get(socket.id);

    if (playerInfo) {
      const { gameId, userId } = playerInfo;

      try {
        const game = await Game.findById(gameId);

        if (game && game.isActive()) {
          const playerNumber = game.getPlayerNumber(userId);

          if (playerNumber === 1) {
            game.player1.connected = false;
          } else if (playerNumber === 2) {
            game.player2.connected = false;
          }

          await game.save();

          // Notificar oponente da desconexão
          socket.to(`game_${gameId}`).emit('opponent_disconnected', {
            playerNumber
          });

          console.log(`⚠️ Jogador ${playerNumber} desconectou da partida ${gameId}`);
        }
      } catch (error) {
        console.error('Erro ao processar desconexão:', error);
      }

      this.connectedPlayers.delete(socket.id);
    }
  }
}

module.exports = GameSocketService;
