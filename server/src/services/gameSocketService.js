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
    this.disconnectTimers = new Map(); // gameId_userId -> { timer, startTime }
    this.queueService = new QueueService(io);
    this.chatService = new ChatService(io);
    this.inactivityService = new InactivityService(io);
    this.disconnectTimeout = 15000; // 15 seconds
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

      // Confirmar participação na partida
      socket.on('confirm_match', async (data) => {
        await this.handleConfirmMatch(socket, data);
      });

      // Recusar participação na partida
      socket.on('decline_match', async (data) => {
        await this.handleDeclineMatch(socket, data);
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

      // === EVENTOS DE WEBRTC (VIDEO CHAT) ===

      // Oferta WebRTC
      socket.on('webrtc_offer', (data) => {
        this.handleWebRTCOffer(socket, data);
      });

      // Resposta WebRTC
      socket.on('webrtc_answer', (data) => {
        this.handleWebRTCAnswer(socket, data);
      });

      // Candidato ICE
      socket.on('ice_candidate', (data) => {
        this.handleICECandidate(socket, data);
      });

      // === EVENTOS DE GRAVAÇÃO DE VÍDEO ===

      // Iniciar gravação
      socket.on('start_recording', (data) => {
        this.handleStartRecording(socket, data);
      });

      // Enviar chunk de vídeo
      socket.on('video_chunk', (data) => {
        this.handleVideoChunk(socket, data);
      });

      // Finalizar gravação
      socket.on('stop_recording', (data) => {
        this.handleStopRecording(socket, data);
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

      // Limpar timer de desconexão se existir (player reconectou)
      const disconnectKey = `${gameId}_${socket.userId}`;
      const wasReconnecting = this.disconnectTimers.has(disconnectKey);

      if (wasReconnecting) {
        clearTimeout(this.disconnectTimers.get(disconnectKey).timer);
        this.disconnectTimers.delete(disconnectKey);
        console.log(`✅ Jogador ${playerNumber} reconectou à partida ${gameId}`);
      }

      // Iniciar rastreamento de inatividade
      this.inactivityService.trackPlayer(gameId, socket.userId);

      console.log(`🎮 Jogador ${playerNumber} entrou na partida ${gameId}`);

      // Emitir estado atual da partida
      socket.emit('game_joined', {
        success: true,
        game,
        playerNumber
      });

      // Notificar o oponente sobre reconexão APENAS se o jogador estava desconectado
      if (wasReconnecting) {
        socket.to(`game_${gameId}`).emit('opponent_reconnected', {
          playerNumber
        });
      }

      // Se ambos conectados, mudar status para 'playing' e iniciar partida
      if (game.player1.connected && game.player2.connected && game.status === 'waiting') {
        game.status = 'playing';
        await game.save();

        // Re-popular novamente após o segundo save
        await game.populate('player1.userId', 'name avatar');
        await game.populate('player2.userId', 'name avatar');

        const gameStartData = { game, gameId };

        // Enviar para jogadores
        this.io.to(`game_${gameId}`).emit('game_start', gameStartData);

        // Enviar para espectadores
        this.io.emit('spectator_game_start', gameStartData);

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

      // Broadcast do movimento para todos na sala E para espectadores
      const moveData = {
        gameId,
        quadrant,
        cell,
        player: game.getPlayerNumber(socket.userId),
        gameState: {
          boardState: game.boardState,
          currentTurn: game.currentTurn,
          gamePhase: game.gamePhase,
          status: game.status
        }
      };

      // Enviar para jogadores na sala
      this.io.to(`game_${gameId}`).emit('piece_placed', moveData);

      // Enviar para espectadores (todos os outros clientes conectados)
      this.io.emit('spectator_piece_placed', moveData);

      // Se houver vitória ou empate
      if (result.winCheck) {
        const gameOverData = {
          gameId,
          winner: result.winCheck.winner || null,
          draw: result.winCheck.draw || false,
          game
        };

        // Enviar para jogadores
        this.io.to(`game_${gameId}`).emit('game_over', gameOverData);

        // Enviar para espectadores
        this.io.emit('spectator_game_over', gameOverData);

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

      // Broadcast da rotação para todos na sala E para espectadores
      const rotationData = {
        gameId,
        quadrant,
        direction,
        player: game.getPlayerNumber(socket.userId),
        gameState: {
          boardState: game.boardState,
          currentTurn: game.currentTurn,
          gamePhase: game.gamePhase,
          status: game.status
        }
      };

      // Enviar para jogadores na sala
      this.io.to(`game_${gameId}`).emit('quadrant_rotated', rotationData);

      // Enviar para espectadores (todos os outros clientes conectados)
      this.io.emit('spectator_quadrant_rotated', rotationData);

      // Se houver vitória ou empate
      if (result.winCheck) {
        const gameOverData = {
          gameId,
          winner: result.winCheck.winner || null,
          draw: result.winCheck.draw || false,
          game
        };

        // Enviar para jogadores
        this.io.to(`game_${gameId}`).emit('game_over', gameOverData);

        // Enviar para espectadores
        this.io.emit('spectator_game_over', gameOverData);

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

        // Verificar se ambos jogadores saíram
        if (!game.player1.connected && !game.player2.connected) {
          // Só deletar partidas não finalizadas (preservar histórico)
          if (game.status !== 'finished' && game.status !== 'abandoned') {
            console.log(`🗑️ Ambos jogadores saíram da partida ${gameId} - deletando partida não finalizada`);

            // Deletar a partida da base de dados
            await Game.findByIdAndDelete(gameId);

            // Notificar a sala
            this.io.to(`game_${gameId}`).emit('game_deleted', {
              message: 'A partida foi encerrada pois ambos os jogadores saíram.'
            });
          } else {
            console.log(`📊 Partida ${gameId} finalizada - preservando para histórico`);
          }
        }
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
        const game = await Game.findById(gameId)
          .populate('player1.userId', 'name')
          .populate('player2.userId', 'name');

        if (game && game.isActive()) {
          const playerNumber = game.getPlayerNumber(userId);

          if (playerNumber === 1) {
            game.player1.connected = false;
          } else if (playerNumber === 2) {
            game.player2.connected = false;
          }

          await game.save();

          // Parar de rastrear jogador (disconnect timer vai lidar com a desconexão)
          this.inactivityService.untrackPlayer(gameId, userId);

          // Notificar oponente da desconexão com timer de 15 segundos
          socket.to(`game_${gameId}`).emit('opponent_disconnected', {
            playerNumber,
            waitTime: 15 // seconds
          });

          console.log(`⚠️ Jogador ${playerNumber} desconectou da partida ${gameId} - iniciando timer de 15s`);

          // Iniciar timer de 15 segundos para declarar vitória do oponente
          const disconnectKey = `${gameId}_${userId}`;
          const timer = setTimeout(async () => {
            await this.handleDisconnectTimeout(gameId, userId, playerNumber);
          }, this.disconnectTimeout);

          this.disconnectTimers.set(disconnectKey, {
            timer,
            startTime: Date.now()
          });

          // Verificar se ambos jogadores estão desconectados
          if (!game.player1.connected && !game.player2.connected) {
            // Limpar timers de ambos jogadores
            const key1 = `${gameId}_${game.player1.userId._id || game.player1.userId}`;
            const key2 = `${gameId}_${game.player2.userId._id || game.player2.userId}`;

            if (this.disconnectTimers.has(key1)) {
              clearTimeout(this.disconnectTimers.get(key1).timer);
              this.disconnectTimers.delete(key1);
            }
            if (this.disconnectTimers.has(key2)) {
              clearTimeout(this.disconnectTimers.get(key2).timer);
              this.disconnectTimers.delete(key2);
            }

            // Só deletar partidas não finalizadas (preservar histórico)
            if (game.status !== 'finished' && game.status !== 'abandoned') {
              console.log(`🗑️ Ambos jogadores desconectaram da partida ${gameId} - deletando partida não finalizada`);

              // Deletar a partida da base de dados
              await Game.findByIdAndDelete(gameId);

              // Notificar a sala (caso alguém ainda esteja conectado)
              this.io.to(`game_${gameId}`).emit('game_deleted', {
                message: 'A partida foi encerrada pois ambos os jogadores saíram.'
              });
            } else {
              console.log(`📊 Partida ${gameId} finalizada - preservando para histórico`);
            }
          }
        }
      } catch (error) {
        console.error('Erro ao processar desconexão:', error);
      }

      this.connectedPlayers.delete(socket.id);
    }
  }

  /**
   * Lidar com timeout de desconexão (15 segundos)
   */
  async handleDisconnectTimeout(gameId, disconnectedUserId, disconnectedPlayerNumber) {
    try {
      console.log(`⏱️ Timeout de desconexão atingido para jogador ${disconnectedPlayerNumber} na partida ${gameId}`);

      const game = await Game.findById(gameId)
        .populate('player1.userId', 'name')
        .populate('player2.userId', 'name');

      if (!game) {
        console.log(`Game ${gameId} não encontrado para timeout de desconexão`);
        return;
      }

      // Só processar se o jogo ainda estiver ativo
      if (!game.isActive()) {
        console.log(`Game ${gameId} não está mais ativo`);
        return;
      }

      // Verificar se o jogador ainda está desconectado
      const isPlayer1 = disconnectedPlayerNumber === 1;
      const stillDisconnected = isPlayer1 ? !game.player1.connected : !game.player2.connected;

      if (!stillDisconnected) {
        console.log(`Jogador ${disconnectedPlayerNumber} reconectou antes do timeout`);
        return;
      }

      // Determinar o vencedor (o jogador que ainda está conectado)
      const player1Id = game.player1.userId._id || game.player1.userId;
      const player2Id = game.player2.userId._id || game.player2.userId;
      const winnerId = isPlayer1 ? player2Id : player1Id;
      const disconnectedPlayerName = isPlayer1
        ? (game.player1.userId.name || 'Jogador 1')
        : (game.player2.userId.name || 'Jogador 2');
      const winnerName = isPlayer1
        ? (game.player2.userId.name || 'Jogador 2')
        : (game.player1.userId.name || 'Jogador 1');

      // Atualizar estado do jogo
      game.status = 'finished';
      game.winner = winnerId;
      game.result = isPlayer1 ? 'player2_win' : 'player1_win';
      await game.save();

      // Atualizar pontuação do vencedor (+3 pontos)
      const User = require('../models/User');
      await User.findByIdAndUpdate(winnerId, { $inc: { score: 3 } });
      console.log(`📊 ${winnerName} recebeu +3 pontos por vitória (desconexão do oponente)`);

      // Notificar ambos jogadores via Socket.io
      this.io.to(`game_${gameId}`).emit('disconnect_timeout', {
        gameId,
        disconnectedPlayer: {
          id: disconnectedUserId.toString(),
          playerNumber: disconnectedPlayerNumber,
          username: disconnectedPlayerName
        },
        winner: {
          id: winnerId.toString(),
          playerNumber: isPlayer1 ? 2 : 1,
          username: winnerName
        },
        message: `${disconnectedPlayerName} não reconectou a tempo. ${winnerName} venceu a partida!`
      });

      // Notificar espectadores
      this.io.emit('spectator_game_over', {
        gameId,
        winner: winnerId,
        draw: false,
        game
      });

      // Limpar timer
      const disconnectKey = `${gameId}_${disconnectedUserId}`;
      this.disconnectTimers.delete(disconnectKey);

      // Parar de rastrear ambos os jogadores
      this.inactivityService.untrackPlayer(gameId, player1Id.toString());
      this.inactivityService.untrackPlayer(gameId, player2Id.toString());

      console.log(`🏁 Partida ${gameId} finalizada por desconexão. Vencedor: ${winnerName}`);
    } catch (error) {
      console.error('Erro ao processar timeout de desconexão:', error);
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

      // Enviar estado do jogo atual se houver uma partida em andamento
      try {
        const activeGame = await Game.findOne({
          status: { $in: ['waiting', 'playing'] }
        })
          .populate('player1.userId', 'name avatar')
          .populate('player2.userId', 'name avatar')
          .populate('winner', 'name avatar')
          .sort({ createdAt: -1 })
          .limit(1);

        if (activeGame) {
          socket.emit('spectator_game_start', {
            game: activeGame,
            gameId: activeGame._id
          });
        }
      } catch (error) {
        console.error('Erro ao buscar partida ativa para espectador:', error);
      }
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
   * Handler: Confirmar participação na partida
   */
  async handleConfirmMatch(socket, data) {
    if (!socket.userId) {
      socket.emit('error', { message: 'Você precisa estar autenticado.' });
      return;
    }

    const { matchId } = data;

    if (!matchId) {
      socket.emit('error', { message: 'Match ID é obrigatório.' });
      return;
    }

    const result = await this.queueService.confirmMatch(socket.userId, matchId);
    socket.emit('match_confirm_result', result);
  }

  /**
   * Handler: Recusar participação na partida
   */
  async handleDeclineMatch(socket, data) {
    if (!socket.userId) {
      socket.emit('error', { message: 'Você precisa estar autenticado.' });
      return;
    }

    const { matchId } = data;

    if (!matchId) {
      socket.emit('error', { message: 'Match ID é obrigatório.' });
      return;
    }

    const result = await this.queueService.declineMatch(socket.userId, matchId);
    socket.emit('match_decline_result', result);
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

  /**
   * Handler: Oferta WebRTC
   * Repassa a oferta WebRTC para o outro jogador na sala
   */
  handleWebRTCOffer(socket, data) {
    const { gameId, offer } = data;

    if (!gameId || !offer) {
      console.error('❌ WebRTC offer inválida');
      return;
    }

    // Repassar para o outro jogador na sala (não para si mesmo)
    socket.to(`game_${gameId}`).emit('webrtc_offer', {
      offer,
      from: socket.id
    });

    console.log(`📹 WebRTC offer enviada na partida ${gameId}`);
  }

  /**
   * Handler: Resposta WebRTC
   * Repassa a resposta WebRTC para o jogador que enviou a oferta
   */
  handleWebRTCAnswer(socket, data) {
    const { gameId, answer } = data;

    if (!gameId || !answer) {
      console.error('❌ WebRTC answer inválida');
      return;
    }

    // Repassar para o outro jogador na sala
    socket.to(`game_${gameId}`).emit('webrtc_answer', {
      answer,
      from: socket.id
    });

    console.log(`📹 WebRTC answer enviada na partida ${gameId}`);
  }

  /**
   * Handler: Candidato ICE
   * Repassa o candidato ICE para o outro jogador
   */
  handleICECandidate(socket, data) {
    const { gameId, candidate } = data;

    if (!gameId || !candidate) {
      console.error('❌ ICE candidate inválido');
      return;
    }

    // Repassar para o outro jogador na sala
    socket.to(`game_${gameId}`).emit('ice_candidate', {
      candidate,
      from: socket.id
    });

    console.log(`📹 ICE candidate enviado na partida ${gameId}`);
  }

  /**
   * Handler: Iniciar gravação de vídeo
   */
  handleStartRecording(socket, data) {
    const { gameId } = data;

    if (!gameId) {
      socket.emit('recording_error', { message: 'Game ID não fornecido' });
      return;
    }

    const videoRecordingService = require('./videoRecordingService');
    const result = videoRecordingService.startRecording(gameId, {
      initiatedBy: socket.userId
    });

    if (result.success) {
      socket.emit('recording_started', { gameId });
      // Notificar oponente que gravação iniciou
      socket.to(`game_${gameId}`).emit('opponent_recording_started');
    } else {
      socket.emit('recording_error', { message: result.message });
    }
  }

  /**
   * Handler: Receber chunk de vídeo
   */
  async handleVideoChunk(socket, data) {
    const { gameId, chunk } = data;

    if (!gameId || !chunk) {
      return;
    }

    const videoRecordingService = require('./videoRecordingService');
    await videoRecordingService.receiveChunk(gameId, chunk);
  }

  /**
   * Handler: Finalizar gravação
   */
  async handleStopRecording(socket, data) {
    const { gameId } = data;

    if (!gameId) {
      socket.emit('recording_error', { message: 'Game ID não fornecido' });
      return;
    }

    const videoRecordingService = require('./videoRecordingService');
    const result = await videoRecordingService.stopRecording(gameId);

    if (result.success) {
      socket.emit('recording_stopped', {
        gameId,
        videoId: result.videoId,
        size: result.size,
        duration: result.duration
      });
      // Notificar oponente
      socket.to(`game_${gameId}`).emit('opponent_recording_stopped', {
        videoId: result.videoId
      });
    } else {
      socket.emit('recording_error', { message: result.message });
    }
  }
}

module.exports = GameSocketService;
