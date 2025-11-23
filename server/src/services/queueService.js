const User = require('../models/User');
const Game = require('../models/Game');

/**
 * Serviço de Fila de Jogadores
 * Gerencia a fila de espera e matchmaking automático
 */
class QueueService {
  constructor(io) {
    this.io = io;
    this.queue = []; // Array de objetos: { userId, socketId, username, avatar, joinedAt }
    this.maxQueueSize = parseInt(process.env.MAX_QUEUE_SIZE) || 25;
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

      // Criar partida
      const game = await Game.create({
        player1: {
          userId: player1Entry.userId,
          socketId: player1Entry.socketId,
          connected: false
        },
        player2: {
          userId: player2Entry.userId,
          socketId: player2Entry.socketId,
          connected: false
        },
        status: 'waiting'
      });

      // Populate para ter os dados completos
      await game.populate('player1.userId', 'name avatar score');
      await game.populate('player2.userId', 'name avatar score');

      // Notificar ambos jogadores
      this.io.to(player1Entry.socketId).emit('match_found', {
        gameId: game._id,
        playerNumber: 1,
        opponent: {
          username: player2Entry.username,
          avatar: player2Entry.avatar,
          score: player2Entry.score
        },
        message: 'Partida encontrada! Conectando...'
      });

      this.io.to(player2Entry.socketId).emit('match_found', {
        gameId: game._id,
        playerNumber: 2,
        opponent: {
          username: player1Entry.username,
          avatar: player1Entry.avatar,
          score: player1Entry.score
        },
        message: 'Partida encontrada! Conectando...'
      });

      // Atualizar fila
      this.broadcastQueueUpdate();

      console.log(`✅ Partida ${game._id} criada via matchmaking`);

      // Se ainda tem 2+ jogadores, tentar outro match
      if (this.queue.length >= 2) {
        setTimeout(() => this.tryMatch(), 1000);
      }
    } catch (error) {
      console.error('Erro ao fazer match:', error);

      // Em caso de erro, devolver jogadores à fila
      // (eles podem tentar novamente)
    }
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
