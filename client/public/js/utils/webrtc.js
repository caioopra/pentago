/**
 * WebRTC Manager
 * Gerencia conexões de vídeo peer-to-peer usando WebRTC
 */
class WebRTCManager {
  constructor(socket, gameId) {
    this.socket = socket;
    this.gameId = gameId;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.isInitiator = false;
    this.isConnected = false;

    // Elementos de vídeo
    this.localVideoElement = null;
    this.remoteVideoElement = null;
    this.statusElement = null;

    // Estados de mídia
    this.videoEnabled = true;
    this.audioEnabled = true;

    // Configuração de servidores STUN/TURN
    this.configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };

    // Bind dos métodos
    this.handleOffer = this.handleOffer.bind(this);
    this.handleAnswer = this.handleAnswer.bind(this);
    this.handleICECandidate = this.handleICECandidate.bind(this);
  }

  /**
   * Inicializa o WebRTC com os elementos de vídeo
   */
  initialize(localVideoEl, remoteVideoEl, statusEl) {
    this.localVideoElement = localVideoEl;
    this.remoteVideoElement = remoteVideoEl;
    this.statusElement = statusEl;

    // Registrar listeners do Socket.io
    this.socket.on('webrtc_offer', this.handleOffer);
    this.socket.on('webrtc_answer', this.handleAnswer);
    this.socket.on('ice_candidate', this.handleICECandidate);
  }

  /**
   * Inicia a conexão WebRTC (chamado pelo iniciador)
   */
  async startConnection(isInitiator = true) {
    try {
      this.isInitiator = isInitiator;

      // Atualizar status
      this.updateStatus('Solicitando acesso à câmera e microfone...');

      // Obter stream local (vídeo e áudio)
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      });

      // Exibir vídeo local
      this.localVideoElement.srcObject = this.localStream;

      // Criar conexão peer
      this.createPeerConnection();

      // Adicionar tracks locais à conexão
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // Se for o iniciador, criar oferta
      if (this.isInitiator) {
        this.updateStatus('Criando oferta de conexão...');
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);

        // Enviar oferta via Socket.io
        this.socket.emit('webrtc_offer', {
          gameId: this.gameId,
          offer: offer
        });

        this.updateStatus('Aguardando resposta do oponente...');
      } else {
        this.updateStatus('Aguardando oferta do oponente...');
      }
    } catch (error) {
      console.error('Erro ao iniciar conexão WebRTC:', error);
      this.updateStatus('Erro ao acessar câmera/microfone');

      // Verificar tipo de erro
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        alert('Permissão negada para acessar câmera e microfone. Por favor, permita o acesso nas configurações do navegador.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        alert('Nenhuma câmera ou microfone encontrado. Verifique seus dispositivos.');
      } else {
        alert('Erro ao iniciar vídeo chat: ' + error.message);
      }
    }
  }

  /**
   * Cria a conexão peer-to-peer
   */
  createPeerConnection() {
    this.peerConnection = new RTCPeerConnection(this.configuration);

    // Handler para tracks remotos
    this.peerConnection.ontrack = (event) => {
      console.log('📹 Track remoto recebido:', event.track.kind);
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.remoteVideoElement.srcObject = this.remoteStream;
        this.updateStatus('');
        this.isConnected = true;
      }
    };

    // Handler para candidatos ICE
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('📹 Enviando ICE candidate');
        this.socket.emit('ice_candidate', {
          gameId: this.gameId,
          candidate: event.candidate
        });
      }
    };

    // Handler para mudanças de estado da conexão
    this.peerConnection.onconnectionstatechange = () => {
      console.log('📹 Estado da conexão:', this.peerConnection.connectionState);

      switch (this.peerConnection.connectionState) {
        case 'connected':
          this.updateStatus('');
          this.isConnected = true;
          break;
        case 'disconnected':
          this.updateStatus('Desconectado');
          this.isConnected = false;
          break;
        case 'failed':
          this.updateStatus('Falha na conexão');
          this.isConnected = false;
          break;
        case 'closed':
          this.updateStatus('Conexão fechada');
          this.isConnected = false;
          break;
      }
    };

    // Handler para mudanças de estado ICE
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('📹 Estado ICE:', this.peerConnection.iceConnectionState);
    };
  }

  /**
   * Handler: Receber oferta WebRTC
   */
  async handleOffer(data) {
    try {
      console.log('📹 Oferta WebRTC recebida');

      // Emitir evento customizado para notificar que recebeu convite
      if (typeof this.onOfferReceived === 'function') {
        this.onOfferReceived();
      }

      // Se ainda não tem conexão peer, iniciar (como receptor)
      if (!this.peerConnection) {
        await this.startConnection(false);
      }

      this.updateStatus('Processando oferta...');

      // Definir descrição remota (a oferta)
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));

      // Criar resposta
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      // Enviar resposta via Socket.io
      this.socket.emit('webrtc_answer', {
        gameId: this.gameId,
        answer: answer
      });

      this.updateStatus('Conectando...');
    } catch (error) {
      console.error('Erro ao processar oferta:', error);
      this.updateStatus('Erro ao processar oferta');
    }
  }

  /**
   * Handler: Receber resposta WebRTC
   */
  async handleAnswer(data) {
    try {
      console.log('📹 Resposta WebRTC recebida');

      this.updateStatus('Finalizando conexão...');

      // Definir descrição remota (a resposta)
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));

      this.updateStatus('Conectando...');
    } catch (error) {
      console.error('Erro ao processar resposta:', error);
      this.updateStatus('Erro ao processar resposta');
    }
  }

  /**
   * Handler: Receber candidato ICE
   */
  async handleICECandidate(data) {
    try {
      if (this.peerConnection && data.candidate) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log('📹 ICE candidate adicionado');
      }
    } catch (error) {
      console.error('Erro ao adicionar ICE candidate:', error);
    }
  }

  /**
   * Ativa/desativa vídeo
   */
  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        this.videoEnabled = videoTrack.enabled;
        return this.videoEnabled;
      }
    }
    return false;
  }

  /**
   * Ativa/desativa áudio
   */
  toggleAudio() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        this.audioEnabled = audioTrack.enabled;
        return this.audioEnabled;
      }
    }
    return false;
  }

  /**
   * Atualiza o status na UI
   */
  updateStatus(message) {
    if (this.statusElement) {
      if (message) {
        this.statusElement.classList.remove('hidden');
        this.statusElement.querySelector('.status-text').textContent = message;
      } else {
        this.statusElement.classList.add('hidden');
      }
    }
  }

  /**
   * Encerra a conexão e libera recursos
   */
  disconnect() {
    console.log('📹 Encerrando conexão WebRTC');

    // Parar todos os tracks locais
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Limpar elementos de vídeo
    if (this.localVideoElement) {
      this.localVideoElement.srcObject = null;
    }
    if (this.remoteVideoElement) {
      this.remoteVideoElement.srcObject = null;
    }

    // Fechar conexão peer
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Remover listeners do Socket.io
    this.socket.off('webrtc_offer', this.handleOffer);
    this.socket.off('webrtc_answer', this.handleAnswer);
    this.socket.off('ice_candidate', this.handleICECandidate);

    this.isConnected = false;
    this.updateStatus('Desconectado');
  }

  /**
   * Verifica se o WebRTC é suportado
   */
  static isSupported() {
    return !!(navigator.mediaDevices &&
              navigator.mediaDevices.getUserMedia &&
              window.RTCPeerConnection);
  }
}

// Exportar para uso global
window.WebRTCManager = WebRTCManager;
