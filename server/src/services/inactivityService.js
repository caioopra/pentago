const Game = require('../models/Game');

/**
 * Service to track player inactivity and disconnect inactive players
 */
class InactivityService {
  constructor(io) {
    this.io = io;
    this.playerActivity = new Map(); // Map<gameId_userId, timestamp>
    this.checkInterval = null;
    this.timeoutSeconds = parseInt(process.env.INACTIVITY_TIMEOUT_SECONDS) || 60;

    console.log(`InactivityService initialized with ${this.timeoutSeconds}s timeout`);
  }

  /**
   * Start monitoring player inactivity
   */
  start() {
    if (this.checkInterval) {
      return;
    }

    // Check every 10 seconds
    this.checkInterval = setInterval(() => {
      this.checkInactivity();
    }, 10000);

    // Cleanup stale games every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleGames();
    }, 5 * 60 * 1000);

    console.log('InactivityService started');
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    console.log('InactivityService stopped');
  }

  /**
   * Update last activity timestamp for a player in a game
   * @param {String} gameId
   * @param {String} userId
   */
  updateActivity(gameId, userId) {
    if (!gameId || !userId) return;

    const key = `${gameId}_${userId}`;
    this.playerActivity.set(key, Date.now());
  }

  /**
   * Track a player joining a game
   * @param {String} gameId
   * @param {String} userId
   */
  trackPlayer(gameId, userId) {
    this.updateActivity(gameId, userId);
  }

  /**
   * Remove tracking for a player
   * @param {String} gameId
   * @param {String} userId
   */
  untrackPlayer(gameId, userId) {
    if (!gameId || !userId) return;

    const key = `${gameId}_${userId}`;
    this.playerActivity.delete(key);
  }

  /**
   * Check all tracked players for inactivity
   */
  async checkInactivity() {
    const now = Date.now();
    const timeoutMs = this.timeoutSeconds * 1000;

    for (const [key, lastActivity] of this.playerActivity.entries()) {
      const timeSinceActivity = now - lastActivity;

      if (timeSinceActivity > timeoutMs) {
        // Player is inactive, handle timeout
        const [gameId, userId] = key.split('_');
        await this.handleTimeout(gameId, userId);
      }
    }
  }

  /**
   * Handle player timeout
   * @param {String} gameId
   * @param {String} userId
   */
  async handleTimeout(gameId, userId) {
    try {
      console.log(`Player ${userId} timed out in game ${gameId}`);

      // Remove from tracking
      this.untrackPlayer(gameId, userId);

      // Find the game
      const game = await Game.findById(gameId)
        .populate('player1.userId', 'name')
        .populate('player2.userId', 'name');

      if (!game) {
        console.log(`Game ${gameId} not found for timeout handling`);
        return;
      }

      // Only handle timeouts for active games (waiting or playing)
      if (!game.isActive()) {
        return;
      }

      // Determine which player timed out
      const player1Id = game.player1.userId._id || game.player1.userId;
      const player2Id = game.player2.userId._id || game.player2.userId;

      const isPlayer1 = player1Id.toString() === userId;
      const isPlayer2 = player2Id.toString() === userId;

      if (!isPlayer1 && !isPlayer2) {
        console.log(`User ${userId} is not a player in game ${gameId}`);
        return;
      }

      // Determine winner (the opponent) and loser
      const winnerId = isPlayer1 ? player2Id : player1Id;
      const loserId = isPlayer1 ? player1Id : player2Id;
      const timedOutPlayerName = isPlayer1
        ? (game.player1.userId.name || 'Jogador 1')
        : (game.player2.userId.name || 'Jogador 2');
      const winnerName = isPlayer1
        ? (game.player2.userId.name || 'Jogador 2')
        : (game.player1.userId.name || 'Jogador 1');

      // Update game status
      game.status = 'finished';
      game.winner = winnerId;
      game.result = isPlayer1 ? 'player2_win' : 'player1_win';
      await game.save();

      // Update player scores (winner gets +3 points)
      const User = require('../models/User');
      await User.findByIdAndUpdate(winnerId, { $inc: { score: 3 } });
      console.log(`📊 ${winnerName} recebeu +3 pontos por vitória (timeout do oponente)`);

      // Notify both players via Socket.io
      this.io.to(`game_${gameId}`).emit('player_timeout', {
        gameId,
        timedOutPlayer: {
          id: loserId.toString(),
          username: timedOutPlayerName
        },
        winner: {
          id: winnerId.toString(),
          username: winnerName
        },
        message: `${timedOutPlayerName} foi desconectado por inatividade. ${winnerName} venceu!`
      });

      // Remove both players from tracking since game ended
      this.untrackPlayer(gameId, player1Id.toString());
      this.untrackPlayer(gameId, player2Id.toString());

      console.log(`Game ${gameId} ended due to timeout. Winner: ${winnerName}`);
    } catch (error) {
      console.error('Error handling player timeout:', error);
    }
  }

  /**
   * Get remaining time before timeout for a player
   * @param {String} gameId
   * @param {String} userId
   * @returns {Number} Seconds remaining, or null if not tracked
   */
  getRemainingTime(gameId, userId) {
    const key = `${gameId}_${userId}`;
    const lastActivity = this.playerActivity.get(key);

    if (!lastActivity) {
      return null;
    }

    const timeSinceActivity = Date.now() - lastActivity;
    const timeoutMs = this.timeoutSeconds * 1000;
    const remainingMs = timeoutMs - timeSinceActivity;

    return Math.max(0, Math.floor(remainingMs / 1000));
  }

  /**
   * Clean up stale games (waiting too long or both players disconnected)
   */
  async cleanupStaleGames() {
    try {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

      // Delete games that:
      // 1. Are in 'waiting' status and older than 15 minutes
      // 2. Both players are disconnected
      const result = await Game.deleteMany({
        $or: [
          {
            status: 'waiting',
            createdAt: { $lt: fifteenMinutesAgo }
          },
          {
            status: { $in: ['waiting', 'playing'] },
            'player1.connected': false,
            'player2.connected': false
          }
        ]
      });

      if (result.deletedCount > 0) {
        console.log(`🧹 Cleaned up ${result.deletedCount} stale game(s)`);
      }
    } catch (error) {
      console.error('Error cleaning up stale games:', error);
    }
  }
}

module.exports = InactivityService;
