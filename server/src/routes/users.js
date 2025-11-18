const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { userValidation } = require('../middleware/validate');
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
router.get('/:id', userValidation.getById, getUser);
router.put('/:id', userValidation.getById, userValidation.update, updateUser);
router.put('/:id/avatar', userValidation.getById, upload.single('avatar'), updateAvatar);
router.delete('/:id', userValidation.getById, deleteUser);

module.exports = router;
