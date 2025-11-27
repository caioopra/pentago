const mongoose = require('mongoose');
const User = require('../models/User');
const Game = require('../models/Game');
const Config = require('../models/Config');

/**
 * Serviço de Fila de Jogadores
 * Gerencia a fila de espera e matchmaking automático
 */
class QueueService {
  constructor(io) {
    this.io = io;
    this.queue = []; // Array de objetos: { userId, socketId, username, avatar, joinedAt }
    this.maxQueueSize = 25; // Default value
    this.pendingMatches = new Map(); // matchId -> { player1, player2, confirmations, timer, gameId }
    this.confirmationTimeout = 30000; // 30 seconds

    // Load config from database
    this.loadConfig();
  }

  /**
   * Load configuration from database
   */
  async loadConfig() {
    try {
      const config = await Config.getConfig();
      this.maxQueueSize = config.queue.maxSize;
      console.log(`QueueService config reloaded: max ${this.maxQueueSize} players`);
    } catch (error) {
      console.error('Error loading QueueService config:', error);
    }
  }

  /**
   * Adiciona jogador à fila
   */
  async addToQueue(userId, socketId) {
    try {
      // Verificar se usuário já está na fila
      if (this.isInQueue(userId)) {
        return {
          success: false,
          message: 'Você já está na fila.'
        };
      }

      // Verificar se fila está cheia
      if (this.queue.length >= this.maxQueueSize) {
        return {
          success: false,
          message: `A fila está cheia (máximo ${this.maxQueueSize} jogadores).`
        };
      }

      // Verificar se usuário já está em uma partida ativa
      const existingGame = await Game.findOne({
        $or: [
          { 'player1.userId': userId, status: { $in: ['waiting', 'playing'] } },
          { 'player2.userId': userId, status: { $in: ['waiting', 'playing'] } }
        ]
      });

      if (existingGame) {
        return {
          success: false,
          message: 'Você já está em uma partida ativa.',
          gameId: existingGame._id
        };
      }

      // Buscar dados do usuário
      const user = await User.findById(userId);
      if (!user) {
        return {
          success: false,
          message: 'Usuário não encontrado.'
        };
      }

      // Adicionar à fila
      const queueEntry = {
        userId: userId.toString(),
        socketId,
        username: user.name,
        avatar: user.avatar,
        score: user.score,
        joinedAt: new Date()
      };

      this.queue.push(queueEntry);

      console.log(`👥 Jogador ${user.name} entrou na fila (${this.queue.length}/${this.maxQueueSize})`);

      // Notificar todos sobre atualização da fila
      this.broadcastQueueUpdate();

      // Tentar fazer match
      await this.tryMatch();

      return {
        success: true,
        message: 'Você entrou na fila de espera.',
        position: this.queue.length,
        queueSize: this.queue.length
      };
    } catch (error) {
      console.error('Erro ao adicionar jogador à fila:', error);
      return {
        success: false,
        message: 'Erro ao entrar na fila.'
      };
    }
  }

  /**
   * Remove jogador da fila
   */
  removeFromQueue(userId) {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(player => player.userId !== userId.toString());

    if (this.queue.length < initialLength) {
      console.log(`👋 Jogador saiu da fila (${this.queue.length}/${this.maxQueueSize})`);
      this.broadcastQueueUpdate();
      return {
        success: true,
        message: 'Você saiu da fila.'
      };
    }

    return {
      success: false,
      message: 'Você não está na fila.'
    };
  }

  /**
   * Remove jogador pelo socketId (quando desconecta)
   */
  removeBySocketId(socketId) {
    const player = this.queue.find(p => p.socketId === socketId);
    if (player) {
      this.removeFromQueue(player.userId);
    }
  }

  /**
   * Verifica se usuário está na fila
   */
  isInQueue(userId) {
    return this.queue.some(player => player.userId === userId.toString());
  }

  /**
   * Obtém posição do jogador na fila
   */
  getPosition(userId) {
    const index = this.queue.findIndex(player => player.userId === userId.toString());
    return index === -1 ? null : index + 1;
  }

  /**
   * Obtém informações da fila
   */
  getQueueInfo() {
    return {
      players: this.queue.map(p => ({
        username: p.username,
        avatar: p.avatar,
        score: p.score,
        waitingTime: Math.floor((new Date() - p.joinedAt) / 1000) // segundos
      })),
      size: this.queue.length,
      maxSize: this.maxQueueSize
    };
  }

