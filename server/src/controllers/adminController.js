const User = require('../models/User');
const Game = require('../models/Game');
const Config = require('../models/Config');

/**
 * @desc    Obter todos os usuários (com paginação e filtros)
 * @route   GET /api/admin/users
 * @access  Private/Admin
 */
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    // Filtros
    const filter = {};
    if (req.query.role) {
      filter.role = req.query.role;
    }
    if (req.query.isBanned === 'true') {
      filter.isBanned = true;
    } else if (req.query.isBanned === 'false') {
      filter.isBanned = false;
    }
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar usuários.'
    });
  }
};

/**
 * @desc    Obter detalhes de um usuário específico
 * @route   GET /api/admin/users/:id
 * @access  Private/Admin
 */
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado.'
      });
    }

    // Buscar estatísticas de jogos do usuário
    const gamesPlayed = await Game.countDocuments({
      $or: [
        { 'player1.userId': user._id },
        { 'player2.userId': user._id }
      ],
      status: 'finished'
    });

    const gamesWon = await Game.countDocuments({
      winner: user._id
    });

    res.json({
      success: true,
      data: {
        user,
        stats: {
          gamesPlayed,
          gamesWon,
          winRate: gamesPlayed > 0 ? ((gamesWon / gamesPlayed) * 100).toFixed(1) : 0
        }
      }
    });
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar usuário.'
    });
  }
};

/**
 * @desc    Banir um usuário
 * @route   PUT /api/admin/users/:id/ban
 * @access  Private/Admin
 */
exports.banUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado.'
      });
    }

    // Não permitir banir administradores
    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Não é possível banir um administrador.'
      });
    }

    // Não permitir banir a si mesmo
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Você não pode banir a si mesmo.'
      });
    }

    user.isBanned = true;
    user.banReason = req.body.reason || 'Motivo não especificado';
    user.isOnline = false;
    await user.save();

    res.json({
      success: true,
      message: `Usuário ${user.name} foi banido.`,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isBanned: user.isBanned,
        banReason: user.banReason
      }
    });
  } catch (error) {
    console.error('Erro ao banir usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao banir usuário.'
    });
  }
};

/**
 * @desc    Desbanir um usuário
 * @route   PUT /api/admin/users/:id/unban
 * @access  Private/Admin
 */
exports.unbanUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado.'
      });
    }

    user.isBanned = false;
    user.banReason = '';
    await user.save();

    res.json({
      success: true,
      message: `Usuário ${user.name} foi desbanido.`,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isBanned: user.isBanned
      }
    });
  } catch (error) {
    console.error('Erro ao desbanir usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao desbanir usuário.'
    });
  }
};

/**
 * @desc    Deletar um usuário
 * @route   DELETE /api/admin/users/:id
 * @access  Private/Admin
 */
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado.'
      });
    }

    // Não permitir deletar administradores
    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Não é possível deletar um administrador.'
      });
    }

    // Não permitir deletar a si mesmo
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Você não pode deletar a si mesmo.'
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: `Usuário ${user.name} foi deletado.`
    });
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar usuário.'
    });
  }
};

/**
 * @desc    Promover usuário a admin
 * @route   PUT /api/admin/users/:id/promote
 * @access  Private/Admin
 */
exports.promoteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado.'
      });
    }

    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Usuário já é administrador.'
      });
    }

    user.role = 'admin';
    await user.save();

    res.json({
      success: true,
      message: `Usuário ${user.name} foi promovido a administrador.`,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Erro ao promover usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao promover usuário.'
    });
  }
};

/**
 * @desc    Rebaixar admin a usuário
 * @route   PUT /api/admin/users/:id/demote
 * @access  Private/Admin
 */
exports.demoteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado.'
      });
    }

    // Não permitir rebaixar a si mesmo
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Você não pode rebaixar a si mesmo.'
      });
    }

    if (user.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Usuário não é administrador.'
      });
    }

    user.role = 'user';
    await user.save();

    res.json({
      success: true,
      message: `Usuário ${user.name} foi rebaixado a usuário comum.`,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Erro ao rebaixar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao rebaixar usuário.'
    });
  }
};

/**
 * @desc    Obter estatísticas do sistema
 * @route   GET /api/admin/stats
 * @access  Private/Admin
 */
exports.getStats = async (req, res) => {
  try {
    // Estatísticas de usuários
    const totalUsers = await User.countDocuments();
    const onlineUsers = await User.countDocuments({ isOnline: true });
    const bannedUsers = await User.countDocuments({ isBanned: true });
    const adminUsers = await User.countDocuments({ role: 'admin' });

    // Estatísticas de jogos
    const totalGames = await Game.countDocuments();
    const activeGames = await Game.countDocuments({
      status: { $in: ['waiting', 'playing'] }
    });
    const finishedGames = await Game.countDocuments({ status: 'finished' });

    // Novos usuários (últimos 7 dias)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newUsers = await User.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    // Jogos recentes (últimos 7 dias)
    const recentGames = await Game.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    // Top 5 jogadores por pontuação
    const topPlayers = await User.find()
      .select('name avatar score')
      .sort({ score: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          online: onlineUsers,
          banned: bannedUsers,
          admins: adminUsers,
          newLastWeek: newUsers
        },
        games: {
          total: totalGames,
          active: activeGames,
          finished: finishedGames,
          recentLastWeek: recentGames
        },
        topPlayers
      }
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter estatísticas.'
    });
  }
};

