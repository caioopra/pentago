const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  player1: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    playerNumber: {
      type: Number,
      default: 1
    },
    socketId: String,
    connected: {
      type: Boolean,
      default: true
    }
  },
  player2: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    playerNumber: {
      type: Number,
      default: 2
    },
    socketId: String,
    connected: {
      type: Boolean,
      default: false
    }
  },
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['waiting', 'playing', 'finished', 'abandoned'],
    default: 'waiting'
  },
  // Board dividido em 4 quadrantes de 9 células cada
  boardState: {
    type: [[Number]], // Array de 4 arrays com 9 números cada
    default: () => Array(4).fill().map(() => Array(9).fill(0))
  },
  currentTurn: {
    type: Number, // 1 ou 2
    default: 1
  },
  gamePhase: {
    type: String,
    enum: ['place', 'rotate'],
    default: 'place'
  },
  moveHistory: [{
    player: Number,
    action: String, // 'place' ou 'rotate'
    quadrant: Number,
    cell: Number, // para 'place'
    direction: String, // para 'rotate': 'left' ou 'right'
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  result: {
    type: String,
    enum: ['player1_win', 'player2_win', 'draw', 'abandoned']
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Método para verificar se o jogo está ativo
gameSchema.methods.isActive = function() {
  return this.status === 'playing' || this.status === 'waiting';
};

// Método para verificar se é o turno do jogador
gameSchema.methods.isPlayerTurn = function(userId) {
  const player1Id = this.player1.userId.toString();
  const player2Id = this.player2.userId?.toString();

  if (this.currentTurn === 1 && player1Id === userId.toString()) {
    return true;
  }
  if (this.currentTurn === 2 && player2Id === userId.toString()) {
    return true;
  }
  return false;
};

// Método para obter número do jogador por userId
gameSchema.methods.getPlayerNumber = function(userId) {
  const player1Id = this.player1.userId.toString();
  const player2Id = this.player2.userId?.toString();

  if (player1Id === userId.toString()) return 1;
  if (player2Id === userId.toString()) return 2;
  return null;
};

// Método para trocar turno
gameSchema.methods.switchTurn = function() {
  this.currentTurn = this.currentTurn === 1 ? 2 : 1;
  this.gamePhase = 'place';
  this.lastActivity = new Date();
};

// Índice para buscar partidas ativas rapidamente
gameSchema.index({ status: 1, createdAt: -1 });
gameSchema.index({ 'player1.userId': 1, status: 1 });
gameSchema.index({ 'player2.userId': 1, status: 1 });

module.exports = mongoose.model('Game', gameSchema);
