const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');
const {
  uploadAvatar,
  uploadDefaultAvatar,
  deleteFile
} = require('../controllers/uploadController');

// All routes require authentication
router.use(protect);

// Avatar upload (general purpose)
router.post('/avatar', uploadLimiter, upload.single('avatar'), uploadAvatar);

// Default avatar upload (admin only - replaces default.png)
router.post('/default-avatar', authorize('admin'), uploadLimiter, upload.single('avatar'), uploadDefaultAvatar);

// Delete file (admin only)
router.delete('/:filename', authorize('admin'), deleteFile);

module.exports = router;
