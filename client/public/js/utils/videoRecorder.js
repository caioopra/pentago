/**
 * Video Recorder Utility
 * Handles client-side game recording using MediaRecorder API
 */

class VideoRecorder {
  constructor(socket, gameId) {
    this.socket = socket;
    this.gameId = gameId;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.canvas = null;
    this.stream = null;
  }

  /**
   * Check if browser supports MediaRecorder
   */
  static isSupported() {
    return !!(navigator.mediaDevices && window.MediaRecorder);
  }

  /**
   * Start recording
   */
  async startRecording(canvasElement) {
    if (!VideoRecorder.isSupported()) {
      console.warn('⚠️ MediaRecorder não suportado neste navegador');
      return { success: false, message: 'Gravação não suportada neste navegador' };
    }

    if (this.isRecording) {
      console.warn('⚠️ Gravação já em andamento');
      return { success: false, message: 'Gravação já iniciada' };
    }

    try {
      this.canvas = canvasElement;

      // Capture canvas stream at 24 FPS
      this.stream = this.canvas.captureStream(24);

      // Configure MediaRecorder
      const options = {
        mimeType: 'video/webm;codecs=vp8',
        videoBitsPerSecond: 4000000 // 4 Mbps
      };

      // Fallback if vp8 not supported
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm';
      }

      this.mediaRecorder = new MediaRecorder(this.stream, options);
      this.recordedChunks = [];

      // Handle data available
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);

          // Send chunk to server
          this.sendChunk(event.data);
        }
      };

      // Handle recording stop
      this.mediaRecorder.onstop = () => {
        console.log('🎥 Gravação finalizada');
        this.isRecording = false;
      };

      // Handle errors
      this.mediaRecorder.onerror = (error) => {
        console.error('❌ Erro na gravação:', error);
        this.stopRecording();
      };

      // Start recording - request data every 1 second
      this.mediaRecorder.start(1000);
      this.isRecording = true;

      // Notify server
      this.socket.emit('start_recording', { gameId: this.gameId });

      console.log('🎥 Gravação iniciada');

      return { success: true };

    } catch (error) {
      console.error('❌ Erro ao iniciar gravação:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Send video chunk to server
   */
  async sendChunk(chunk) {
    try {
      // Convert Blob to ArrayBuffer
      const arrayBuffer = await chunk.arrayBuffer();

      // Convert to base64 for socket transmission
      const base64 = this.arrayBufferToBase64(arrayBuffer);

      // Send to server
      this.socket.emit('video_chunk', {
        gameId: this.gameId,
        chunk: base64
      });

    } catch (error) {
      console.error('❌ Erro ao enviar chunk:', error);
    }
  }

  /**
   * Convert ArrayBuffer to Base64
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Stop recording
   */
  stopRecording() {
    if (!this.isRecording) {
      return { success: false, message: 'Nenhuma gravação ativa' };
    }

    try {
      // Stop media recorder
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }

      // Stop stream tracks
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
      }

      // Notify server
      this.socket.emit('stop_recording', { gameId: this.gameId });

      this.isRecording = false;
      console.log('🎥 Gravação finalizada e enviada');

      return { success: true };

    } catch (error) {
      console.error('❌ Erro ao parar gravação:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Download recorded video locally (optional)
   */
  downloadRecording(filename = 'pentago-game.webm') {
    if (this.recordedChunks.length === 0) {
      console.warn('⚠️ Nenhum dado gravado');
      return;
    }

    const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  /**
   * Get recording status
   */
  getStatus() {
    return {
      isRecording: this.isRecording,
      chunksRecorded: this.recordedChunks.length,
      duration: this.recordedChunks.reduce((total, chunk) => total + chunk.size, 0)
    };
  }
}
