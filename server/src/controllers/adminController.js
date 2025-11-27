const User = require('../models/User');
const Game = require('../models/Game');

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
    // Retornar configurações atuais do sistema
    res.json({
      success: true,
      data: {
        game: {
          maxQueueSize: parseInt(process.env.MAX_QUEUE_SIZE, 10) || 25,
          inactivityTimeout: parseInt(process.env.INACTIVITY_TIMEOUT_SECONDS, 10) || 60,
          maxGameDuration: parseInt(process.env.MAX_GAME_DURATION_MINUTES, 10) || 60
        },
        video: {
          maxAgeDays: parseInt(process.env.MAX_VIDEO_AGE_DAYS, 10) || 15,
          maxSizeGB: parseInt(process.env.MAX_VIDEO_SIZE_GB, 10) || 1,
          fps: parseInt(process.env.VIDEO_FPS, 10) || 24,
          bitrate: process.env.VIDEO_BITRATE || '4000k'
        },
        upload: {
          maxSizeMB: parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10) || 10
        },
        rateLimit: {
          windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
          maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100
        }
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
