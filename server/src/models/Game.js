const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  player1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  player2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['waiting', 'playing', 'finished'],
    default: 'waiting'
  },
  boardState: {
    type: Array,
    default: []
  },
  currentTurn: {
    type: String,
    enum: ['player1', 'player2'],
    default: 'player1'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Game', gameSchema);