  /**
   * Tenta fazer match entre 2 jogadores
   */
  async tryMatch() {
    // Precisa de pelo menos 2 jogadores
    if (this.queue.length < 2) {
      return;
    }

    try {
      // Pegar os 2 primeiros da fila (FIFO)
      const player1Entry = this.queue.shift();
      const player2Entry = this.queue.shift();

      console.log(`🎮 Match encontrado! ${player1Entry.username} vs ${player2Entry.username}`);

      // Criar partida temporária (converter strings de volta para ObjectId)
      const game = await Game.create({
        player1: {
          userId: new mongoose.Types.ObjectId(player1Entry.userId),
          socketId: player1Entry.socketId,
          connected: false
        },
        player2: {
          userId: new mongoose.Types.ObjectId(player2Entry.userId),
          socketId: player2Entry.socketId,
          connected: false
        },
        status: 'pending_confirmation' // New status for confirmation phase
      });

      // Populate para ter os dados completos
      await game.populate('player1.userId', 'name avatar score');
      await game.populate('player2.userId', 'name avatar score');

      // Generate match ID
      const matchId = game._id.toString();

      // Store pending match
      this.pendingMatches.set(matchId, {
        player1: player1Entry,
        player2: player2Entry,
        confirmations: new Set(),
        gameId: game._id,
        createdAt: Date.now()
      });

      // Notificar ambos jogadores - requerir confirmação
      this.io.to(player1Entry.socketId).emit('match_found', {
        matchId,
        gameId: game._id,
        playerNumber: 1,
        opponent: {
          username: player2Entry.username,
          avatar: player2Entry.avatar,
          score: player2Entry.score
        },
        timeout: this.confirmationTimeout / 1000,
        message: 'Partida encontrada! Confirme para jogar.'
      });

      this.io.to(player2Entry.socketId).emit('match_found', {
        matchId,
        gameId: game._id,
        playerNumber: 2,
        opponent: {
          username: player1Entry.username,
          avatar: player1Entry.avatar,
          score: player1Entry.score
        },
        timeout: this.confirmationTimeout / 1000,
        message: 'Partida encontrada! Confirme para jogar.'
      });

      // Set timeout for confirmation
      const timer = setTimeout(() => {
        this.handleMatchTimeout(matchId);
      }, this.confirmationTimeout);

      this.pendingMatches.get(matchId).timer = timer;

      // Atualizar fila
      this.broadcastQueueUpdate();

      console.log(`⏳ Aguardando confirmação para partida ${matchId}`);

      // Se ainda tem 2+ jogadores, tentar outro match
      if (this.queue.length >= 2) {
        setTimeout(() => this.tryMatch(), 1000);
      }
    } catch (error) {
      console.error('Erro ao fazer match:', error);
    }
  }

  /**
   * Confirma participação do jogador na partida
   */
  async confirmMatch(userId, matchId) {
    const match = this.pendingMatches.get(matchId);

    if (!match) {
      return {
        success: false,
        message: 'Partida não encontrada ou já expirou.'
      };
    }

    // Add confirmation
    match.confirmations.add(userId.toString());

    console.log(`✅ Jogador ${userId} confirmou partida ${matchId} (${match.confirmations.size}/2)`);

    // Check if both players confirmed
    if (match.confirmations.size === 2) {
      clearTimeout(match.timer);
      await this.startConfirmedMatch(matchId);
      return {
        success: true,
        message: 'Partida confirmada! Iniciando...'
      };
    }

    return {
      success: true,
      message: 'Aguardando confirmação do oponente...'
    };
  }

  /**
   * Inicia partida após ambos confirmarem
   */
  async startConfirmedMatch(matchId) {
    const match = this.pendingMatches.get(matchId);

    if (!match) {
      console.error(`❌ Match ${matchId} não encontrado`);
      return;
    }

    try {
      // Update game status to 'playing' when both confirm
      await Game.findByIdAndUpdate(match.gameId, {
        status: 'playing'
      });

      const game = await Game.findById(match.gameId)
        .populate('player1.userId', 'name avatar score')
        .populate('player2.userId', 'name avatar score');

      // Notify both players that match is starting
      this.io.to(match.player1.socketId).emit('match_confirmed', {
        gameId: game._id,
        playerNumber: 1,
        game: game
      });

      this.io.to(match.player2.socketId).emit('match_confirmed', {
        gameId: game._id,
        playerNumber: 2,
        game: game
      });

      console.log(`✅ Partida ${matchId} confirmada e iniciada com status 'playing'`);

      // Remove from pending matches
      this.pendingMatches.delete(matchId);

    } catch (error) {
      console.error('Erro ao iniciar partida confirmada:', error);
      this.handleMatchTimeout(matchId);
    }
  }

