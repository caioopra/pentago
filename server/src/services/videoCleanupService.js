const { getGridFSBucket } = require('../config/gridfs');
const Game = require('../models/Game');
const mongoose = require('mongoose');

class VideoCleanupService {
  constructor() {
    this.cleanupInterval = null;
    this.retentionDays = 15; // Keep videos for 15 days
    this.maxStorageBytes = 1 * 1024 * 1024 * 1024; // 1 GB max storage
  }

  /**
   * Start cleanup service
   */
  start() {
    console.log(`📹 Video cleanup service started (retention: ${this.retentionDays} days, max: ${this.maxStorageBytes / (1024 * 1024)}MB)`);

    // Run cleanup daily at 3 AM
    const runCleanup = () => {
      const now = new Date();
      const nextRun = new Date();
      nextRun.setHours(3, 0, 0, 0);

      if (now > nextRun) {
        nextRun.setDate(nextRun.getDate() + 1);
      }

      const timeUntilRun = nextRun - now;

      setTimeout(async () => {
        await this.cleanup();
        // Schedule next cleanup
        this.cleanupInterval = setInterval(async () => {
          await this.cleanup();
        }, 24 * 60 * 60 * 1000); // Every 24 hours
      }, timeUntilRun);
    };

    runCleanup();
  }

  /**
   * Stop cleanup service
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('📹 Video cleanup service stopped');
    }
  }

  /**
   * Run cleanup
   */
  async cleanup() {
    console.log('🧹 Running video cleanup...');

    try {
      // Clean old videos
      await this.cleanupOldVideos();

      // Clean if storage exceeds limit
      await this.cleanupExcessStorage();

      console.log('✅ Video cleanup completed');

    } catch (error) {
      console.error('❌ Error during video cleanup:', error);
    }
  }

  /**
   * Delete videos older than retention period
   */
  async cleanupOldVideos() {
    const bucket = getGridFSBucket();
    if (!bucket) {
      console.warn('⚠️ GridFS not available for cleanup');
      return;
    }

    try {
      const retentionDate = new Date();
      retentionDate.setDate(retentionDate.getDate() - this.retentionDays);

      // Find old videos
      const oldVideos = await bucket.find({
        uploadDate: { $lt: retentionDate }
      }).toArray();

      if (oldVideos.length === 0) {
        console.log('📹 No old videos to delete');
        return;
      }

      // Delete old videos
      let deletedCount = 0;
      for (const video of oldVideos) {
        try {
          await bucket.delete(video._id);

          // Remove reference from games
          await Game.updateMany(
            { 'videoRecording.fileId': video._id },
            { $unset: { videoRecording: '' } }
          );

          deletedCount++;
        } catch (error) {
          console.error(`Error deleting video ${video._id}:`, error);
        }
      }

      console.log(`🗑️ Deleted ${deletedCount} old video(s) (older than ${this.retentionDays} days)`);

    } catch (error) {
      console.error('Error cleaning up old videos:', error);
    }
  }

  /**
   * Delete oldest videos if storage exceeds limit
   */
  async cleanupExcessStorage() {
    const bucket = getGridFSBucket();
    if (!bucket) {
      return;
    }

    try {
      // Calculate total storage
      const allVideos = await bucket.find({}).toArray();
      const totalSize = allVideos.reduce((sum, video) => sum + video.length, 0);

      if (totalSize <= this.maxStorageBytes) {
        console.log(`📹 Storage OK: ${(totalSize / (1024 * 1024)).toFixed(2)}MB / ${(this.maxStorageBytes / (1024 * 1024)).toFixed(2)}MB`);
        return;
      }

      console.log(`⚠️ Storage exceeded: ${(totalSize / (1024 * 1024)).toFixed(2)}MB / ${(this.maxStorageBytes / (1024 * 1024)).toFixed(2)}MB`);

      // Sort videos by upload date (oldest first)
      const videosByDate = allVideos.sort((a, b) => a.uploadDate - b.uploadDate);

      // Delete oldest videos until we're under the limit
      let currentSize = totalSize;
      let deletedCount = 0;

      for (const video of videosByDate) {
        if (currentSize <= this.maxStorageBytes) {
          break;
        }

        try {
          await bucket.delete(video._id);

          // Remove reference from games
          await Game.updateMany(
            { 'videoRecording.fileId': video._id },
            { $unset: { videoRecording: '' } }
          );

          currentSize -= video.length;
          deletedCount++;

        } catch (error) {
          console.error(`Error deleting video ${video._id}:`, error);
        }
      }

      console.log(`🗑️ Deleted ${deletedCount} video(s) to free storage`);
      console.log(`📹 New storage: ${(currentSize / (1024 * 1024)).toFixed(2)}MB`);

    } catch (error) {
      console.error('Error cleaning up excess storage:', error);
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    const bucket = getGridFSBucket();
    if (!bucket) {
      return null;
    }

    try {
      const allVideos = await bucket.find({}).toArray();
      const totalSize = allVideos.reduce((sum, video) => sum + video.length, 0);

      return {
        totalVideos: allVideos.length,
        totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        maxSizeMB: (this.maxStorageBytes / (1024 * 1024)).toFixed(2),
        usagePercent: ((totalSize / this.maxStorageBytes) * 100).toFixed(2)
      };

    } catch (error) {
      console.error('Error getting storage stats:', error);
      return null;
    }
  }
}

module.exports = new VideoCleanupService();