/**
 * @desc    Obter configurações do sistema
 * @route   GET /api/admin/config
 * @access  Private/Admin
 */
exports.getConfig = async (req, res) => {
  try {
    const config = await Config.getConfig();

    res.json({
      success: true,
      data: {
        defaultAvatar: config.defaultAvatar,
        inactivity: config.inactivity,
        queue: config.queue,
        video: config.video,
        upload: config.upload,
        rateLimit: config.rateLimit
      }
    });
  } catch (error) {
    console.error('Erro ao obter configurações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter configurações.'
    });
  }
};

/**
 * @desc    Atualizar configurações do sistema
 * @route   PUT /api/admin/config
 * @access  Private/Admin
 */
exports.updateConfig = async (req, res) => {
  try {
    const updates = {};

    // Validar e preparar updates
    if (req.body.defaultAvatar !== undefined) {
      updates.defaultAvatar = req.body.defaultAvatar;
    }

    if (req.body.inactivity) {
      updates.inactivity = {};
      if (req.body.inactivity.timeoutSeconds !== undefined) {
        const timeout = parseInt(req.body.inactivity.timeoutSeconds, 10);
        if (timeout < 10 || timeout > 300) {
          return res.status(400).json({
            success: false,
            message: 'Tempo de inatividade deve estar entre 10 e 300 segundos.'
          });
        }
        updates.inactivity.timeoutSeconds = timeout;
      }
    }

    if (req.body.queue) {
      updates.queue = {};
      if (req.body.queue.maxSize !== undefined) {
        const maxSize = parseInt(req.body.queue.maxSize, 10);
        if (maxSize < 0 || maxSize > 100) {
          return res.status(400).json({
            success: false,
            message: 'Tamanho máximo da fila deve estar entre 0 e 100 (0 desabilita a fila).'
          });
        }
        updates.queue.maxSize = maxSize;
      }
    }

    if (req.body.video) {
      updates.video = {};
      if (req.body.video.maxAgeDays !== undefined) {
        const maxAge = parseInt(req.body.video.maxAgeDays, 10);
        if (maxAge < 1 || maxAge > 90) {
          return res.status(400).json({
            success: false,
            message: 'Idade máxima do vídeo deve estar entre 1 e 90 dias.'
          });
        }
        updates.video.maxAgeDays = maxAge;
      }
      if (req.body.video.maxSizeGB !== undefined) {
        const maxSize = parseFloat(req.body.video.maxSizeGB);
        if (maxSize < 0.1 || maxSize > 10) {
          return res.status(400).json({
            success: false,
            message: 'Tamanho máximo do vídeo deve estar entre 0.1 e 10 GB.'
          });
        }
        updates.video.maxSizeGB = maxSize;
      }
      if (req.body.video.fps !== undefined) {
        const fps = parseInt(req.body.video.fps, 10);
        if (fps < 15 || fps > 60) {
          return res.status(400).json({
            success: false,
            message: 'FPS deve estar entre 15 e 60.'
          });
        }
        updates.video.fps = fps;
      }
      if (req.body.video.bitrate !== undefined) {
        updates.video.bitrate = req.body.video.bitrate;
      }
    }

    if (req.body.upload) {
      updates.upload = {};
      if (req.body.upload.maxSizeMB !== undefined) {
        const maxSize = parseInt(req.body.upload.maxSizeMB, 10);
        if (maxSize < 1 || maxSize > 50) {
          return res.status(400).json({
            success: false,
            message: 'Tamanho máximo de upload deve estar entre 1 e 50 MB.'
          });
        }
        updates.upload.maxSizeMB = maxSize;
      }
    }

    const config = await Config.updateConfig(updates);

    // Reload configurations in services if they were updated
    if (updates.queue) {
      const { gameSocketService } = require('../app');
      const queueService = gameSocketService.getQueueService();
      await queueService.loadConfig();
    }

    if (updates.inactivity) {
      const { gameSocketService } = require('../app');
      const inactivityService = gameSocketService.inactivityService;
      await inactivityService.loadConfig();
    }

    res.json({
      success: true,
      message: 'Configurações atualizadas com sucesso.',
      data: {
        defaultAvatar: config.defaultAvatar,
        inactivity: config.inactivity,
        queue: config.queue,
        video: config.video,
        upload: config.upload,
        rateLimit: config.rateLimit
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar configurações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar configurações.'
    });
  }
};

/**
 * @desc    Obter lista de jogos (com paginação)
 * @route   GET /api/admin/games
 * @access  Private/Admin
 */
exports.getGames = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    // Filtros
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const games = await Game.find(filter)
      .populate('player1.userId', 'name email avatar')
      .populate('player2.userId', 'name email avatar')
      .populate('winner', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Game.countDocuments(filter);

    res.json({
      success: true,
      data: games,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao buscar jogos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar jogos.'
    });
  }
};

/**
 * @desc    Deletar um jogo
 * @route   DELETE /api/admin/games/:id
 * @access  Private/Admin
 */
exports.deleteGame = async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);

    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Jogo não encontrado.'
      });
    }

    await Game.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Jogo deletado com sucesso.'
    });
  } catch (error) {
    console.error('Erro ao deletar jogo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar jogo.'
    });
  }
};