  /**
   * Trata timeout de confirmação
   */
  async handleMatchTimeout(matchId) {
    const match = this.pendingMatches.get(matchId);

    if (!match) {
      return;
    }

    console.log(`⏰ Timeout de confirmação para partida ${matchId}`);

    // Cancel game
    try {
      await Game.findByIdAndUpdate(match.gameId, {
        status: 'cancelled'
      });
    } catch (error) {
      console.error('Erro ao cancelar partida:', error);
    }

    // Notify players
    const player1Confirmed = match.confirmations.has(match.player1.userId);
    const player2Confirmed = match.confirmations.has(match.player2.userId);

    if (!player1Confirmed) {
      this.io.to(match.player1.socketId).emit('match_cancelled', {
        reason: 'timeout',
        message: 'Você não confirmou a partida a tempo.'
      });
    } else {
      // Player 1 confirmed but player 2 didn't - return player 1 to queue
      this.queue.unshift(match.player1);
      this.io.to(match.player1.socketId).emit('match_cancelled', {
        reason: 'opponent_timeout',
        message: 'O oponente não confirmou. Você foi retornado ao início da fila.'
      });
    }

    if (!player2Confirmed) {
      this.io.to(match.player2.socketId).emit('match_cancelled', {
        reason: 'timeout',
        message: 'Você não confirmou a partida a tempo.'
      });
    } else {
      // Player 2 confirmed but player 1 didn't - return player 2 to queue
      this.queue.unshift(match.player2);
      this.io.to(match.player2.socketId).emit('match_cancelled', {
        reason: 'opponent_timeout',
        message: 'O oponente não confirmou. Você foi retornado ao início da fila.'
      });
    }

    // Remove from pending matches
    this.pendingMatches.delete(matchId);

    // Update queue
    this.broadcastQueueUpdate();

    // Try to match again if there are players waiting
    if (this.queue.length >= 2) {
      setTimeout(() => this.tryMatch(), 1000);
    }
  }

  /**
   * Jogador declina a partida
   */
  async declineMatch(userId, matchId) {
    const match = this.pendingMatches.get(matchId);

    if (!match) {
      return {
        success: false,
        message: 'Partida não encontrada.'
      };
    }

    clearTimeout(match.timer);

    // Cancel game
    try {
      await Game.findByIdAndUpdate(match.gameId, {
        status: 'cancelled'
      });
    } catch (error) {
      console.error('Erro ao cancelar partida:', error);
    }

    // Determine which player declined
    const player1Declined = match.player1.userId === userId.toString();
    const otherPlayer = player1Declined ? match.player2 : match.player1;

    // Return other player to front of queue
    this.queue.unshift(otherPlayer);

    // Notify other player
    this.io.to(otherPlayer.socketId).emit('match_cancelled', {
      reason: 'opponent_declined',
      message: 'O oponente recusou a partida. Você foi retornado ao início da fila.'
    });

    console.log(`❌ Jogador ${userId} recusou partida ${matchId}`);

    // Remove from pending matches
    this.pendingMatches.delete(matchId);

    // Update queue
    this.broadcastQueueUpdate();

    // Try to match again
    if (this.queue.length >= 2) {
      setTimeout(() => this.tryMatch(), 500);
    }

    return {
      success: true,
      message: 'Você recusou a partida.'
    };
  }

  /**
   * Broadcast atualização da fila para todos
   */
  broadcastQueueUpdate() {
    const queueInfo = this.getQueueInfo();
    this.io.emit('queue_updated', queueInfo);
  }

  /**
   * Limpar fila (admin/manutenção)
   */
  clearQueue() {
    const count = this.queue.length;
    this.queue = [];
    this.broadcastQueueUpdate();
    console.log(`🧹 Fila limpa (${count} jogadores removidos)`);
    return {
      success: true,
      message: `Fila limpa. ${count} jogadores removidos.`
    };
  }

  /**
   * Estatísticas da fila
   */
  getStats() {
    if (this.queue.length === 0) {
      return {
        currentSize: 0,
        maxSize: this.maxQueueSize,
        averageWaitTime: 0,
        oldestPlayer: null
      };
    }

    const now = new Date();
    const waitTimes = this.queue.map(p => (now - p.joinedAt) / 1000);
    const averageWaitTime = waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length;
    const oldestPlayer = this.queue.reduce((oldest, current) =>
      current.joinedAt < oldest.joinedAt ? current : oldest
    );

    return {
      currentSize: this.queue.length,
      maxSize: this.maxQueueSize,
      averageWaitTime: Math.floor(averageWaitTime),
      oldestPlayer: {
        username: oldestPlayer.username,
        waitingTime: Math.floor((now - oldestPlayer.joinedAt) / 1000)
      }
    };
  }
}

module.exports = QueueService;
