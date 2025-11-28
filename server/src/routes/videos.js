const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  streamVideo,
  getVideoInfo,
  deleteVideo
} = require('../controllers/videoController');

// Public routes - anyone can watch videos
router.get('/:id', streamVideo);
router.get('/:id/info', getVideoInfo);

// Protected routes - admin only
router.delete('/:id', protect, authorize('admin'), deleteVideo);

module.exports = router;
