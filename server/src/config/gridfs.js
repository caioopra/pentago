const mongoose = require('mongoose');

let gridFSBucket;

/**
 * Initialize GridFS bucket when MongoDB connection is ready
 */
const initGridFS = () => {
  const conn = mongoose.connection;

  if (conn.readyState !== 1) {
    console.error('❌ MongoDB connection not ready for GridFS');
    return null;
  }

  // Create GridFS bucket for video storage
  gridFSBucket = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: 'videos'
  });

  console.log('✅ GridFS initialized for video storage');
  return gridFSBucket;
};

/**
 * Get GridFS bucket instance
 */
const getGridFSBucket = () => {
  if (!gridFSBucket) {
    return initGridFS();
  }
  return gridFSBucket;
};

module.exports = {
  initGridFS,
  getGridFSBucket
};
