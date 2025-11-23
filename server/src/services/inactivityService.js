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

    console.log('InactivityService started');
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('InactivityService stopped');
    }
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
      const game = await Game.findById(gameId).populate('player1 player2');
      if (!game) {
        console.log(`Game ${gameId} not found for timeout handling`);
        return;
      }

      // Only handle timeouts for active games
      if (game.status !== 'active') {
        return;
      }

      // Determine which player timed out
      const isPlayer1 = game.player1._id.toString() === userId;
      const isPlayer2 = game.player2._id.toString() === userId;

      if (!isPlayer1 && !isPlayer2) {
        console.log(`User ${userId} is not a player in game ${gameId}`);
        return;
      }

      // Determine winner (the opponent)
      const winner = isPlayer1 ? game.player2._id : game.player1._id;
      const timedOutPlayer = isPlayer1 ? game.player1 : game.player2;

      // Update game status
      game.status = 'finished';
      game.winner = winner;
      game.endedAt = new Date();
      await game.save();

      // Update user stats
      const User = require('../models/User');
      await User.findByIdAndUpdate(winner, {
        $inc: { wins: 1, totalGames: 1 }
      });
      await User.findByIdAndUpdate(timedOutPlayer._id, {
        $inc: { losses: 1, totalGames: 1 }
      });

      // Notify both players via Socket.io
      this.io.to(`game_${gameId}`).emit('player_timeout', {
        gameId,
        timedOutPlayer: {
          id: timedOutPlayer._id,
          username: timedOutPlayer.username
        },
        winner: {
          id: winner,
          username: isPlayer1 ? game.player2.username : game.player1.username
        },
        message: `${timedOutPlayer.username} foi desconectado por inatividade. ${isPlayer1 ? game.player2.username : game.player1.username} venceu!`
      });

      // Remove both players from tracking since game ended
      this.untrackPlayer(gameId, game.player1._id.toString());
      this.untrackPlayer(gameId, game.player2._id.toString());

      console.log(`Game ${gameId} ended due to timeout. Winner: ${winner}`);
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
}

module.exports = InactivityService;
