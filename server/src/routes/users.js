const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { userValidation } = require('../middleware/validate');
const { uploadLimiter } = require('../middleware/rateLimiter');
const {
  getUsers,
  getUser,
  updateUser,
  updateAvatar,
  deleteUser,
  getLeaderboard,
  getFullLeaderboard,
  getPublicProfile
} = require('../controllers/userController');

// Public routes
router.get('/leaderboard/full', getFullLeaderboard);
router.get('/leaderboard', getLeaderboard);
router.get('/:id/public', getPublicProfile);

// Protected routes
router.use(protect); // All routes below require authentication

router.get('/', getUsers);
router.get('/:id', userValidation.getById, getUser);
router.put('/:id', userValidation.getById, userValidation.update, updateUser);
router.put('/:id/avatar', uploadLimiter, userValidation.getById, upload.single('avatar'), updateAvatar);
router.delete('/:id', userValidation.getById, deleteUser);

module.exports = router;
