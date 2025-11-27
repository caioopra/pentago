const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');
const {
  uploadAvatar,
  deleteFile
} = require('../controllers/uploadController');

// All routes require authentication
router.use(protect);

// Avatar upload (general purpose, used by admin for default avatar)
router.post('/avatar', uploadLimiter, upload.single('avatar'), uploadAvatar);

// Delete file (admin only)
router.delete('/:filename', authorize('admin'), deleteFile);

module.exports = router;
