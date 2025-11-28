const { getGridFSBucket } = require('../config/gridfs');
const Game = require('../models/Game');
const mongoose = require('mongoose');

/**
 * @desc    Stream video by ID
 * @route   GET /api/videos/:id
 * @access  Public
 */
exports.streamVideo = async (req, res) => {
  try {
    const bucket = getGridFSBucket();

    if (!bucket) {
      return res.status(500).json({
        success: false,
        message: 'Sistema de vídeo indisponível.'
      });
    }

    const videoId = req.params.id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(videoId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de vídeo inválido.'
      });
    }

    // Find file in GridFS
    const files = await bucket.find({ _id: new mongoose.Types.ObjectId(videoId) }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vídeo não encontrado.'
      });
    }

    const file = files[0];

    // Set headers for video streaming
    res.set('Content-Type', file.contentType || 'video/webm');
    res.set('Content-Length', file.length);
    res.set('Accept-Ranges', 'bytes');

    // Handle range requests for video seeking
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : file.length - 1;
      const chunksize = (end - start) + 1;

      res.status(206);
      res.set('Content-Range', `bytes ${start}-${end}/${file.length}`);
      res.set('Content-Length', chunksize);

      const downloadStream = bucket.openDownloadStream(file._id, {
        start,
        end: end + 1
      });

      downloadStream.pipe(res);
    } else {
      // Stream entire video
      const downloadStream = bucket.openDownloadStream(file._id);
      downloadStream.pipe(res);
    }

    // Handle errors
    res.on('error', (error) => {
      console.error('Erro ao fazer stream de vídeo:', error);
    });

  } catch (error) {
    console.error('Erro ao buscar vídeo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar vídeo.'
    });
  }
};

/**
 * @desc    Get video metadata
 * @route   GET /api/videos/:id/info
 * @access  Public
 */
exports.getVideoInfo = async (req, res) => {
  try {
    const bucket = getGridFSBucket();

    if (!bucket) {
      return res.status(500).json({
        success: false,
        message: 'Sistema de vídeo indisponível.'
      });
    }

    const videoId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(videoId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de vídeo inválido.'
      });
    }

    const files = await bucket.find({ _id: new mongoose.Types.ObjectId(videoId) }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vídeo não encontrado.'
      });
    }

    const file = files[0];

    res.status(200).json({
      success: true,
      data: {
        id: file._id,
        filename: file.filename,
        contentType: file.contentType,
        size: file.length,
        uploadDate: file.uploadDate,
        metadata: file.metadata
      }
    });

  } catch (error) {
    console.error('Erro ao buscar informações do vídeo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar informações do vídeo.'
    });
  }
};

/**
 * @desc    Delete video
 * @route   DELETE /api/videos/:id
 * @access  Private (Admin only)
 */
exports.deleteVideo = async (req, res) => {
  try {
    const bucket = getGridFSBucket();

    if (!bucket) {
      return res.status(500).json({
        success: false,
        message: 'Sistema de vídeo indisponível.'
      });
    }

    const videoId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(videoId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de vídeo inválido.'
      });
    }

    // Delete from GridFS
    await bucket.delete(new mongoose.Types.ObjectId(videoId));

    // Remove video reference from game
    await Game.updateMany(
      { 'videoRecording.fileId': videoId },
      { $unset: { videoRecording: '' } }
    );

    res.status(200).json({
      success: true,
      message: 'Vídeo deletado com sucesso.'
    });

  } catch (error) {
    console.error('Erro ao deletar vídeo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar vídeo.'
    });
  }
};

module.exports = exports;
