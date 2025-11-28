const { getGridFSBucket } = require('../config/gridfs');
const Game = require('../models/Game');
const { Readable } = require('stream');

class VideoRecordingService {
  constructor() {
    // Store active upload streams per game
    this.activeUploads = new Map(); // gameId -> { stream, chunks, metadata }
  }

  /**
   * Start recording for a game
   */
  startRecording(gameId, metadata = {}) {
    if (this.activeUploads.has(gameId)) {
      console.warn(`⚠️ Gravação já iniciada para partida ${gameId}`);
      return { success: false, message: 'Gravação já em andamento' };
    }

    const bucket = getGridFSBucket();
    if (!bucket) {
      console.error('❌ GridFS não disponível');
      return { success: false, message: 'Sistema de gravação indisponível' };
    }

    // Create upload stream
    const uploadStream = bucket.openUploadStream(
      `game_${gameId}_${Date.now()}.webm`,
      {
        contentType: 'video/webm',
        metadata: {
          gameId,
          recordingStart: new Date(),
          ...metadata
        }
      }
    );

    this.activeUploads.set(gameId, {
      stream: uploadStream,
      chunks: [],
      startTime: Date.now(),
      size: 0
    });

    console.log(`🎥 Gravação iniciada para partida ${gameId}`);

    return {
      success: true,
      message: 'Gravação iniciada'
    };
  }

  /**
   * Receive video chunk
   */
  async receiveChunk(gameId, chunkData) {
    const upload = this.activeUploads.get(gameId);

    if (!upload) {
      console.warn(`⚠️ Nenhuma gravação ativa para partida ${gameId}`);
      return { success: false, message: 'Gravação não iniciada' };
    }

    try {
      // Convert base64 or array buffer to Buffer
      let buffer;

      if (typeof chunkData === 'string') {
        // Base64 encoded
        buffer = Buffer.from(chunkData, 'base64');
      } else if (chunkData instanceof ArrayBuffer) {
        buffer = Buffer.from(chunkData);
      } else if (Buffer.isBuffer(chunkData)) {
        buffer = chunkData;
      } else {
        // Assume it's an array or typed array
        buffer = Buffer.from(chunkData);
      }

      // Write chunk to stream
      upload.stream.write(buffer);
      upload.size += buffer.length;

      return { success: true };

    } catch (error) {
      console.error(`❌ Erro ao processar chunk de vídeo:`, error);
      return { success: false, message: 'Erro ao processar vídeo' };
    }
  }

  /**
   * Stop recording and finalize video
   */
  async stopRecording(gameId) {
    const upload = this.activeUploads.get(gameId);

    if (!upload) {
      console.warn(`⚠️ Nenhuma gravação ativa para partida ${gameId}`);
      return { success: false, message: 'Gravação não encontrada' };
    }

    try {
      // End the upload stream
      upload.stream.end();

      // Wait for upload to finish
      await new Promise((resolve, reject) => {
        upload.stream.on('finish', resolve);
        upload.stream.on('error', reject);
      });

      const fileId = upload.stream.id;
      const duration = Math.floor((Date.now() - upload.startTime) / 1000); // seconds

      // Update game with video info
      await Game.findByIdAndUpdate(gameId, {
        'videoRecording.fileId': fileId,
        'videoRecording.filename': upload.stream.filename,
        'videoRecording.size': upload.size,
        'videoRecording.uploadDate': new Date(),
        'videoRecording.duration': duration,
        'videoRecording.isProcessing': false
      });

      // Remove from active uploads
      this.activeUploads.delete(gameId);

      console.log(`✅ Gravação finalizada para partida ${gameId} - ${upload.size} bytes, ${duration}s`);

      return {
        success: true,
        videoId: fileId,
        size: upload.size,
        duration
      };

    } catch (error) {
      console.error(`❌ Erro ao finalizar gravação:`, error);
      this.activeUploads.delete(gameId);
      return { success: false, message: 'Erro ao finalizar gravação' };
    }
  }

  /**
   * Cancel recording
   */
  async cancelRecording(gameId) {
    const upload = this.activeUploads.get(gameId);

    if (!upload) {
      return { success: false, message: 'Gravação não encontrada' };
    }

    try {
      // Abort the upload
      upload.stream.abort();
      this.activeUploads.delete(gameId);

      console.log(`🚫 Gravação cancelada para partida ${gameId}`);

      return { success: true };

    } catch (error) {
      console.error(`❌ Erro ao cancelar gravação:`, error);
      return { success: false, message: 'Erro ao cancelar gravação' };
    }
  }

  /**
   * Check if recording is active for a game
   */
  isRecording(gameId) {
    return this.activeUploads.has(gameId);
  }
}

module.exports = new VideoRecordingService();
