const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getUsers,
  getUser,
  updateUser,
  updateAvatar,
  deleteUser,
  getLeaderboard
} = require('../controllers/userController');

// Public routes
router.get('/leaderboard', getLeaderboard);

// Protected routes
router.use(protect); // All routes below require authentication

router.get('/', getUsers);
router.get('/:id', getUser);
router.put('/:id', updateUser);
router.put('/:id/avatar', upload.single('avatar'), updateAvatar);
router.delete('/:id', deleteUser);

module.exports = router;
