const Game = require('../models/Game');
const jwt = require('jsonwebtoken');
const QueueService = require('./queueService');
const ChatService = require('./chatService');
const InactivityService = require('./inactivityService');
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
    this.queueService = new QueueService(io);
    this.chatService = new ChatService(io);
    this.inactivityService = new InactivityService(io);
  }

  /**
   * Inicializa os event handlers do Socket.io
   */
  initialize() {
    // Iniciar monitoramento de inatividade
    this.inactivityService.start();

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

      // === EVENTOS DA FILA ===

      // Entrar na fila
      socket.on('join_queue', async () => {
        await this.handleJoinQueue(socket);
      });

      // Sair da fila
      socket.on('leave_queue', () => {
        this.handleLeaveQueue(socket);
      });

      // Obter informações da fila
      socket.on('get_queue_info', () => {
        socket.emit('queue_info', this.queueService.getQueueInfo());
      });

      // === EVENTOS DE CHAT ===

      // Enviar mensagem
      socket.on('send_message', async (data) => {
        await this.handleSendMessage(socket, data);
      });

      // Buscar histórico de mensagens
      socket.on('get_messages', async (data) => {
        await this.handleGetMessages(socket, data);
      });

      // Usuário está digitando
      socket.on('typing', (data) => {
        this.handleTyping(socket, data);
      });

      // Usuário parou de digitar
      socket.on('stop_typing', () => {
        this.chatService.stopTyping(socket.id);
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

      let game = await Game.findById(gameId)
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

      // Atualizar socketId do jogador usando operação atômica
      const updateField = playerNumber === 1 ? 'player1' : 'player2';
      await Game.findByIdAndUpdate(gameId, {
        [`${updateField}.socketId`]: socket.id,
        [`${updateField}.connected`]: true
      });

      // Re-fetch o jogo para ter o estado mais recente de AMBOS os jogadores
      const updatedGame = await Game.findById(gameId)
        .populate('player1.userId', 'name avatar')
        .populate('player2.userId', 'name avatar');

      // Usar o jogo atualizado daqui para frente
      game = updatedGame;

      // Armazenar informações do jogador conectado
      this.connectedPlayers.set(socket.id, {
        userId: socket.userId,
        gameId: gameId
      });

      // Iniciar rastreamento de inatividade
      this.inactivityService.trackPlayer(gameId, socket.userId);

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

      // Se ambos conectados, mudar status para 'playing' e iniciar partida
      if (game.player1.connected && game.player2.connected && game.status === 'waiting') {
        game.status = 'playing';
        await game.save();

        // Re-popular novamente após o segundo save
        await game.populate('player1.userId', 'name avatar');
        await game.populate('player2.userId', 'name avatar');

        this.io.to(`game_${gameId}`).emit('game_start', {
          game
        });

        console.log(`🎮 Partida ${gameId} iniciada!`);
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

      // Atualizar atividade do jogador
      this.inactivityService.updateActivity(gameId, socket.userId);

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

        // Parar de rastrear ambos os jogadores
        this.inactivityService.untrackPlayer(gameId, game.player1.userId._id.toString());
        this.inactivityService.untrackPlayer(gameId, game.player2.userId._id.toString());

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

      // Atualizar atividade do jogador
      this.inactivityService.updateActivity(gameId, socket.userId);

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

        // Parar de rastrear ambos os jogadores
        this.inactivityService.untrackPlayer(gameId, game.player1.userId._id.toString());
        this.inactivityService.untrackPlayer(gameId, game.player2.userId._id.toString());

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

      const { gameId, userId } = playerInfo;

      const game = await Game.findById(gameId);

      if (game) {
        const playerNumber = game.getPlayerNumber(socket.userId);

        if (playerNumber === 1) {
          game.player1.connected = false;
        } else if (playerNumber === 2) {
          game.player2.connected = false;
        }

        await game.save();

        // Parar de rastrear jogador
        this.inactivityService.untrackPlayer(gameId, userId);

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

    // Remover da fila se estiver nela
    this.queueService.removeBySocketId(socket.id);

    // Limpar typing
    this.chatService.handleDisconnect(socket.id);

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

          // Parar de rastrear jogador (timeout vai lidar com a desconexão)
          this.inactivityService.untrackPlayer(gameId, userId);

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

  /**
   * Handler: Entrar na fila
   */
  async handleJoinQueue(socket) {
    if (!socket.userId) {
      socket.emit('error', { message: 'Você precisa estar autenticado.' });
      return;
    }

    const result = await this.queueService.addToQueue(socket.userId, socket.id);

    if (result.success) {
      socket.emit('queue_joined', {
        success: true,
        message: result.message,
        position: result.position,
        queueSize: result.queueSize
      });
    } else {
      socket.emit('queue_error', {
        success: false,
        message: result.message,
        gameId: result.gameId // Se já está em partida
      });
    }
  }

  /**
   * Handler: Sair da fila
   */
  handleLeaveQueue(socket) {
    if (!socket.userId) {
      socket.emit('error', { message: 'Você precisa estar autenticado.' });
      return;
    }

    const result = this.queueService.removeFromQueue(socket.userId);
    socket.emit('queue_left', result);
  }

  /**
   * Obter serviço de fila (para uso externo se necessário)
   */
  getQueueService() {
    return this.queueService;
  }

  /**
   * Handler: Enviar mensagem
   */
  async handleSendMessage(socket, data) {
    if (!socket.userId) {
      socket.emit('error', { message: 'Você precisa estar autenticado.' });
      return;
    }

    const { content, channel, gameId } = data;

    const result = await this.chatService.sendMessage(
      socket.userId,
      content,
      channel,
      gameId
    );

    if (!result.success) {
      socket.emit('chat_error', { message: result.message });
    }
    // Se sucesso, a mensagem já foi broadcast pelo chatService
  }

  /**
   * Handler: Buscar histórico de mensagens
   */
  async handleGetMessages(socket, data) {
    const { channel, gameId, limit } = data;

    const messages = await this.chatService.getMessages(
      channel,
      gameId,
      limit || 50
    );

    socket.emit('messages_history', {
      channel,
      gameId,
      messages
    });
  }

  /**
   * Handler: Usuário digitando
   */
  handleTyping(socket, data) {
    if (!socket.userId) return;

    const { channel, gameId } = data;
    this.chatService.setTyping(socket.id, socket.userId, channel, gameId);
  }
}

module.exports = GameSocketService;
