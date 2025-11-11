const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Game = require('../models/Game');

/**
 * Simple database viewer for development
 * WARNING: Remove this in production!
 */

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json({
      count: users.length,
      users: users
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all games
router.get('/games', async (req, res) => {
  try {
    const games = await Game.find().populate('player1 player2 winner', 'name email');
    res.json({
      count: games.length,
      games: games
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Database stats
router.get('/stats', async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const gameCount = await Game.countDocuments();
    const onlineUsers = await User.countDocuments({ isOnline: true });

    res.json({
      database: 'pentago',
      collections: {
        users: userCount,
        games: gameCount
      },
      onlineUsers: onlineUsers
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
