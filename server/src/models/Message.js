const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 500,
    trim: true
  },
  channel: {
    type: String,
    enum: ['lobby', 'game'],
    required: true
  },
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    // Obrigatório apenas se channel === 'game'
    required: function() {
      return this.channel === 'game';
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Índices para queries eficientes
messageSchema.index({ channel: 1, createdAt: -1 });
messageSchema.index({ gameId: 1, createdAt: -1 });
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 }); // TTL index

module.exports = mongoose.model('Message', messageSchema);
