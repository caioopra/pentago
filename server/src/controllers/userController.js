const User = require('../models/User');
const Game = require('../models/Game');
const path = require('path');
const fs = require('fs').promises;

/**
 * @desc    Get all users (with pagination and filters)
 * @route   GET /api/users
 * @access  Private
 */
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = {};

    // Filter by online status if provided
    if (req.query.isOnline !== undefined) {
      query.isOnline = req.query.isOnline === 'true';
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ score: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
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
 * @desc    Get single user by ID
 * @route   GET /api/users/:id
 * @access  Private
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

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);

    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro ao buscar usuário.'
    });
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/users/:id
 * @access  Private (own profile only)
 */
exports.updateUser = async (req, res) => {
  try {
    // Only allow users to update their own profile
    if (req.params.id !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Você só pode atualizar seu próprio perfil.'
      });
    }

    const { name, age, city, state, country } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (age) updateData.age = age;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (country !== undefined) updateData.country = country;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Perfil atualizado com sucesso!',
      data: user
    });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar perfil.'
    });
  }
};

/**
 * @desc    Update user avatar
 * @route   PUT /api/users/:id/avatar
 * @access  Private (own profile only)
 */
exports.updateAvatar = async (req, res) => {
  try {
    // Only allow users to update their own avatar
    if (req.params.id !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Você só pode atualizar seu próprio avatar.'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, envie uma imagem.'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado.'
      });
    }

    // Delete old avatar if it's not the default one
    if (user.avatar && !user.avatar.includes('default')) {
      try {
        const oldAvatarPath = path.join(__dirname, '../..', user.avatar);
        await fs.unlink(oldAvatarPath);
      } catch (err) {
        console.error('Erro ao deletar avatar antigo:', err);
      }
    }

    // Update avatar path
    user.avatar = `/uploads/avatars/${req.file.filename}`;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Avatar atualizado com sucesso!',
      data: {
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar avatar:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar avatar.'
    });
  }
};

/**
 * @desc    Delete user
 * @route   DELETE /api/users/:id
 * @access  Private (own profile only or admin)
 */
exports.deleteUser = async (req, res) => {
  try {
    // Only allow users to delete their own profile
    if (req.params.id !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Você só pode deletar seu próprio perfil.'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado.'
      });
    }

    // Delete avatar if it's not the default one
    if (user.avatar && !user.avatar.includes('default')) {
      try {
        const avatarPath = path.join(__dirname, '../..', user.avatar);
        await fs.unlink(avatarPath);
      } catch (err) {
        console.error('Erro ao deletar avatar:', err);
      }
    }

    await user.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Conta deletada com sucesso.'
    });
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar conta.'
    });
  }
};

/**
 * @desc    Get top players (leaderboard)
 * @route   GET /api/users/leaderboard
 * @access  Public
 */
exports.getLeaderboard = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const users = await User.find()
      .select('name avatar score')
      .sort({ score: -1 })
      .limit(limit);

    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Erro ao buscar ranking:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar ranking.'
    });
  }
};

/**
 * @desc    Get full leaderboard with all users
 * @route   GET /api/users/leaderboard/full
 * @access  Public
 */
exports.getFullLeaderboard = async (req, res) => {
  try {
    // Fetch all non-admin users sorted by score
    const users = await User.find({ role: { $ne: 'admin' } })
      .select('name email avatar score age city state country createdAt')
      .sort({ score: -1, createdAt: 1 });

    // Add rank to each user
    const usersWithRank = users.map((user, index) => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      score: user.score,
      age: user.age,
      city: user.city,
      state: user.state,
      country: user.country,
      createdAt: user.createdAt,
      rank: index + 1
    }));

    res.status(200).json({
      success: true,
      data: {
        users: usersWithRank,
        total: usersWithRank.length
      }
    });
  } catch (error) {
    console.error('Erro ao buscar placar completo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar placar.'
    });
  }
};

/**
 * @desc    Get public user profile with statistics
 * @route   GET /api/users/:id/public
 * @access  Public
 */
exports.getPublicProfile = async (req, res) => {
  try {
    const userId = req.params.id;

    // Get user data (only public fields)
    const user = await User.findById(userId).select('name avatar score city state country createdAt');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado.'
      });
    }

    // Calculate game statistics
    const totalGames = await Game.countDocuments({
      $or: [
        { 'player1.userId': userId },
        { 'player2.userId': userId }
      ],
      status: 'finished'
    });

    const wins = await Game.countDocuments({
      winner: userId,
      status: 'finished'
    });

    const draws = await Game.countDocuments({
      $or: [
        { 'player1.userId': userId },
        { 'player2.userId': userId }
      ],
      status: 'finished',
      result: 'draw'
    });

    const losses = totalGames - wins - draws;

    // Calculate win rate
    const winRate = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : 0;

    // Get user's rank
    const higherRankedUsers = await User.countDocuments({
      score: { $gt: user.score }
    });
    const rank = higherRankedUsers + 1;

    // Get recent games (last 5)
    const recentGames = await Game.find({
      $or: [
        { 'player1.userId': userId },
        { 'player2.userId': userId }
      ],
      status: 'finished'
    })
      .populate('player1.userId', 'name avatar')
      .populate('player2.userId', 'name avatar')
      .populate('winner', 'name')
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('player1 player2 winner result updatedAt videoRecording');

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          avatar: user.avatar,
          score: user.score,
          location: {
            city: user.city,
            state: user.state,
            country: user.country
          },
          memberSince: user.createdAt,
          rank
        },
        statistics: {
          totalGames,
          wins,
          losses,
          draws,
          winRate: parseFloat(winRate)
        },
        recentGames: recentGames.map(game => ({
          id: game._id,
          player1: {
            id: game.player1.userId._id,
            name: game.player1.userId.name,
            avatar: game.player1.userId.avatar
          },
          player2: {
            id: game.player2.userId._id,
            name: game.player2.userId.name,
            avatar: game.player2.userId.avatar
          },
          winner: game.winner ? {
            id: game.winner._id,
            name: game.winner.name
          } : null,
          result: game.result,
          date: game.updatedAt,
          video: game.videoRecording && game.videoRecording.fileId ? {
            id: game.videoRecording.fileId,
            duration: game.videoRecording.duration,
            size: game.videoRecording.size
          } : null
        }))
      }
    });
  } catch (error) {
    console.error('Erro ao buscar perfil público:', error);

    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro ao buscar perfil público.'
    });
  }
};
