const mongoose = require('mongoose');

/**
 * Model de configurações do sistema
 * Singleton - apenas um documento existirá na coleção
 */
const configSchema = new mongoose.Schema({
  // Avatar padrão
  defaultAvatar: {
    type: String,
    default: '/assets/img/avatars/default.png'
  },

  // Configurações de inatividade
  inactivity: {
    timeoutSeconds: {
      type: Number,
      default: 60,
      min: 10,
      max: 300
    }
  },

  // Configurações da fila
  queue: {
    maxSize: {
      type: Number,
      default: 25,
      min: 2,
      max: 100
    }
  },

  // Configurações de vídeo
  video: {
    maxAgeDays: {
      type: Number,
      default: 15,
      min: 1,
      max: 90
    },
    maxSizeGB: {
      type: Number,
      default: 1,
      min: 0.1,
      max: 10
    },
    fps: {
      type: Number,
      default: 24,
      min: 15,
      max: 60
    },
    bitrate: {
      type: String,
      default: '4000k'
    }
  },

  // Configurações de upload
  upload: {
    maxSizeMB: {
      type: Number,
      default: 10,
      min: 1,
      max: 50
    }
  },

  // Configurações de rate limit
  rateLimit: {
    windowMs: {
      type: Number,
      default: 900000 // 15 minutos
    },
    maxRequests: {
      type: Number,
      default: 100
    }
  }
}, {
  timestamps: true
});

// Método estático para obter ou criar a configuração (singleton)
configSchema.statics.getConfig = async function() {
  let config = await this.findOne();

  if (!config) {
    config = await this.create({});
  }

  return config;
};

// Método estático para atualizar configuração
configSchema.statics.updateConfig = async function(updates) {
  let config = await this.getConfig();

  // Atualizar campos aninhados
  if (updates.inactivity) {
    config.inactivity = { ...config.inactivity, ...updates.inactivity };
  }
  if (updates.queue) {
    config.queue = { ...config.queue, ...updates.queue };
  }
  if (updates.video) {
    config.video = { ...config.video, ...updates.video };
  }
  if (updates.upload) {
    config.upload = { ...config.upload, ...updates.upload };
  }
  if (updates.rateLimit) {
    config.rateLimit = { ...config.rateLimit, ...updates.rateLimit };
  }
  if (updates.defaultAvatar !== undefined) {
    config.defaultAvatar = updates.defaultAvatar;
  }

  await config.save();
  return config;
};

module.exports = mongoose.model('Config', configSchema);
