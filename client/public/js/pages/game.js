/**
 * Pentago Game - Multiplayer com Socket.io
 * Cliente gerenciado pelo servidor via WebSocket
 */

class PentagoGameClient {
  constructor() {
    // Socket.io
    this.socket = null;
    this.connected = false;

    // Queue state
    this.inQueue = false;
    this.queuePosition = null;

    // Match confirmation state
    this.pendingMatch = null; // { matchId, gameId, opponent, timeout }
    this.confirmationTimer = null;
    this.confirmationInterval = null;

    // Estado do jogo (sincronizado com servidor)
    this.gameId = null;
    this.playerNumber = null; // 1 ou 2
    this.game = null; // Objeto Game do servidor

    // Estado local temporário
    this.awaitingRotation = false;
    this.previousTurn = null; // Para detectar mudanças de turno

    // Chat - suporte para dois canais
    this.activeChannel = 'game'; // Canal ativo ('game' ou 'lobby')
    this.messages = {
      game: [],
      lobby: []
    };

    // Vídeo Chat - WebRTC
    this.webrtcManager = null;
    this.videoChatOpen = false;

    // Inicializar
    this.init();
  }

  /**
   * Inicialização
   */
  async init() {
    // Verificar autenticação
    const token = AuthManager.getToken();

    if (!token) {
      this.showMessage('Você precisa estar logado para jogar!', 'error');
      setTimeout(() => {
        window.location.href = '/pages/login.html';
      }, 2000);
      return;
    }

    // Conectar ao Socket.io
    this.connectSocket(token);

    // Inicializar event listeners da UI
    this.initializeUIListeners();

    // Show queue panel instead of auto-joining
    this.showQueuePanel();

    // Get initial queue info
    await this.waitForConnection();
    this.socket.emit('get_queue_info');
  }

  /**
   * Wait for socket connection
   */
  async waitForConnection() {
    let attempts = 0;
    while (!this.connected && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!this.connected) {
      throw new Error('Não foi possível conectar ao servidor');
    }
  }

  /**
   * Conectar ao Socket.io
   */
  connectSocket(token) {
    // Usar URL dinâmica baseada no host atual
    const socketUrl = window.location.origin;
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling']
    });

    // Evento: Conectado
    this.socket.on('connect', () => {
      console.log('✅ Conectado ao servidor Socket.io');
      this.connected = true;

      // Autenticar socket
      this.socket.emit('authenticate', token);
    });

    // Evento: Autenticado
    this.socket.on('authenticated', (data) => {
      console.log('✅ Socket autenticado');
    });

    // Evento: Erro de autenticação
    this.socket.on('auth_error', (data) => {
      console.error('❌ Erro de autenticação:', data.message);
      this.showMessage('Erro de autenticação. Faça login novamente.', 'error');
      setTimeout(() => {
        AuthManager.logout();
        window.location.href = '/pages/login.html';
      }, 2000);
    });

    // Evento: Entrou na partida
    this.socket.on('game_joined', (data) => {
      console.log('🎮 Entrou na partida:', data);
      this.game = data.game;
      this.playerNumber = data.playerNumber;
      this.updateUI();

      if (this.game.status === 'waiting') {
        this.showMessage('Aguardando outro jogador...', 'info');
      }
    });

    // Evento: Partida iniciada
    this.socket.on('game_start', (data) => {
      console.log('🎮 Partida iniciada!', data);
      this.game = data.game;
      this.hideMessage();
      this.showMessage('A partida começou! Boa sorte!', 'success');
      setTimeout(() => this.hideMessage(), 3000);
      this.updateUI();
      this.enableChat();

      // Inicializar WebRTC Manager para escutar ofertas
      this.initializeWebRTCManager();
    });

    // Evento: Oponente conectou
    this.socket.on('opponent_connected', (data) => {
      console.log('👤 Oponente conectado');
      this.hideMessage();
      this.showMessage('Oponente conectado! A partida vai começar!', 'success');
      setTimeout(() => this.hideMessage(), 3000);
    });

    // Evento: Oponente desconectou
    this.socket.on('opponent_disconnected', (data) => {
      console.log('⚠️ Oponente desconectou');
      this.showMessage('Oponente desconectou. Aguardando reconexão...', 'warning');
    });

    // Evento: Timeout de jogador por inatividade
    this.socket.on('player_timeout', (data) => {
      console.log('⏱️ Timeout de jogador:', data);
      this.showMessage(data.message, 'warning');

      // Atualizar UI para mostrar fim de jogo
      setTimeout(() => {
        this.showMessage(`${data.winner.username} venceu por W.O. (inatividade do oponente)!`, 'success');
        this.disableGameControls();
      }, 2000);
    });

    // Evento: Peça colocada
    this.socket.on('piece_placed', (data) => {
      console.log('📍 Peça colocada:', data);
      this.game.boardState = data.gameState.boardState;
      this.game.currentTurn = data.gameState.currentTurn;
      this.game.gamePhase = data.gameState.gamePhase;
      this.game.status = data.gameState.status;
      this.updateUI();
    });

    // Evento: Quadrante rotacionado
    this.socket.on('quadrant_rotated', (data) => {
      console.log('🔄 Quadrante rotacionado:', data);
      this.game.boardState = data.gameState.boardState;
      this.game.currentTurn = data.gameState.currentTurn;
      this.game.gamePhase = data.gameState.gamePhase;
      this.game.status = data.gameState.status;

      // Animação de rotação
      const quadrantElement = document.getElementById(`quadrant-${data.quadrant}`);
      quadrantElement.classList.add('rotate-animation');
      setTimeout(() => {
        quadrantElement.classList.remove('rotate-animation');
      }, 500);

      this.updateUI();
    });

    // Evento: Fim de jogo
    this.socket.on('game_over', (data) => {
      console.log('🏁 Fim de jogo:', data);
      this.game = data.game;
      this.handleGameOver(data);
    });

    // Evento: Partida deletada (ambos jogadores saíram)
    this.socket.on('game_deleted', (data) => {
      console.log('🗑️ Partida deletada:', data.message);
      this.showMessage(data.message, 'info');

      // Redirecionar para a página inicial após 3 segundos
      setTimeout(() => {
        window.location.href = '/pages/index.html';
      }, 3000);
    });

    // Evento: Erro
    this.socket.on('error', (data) => {
      console.error('❌ Erro:', data.message);
      this.showMessage(data.message, 'error');
      setTimeout(() => this.hideMessage(), 3000);
    });

    // Evento: Desconectado
    this.socket.on('disconnect', () => {
      console.log('🔌 Desconectado do servidor');
      this.connected = false;
      this.showMessage('Desconectado do servidor. Tentando reconectar...', 'warning');
    });

    // === EVENTOS DE ESPECTADOR (para jogadores na fila) ===

    // Partida iniciada (espectador)
    this.socket.on('spectator_game_start', (data) => {
      console.log('👁️ Espectador: Partida iniciada', data);
      // Se não está jogando, exibir o jogo como espectador
      if (!this.gameId || this.gameId !== data.gameId) {
        this.game = data.game;
        this.updateUI();
        this.showMessage('Uma nova partida começou! Assista enquanto espera.', 'info');
        setTimeout(() => this.hideMessage(), 3000);
      }
    });

    // Peça colocada (espectador)
    this.socket.on('spectator_piece_placed', (data) => {
      // Se não está jogando nesta partida, atualizar como espectador
      if (!this.gameId || this.gameId !== data.gameId) {
        if (!this.game) this.game = {};
        this.game.boardState = data.gameState.boardState;
        this.game.currentTurn = data.gameState.currentTurn;
        this.game.gamePhase = data.gameState.gamePhase;
        this.game.status = data.gameState.status;
        this.updateUI();
      }
    });

    // Quadrante rotacionado (espectador)
    this.socket.on('spectator_quadrant_rotated', (data) => {
      // Se não está jogando nesta partida, atualizar como espectador
      if (!this.gameId || this.gameId !== data.gameId) {
        if (!this.game) this.game = {};
        this.game.boardState = data.gameState.boardState;
        this.game.currentTurn = data.gameState.currentTurn;
        this.game.gamePhase = data.gameState.gamePhase;
        this.game.status = data.gameState.status;
        this.updateUI();
      }
    });

    // Fim de jogo (espectador)
    this.socket.on('spectator_game_over', (data) => {
      console.log('👁️ Espectador: Fim de jogo', data);
      // Se não está jogando nesta partida, exibir resultado
      if (!this.gameId || this.gameId !== data.gameId) {
        this.game = data.game;
        this.updateUI();

        let message = '';
        if (data.draw) {
          message = 'A partida terminou em empate!';
        } else if (data.winner) {
          const winnerName = data.game.player1.userId._id === data.winner ?
            data.game.player1.userId.name : data.game.player2.userId.name;
          message = `${winnerName} venceu a partida!`;
        }

        this.showMessage(message, 'info');
        setTimeout(() => this.hideMessage(), 5000);
      }
    });

    // === EVENTOS DA FILA ===

    // Entrou na fila
    this.socket.on('queue_joined', (data) => {
      this.handleQueueJoined(data);
    });

    // Fila atualizada
    this.socket.on('queue_updated', (data) => {
      this.handleQueueUpdated(data);
    });

    // Match encontrado - agora requer confirmação
    this.socket.on('match_found', (data) => {
      this.handleMatchFound(data);
    });

    // Partida confirmada - ambos jogadores prontos
    this.socket.on('match_confirmed', (data) => {
      this.handleMatchConfirmed(data);
    });

    // Partida cancelada - timeout ou recusa
    this.socket.on('match_cancelled', (data) => {
      this.handleMatchCancelled(data);
    });

    // Saiu da fila
    this.socket.on('queue_left', (data) => {
      this.handleQueueLeft(data);
    });

    // Queue info response
    this.socket.on('queue_info', (data) => {
      this.handleQueueUpdated(data);
    });

    // === EVENTOS DE CHAT ===

    // Nova mensagem recebida
    this.socket.on('chat_message', (message) => {
      this.addMessageToChat(message);
    });

    // Histórico de mensagens
    this.socket.on('messages_history', (data) => {
      this.loadMessagesHistory(data.messages);
    });

    // Erro no chat
    this.socket.on('chat_error', (data) => {
      console.error('❌ Erro no chat:', data.message);
    });

    // Usuário digitando
    this.socket.on('user_typing', (data) => {
      this.showTypingIndicator(data.userId);
    });

    // Usuário parou de digitar
    this.socket.on('user_stopped_typing', (data) => {
      this.hideTypingIndicator(data.userId);
    });
  }

  /**
   * Entrar na fila de matchmaking
   */
  async findOrCreateGame() {
    try {
      // Aguardar socket estar conectado e autenticado
      let attempts = 0;
      while (!this.connected && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!this.connected) {
        this.showMessage('Erro ao conectar ao servidor.', 'error');
        return;
      }

      // Aguardar mais um pouco para garantir autenticação
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mostrar interface da fila
      this.showQueueSidebar();

      // Entrar na fila
      this.socket.emit('join_queue');

      // Solicitar informações da fila
      this.socket.emit('get_queue_info');
    } catch (error) {
      console.error('Erro ao entrar na fila:', error);
      this.showMessage('Erro ao entrar na fila.', 'error');
    }
  }

  /**
   * Inicializar event listeners da UI
   */
  initializeUIListeners() {
    // Células do tabuleiro
    document.querySelectorAll('.cell').forEach(cell => {
      cell.addEventListener('click', (e) => this.handleCellClick(e));
    });

    // Botões de rotação
    document.querySelectorAll('.rotate-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleRotateClick(e));
    });

    // Botão de novo jogo (sair e criar nova partida)
    document.getElementById('resetBtn').addEventListener('click', () => {
      if (confirm('Deseja sair desta partida e começar uma nova?')) {
        this.leaveGame();
        window.location.reload();
      }
    });

    // Chat
    this.initializeChatListeners();

    // Vídeo Chat
    this.initializeVideoChatListeners();

    // Queue buttons
    const joinQueueBtn = document.getElementById('joinQueueBtn');
    const leaveQueueBtn = document.getElementById('leaveQueueBtn');

    if (joinQueueBtn) {
      joinQueueBtn.addEventListener('click', () => this.joinQueue());
    }

    if (leaveQueueBtn) {
      leaveQueueBtn.addEventListener('click', () => this.leaveQueue());
    }

    // Match confirmation buttons
    const confirmMatchBtn = document.getElementById('confirmMatchBtn');
    const declineMatchBtn = document.getElementById('declineMatchBtn');

    if (confirmMatchBtn) {
      confirmMatchBtn.addEventListener('click', () => this.confirmMatch());
    }

    if (declineMatchBtn) {
      declineMatchBtn.addEventListener('click', () => this.declineMatch());
    }
  }

  /**
   * Inicializar listeners do chat
   */
  initializeChatListeners() {
    const chatInput = document.getElementById('chatInput');
    const chatSend = document.getElementById('chatSend');

    if (!chatInput || !chatSend) return;

    // Enviar mensagem ao clicar no botão
    chatSend.addEventListener('click', () => {
      this.sendChatMessage();
    });

    // Enviar mensagem ao pressionar Enter
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendChatMessage();
      }
    });

    // Indicador de digitação
    let typingTimeout;
    chatInput.addEventListener('input', () => {
      // Emitir "typing" no canal ativo
      if (this.connected) {
        const typingData = {
          channel: this.activeChannel
        };
        if (this.activeChannel === 'game' && this.gameId) {
          typingData.gameId = this.gameId;
        }
        this.socket.emit('typing', typingData);
      }

      // Parar de digitar após 1 segundo sem input
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        if (this.connected) {
          this.socket.emit('stop_typing');
        }
      }, 1000);
    });

    // Toggle entre canais de chat
    const toggleButtons = document.querySelectorAll('.chat-toggle-btn');
    toggleButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const channel = e.target.dataset.channel;
        this.switchChatChannel(channel);
      });
    });
  }

  /**
   * Handler: Clique em célula
   */
  handleCellClick(e) {
    if (!this.canPlay()) return;

    if (this.game.gamePhase !== 'place') {
      this.showMessage('Você precisa rotacionar um quadrante primeiro!', 'warning');
      setTimeout(() => this.hideMessage(), 2000);
      return;
    }

    const quadrant = parseInt(e.target.dataset.quadrant);
    const cell = parseInt(e.target.dataset.cell);

    // Verificar se célula está vazia
    if (this.game.boardState[quadrant][cell] !== 0) {
      this.showMessage('Esta célula já está ocupada!', 'warning');
      setTimeout(() => this.hideMessage(), 2000);
      return;
    }

    // Enviar movimento ao servidor
    this.socket.emit('place_piece', {
      gameId: this.gameId,
      quadrant,
      cell
    });
  }

  /**
   * Handler: Clique em botão de rotação
   */
  handleRotateClick(e) {
    if (!this.canPlay()) return;

    if (this.game.gamePhase !== 'rotate') {
      this.showMessage('Você precisa colocar uma peça primeiro!', 'warning');
      setTimeout(() => this.hideMessage(), 2000);
      return;
    }

    const quadrant = parseInt(e.target.dataset.quadrant);
    const direction = e.target.dataset.direction;

    // Enviar rotação ao servidor
    this.socket.emit('rotate_quadrant', {
      gameId: this.gameId,
      quadrant,
      direction
    });
  }

  /**
   * Verifica se o jogador pode jogar
   */
  canPlay() {
    if (!this.connected) {
      this.showMessage('Você não está conectado ao servidor!', 'error');
      return false;
    }

    if (!this.game) {
      this.showMessage('Partida não iniciada!', 'error');
      return false;
    }

    if (this.game.status !== 'playing') {
      if (this.game.status === 'waiting') {
        this.showMessage('Aguardando outro jogador...', 'info');
      } else {
        this.showMessage('A partida já terminou!', 'warning');
      }
      return false;
    }

    if (this.game.currentTurn !== this.playerNumber) {
      this.showMessage('Não é o seu turno!', 'warning');
      setTimeout(() => this.hideMessage(), 2000);
      return false;
    }

    return true;
  }

  /**
   * Atualizar interface
   */
  updateUI() {
    if (!this.game) return;

    this.updateBoard();
    this.updatePlayers();
    this.updateTurnInfo();
    this.updateQuadrantButtons();
  }

  /**
   * Atualizar tabuleiro
   */
  updateBoard() {
    for (let q = 0; q < 4; q++) {
      for (let c = 0; c < 9; c++) {
        const cell = document.querySelector(`[data-quadrant="${q}"][data-cell="${c}"]`);
        const value = this.game.boardState[q][c];

        cell.className = 'cell';
        if (value !== 0) {
          cell.classList.add('occupied', `player-${value}`);
        }
      }
    }
  }

  /**
   * Atualizar informações dos jogadores
   */
  updatePlayers() {
    const player1Data = this.game.player1.userId;
    const player2Data = this.game.player2.userId;

    if (player1Data) {
      document.getElementById('player1Name').textContent = player1Data.name || 'Jogador 1';
      document.getElementById('player1Avatar').src = player1Data.avatar || '/assets/img/avatars/default.png';
      document.getElementById('player1Status').classList.toggle('active', this.game.currentTurn === 1);
    }

    if (player2Data) {
      document.getElementById('player2Name').textContent = player2Data.name || 'Jogador 2';
      document.getElementById('player2Avatar').src = player2Data.avatar || '/assets/img/avatars/default.png';
      document.getElementById('player2Status').classList.toggle('active', this.game.currentTurn === 2);
    } else {
      document.getElementById('player2Name').textContent = 'Aguardando...';
    }
  }

  /**
   * Atualizar informações do turno
   */
  updateTurnInfo() {
    const currentPlayerDisplay = document.getElementById('currentPlayerDisplay');
    const gamePhaseDisplay = document.getElementById('gamePhase');

    // Mostrar de quem é o turno
    if (this.game.currentTurn === 1 && this.game.player1.userId) {
      currentPlayerDisplay.textContent = this.game.player1.userId.name || 'Jogador 1';
      currentPlayerDisplay.className = 'player-badge player-1-badge';
    } else if (this.game.currentTurn === 2 && this.game.player2.userId) {
      currentPlayerDisplay.textContent = this.game.player2.userId.name || 'Jogador 2';
      currentPlayerDisplay.className = 'player-badge player-2-badge';
    }

    // Mostrar fase do jogo
    if (this.game.gamePhase === 'place') {
      gamePhaseDisplay.textContent = 'Coloque uma peça';
      gamePhaseDisplay.className = 'phase-badge phase-place';
    } else {
      gamePhaseDisplay.textContent = 'Gire um quadrante';
      gamePhaseDisplay.className = 'phase-badge phase-rotate';
    }

    // Adicionar indicação se é seu turno
    if (this.game.currentTurn === this.playerNumber) {
      gamePhaseDisplay.textContent += ' (Seu turno!)';
    }

    // Mostrar notificação quando o turno mudar
    this.showTurnNotification();
  }

  /**
   * Mostrar notificação de turno
   */
  showTurnNotification() {
    // Só mostra se o turno mudou e o jogo está em andamento
    if (!this.game || this.game.status !== 'playing') {
      return;
    }

    // Detectar mudança de turno
    if (this.previousTurn !== null && this.previousTurn !== this.game.currentTurn) {
      const notification = document.getElementById('turnNotification');
      const isMyTurn = this.game.currentTurn === this.playerNumber;

      // Configurar mensagem
      if (isMyTurn) {
        notification.textContent = '🎯 SUA VEZ!';
        notification.className = 'turn-notification your-turn show';
      } else {
        const opponentName = this.game.currentTurn === 1
          ? (this.game.player1.userId?.name || 'Oponente')
          : (this.game.player2.userId?.name || 'Oponente');
        notification.textContent = `⏳ Vez de ${opponentName}`;
        notification.className = 'turn-notification opponent-turn show';
      }

      // Remover após 2 segundos
      setTimeout(() => {
        notification.classList.remove('show');
      }, 2000);
    }

    // Atualizar turno anterior
    this.previousTurn = this.game.currentTurn;
  }

  /**
   * Atualizar botões de rotação
   */
  updateQuadrantButtons() {
    const canRotate = this.game.gamePhase === 'rotate' &&
                      this.game.currentTurn === this.playerNumber &&
                      this.game.status === 'playing';

    document.querySelectorAll('.quadrant').forEach(quad => {
      quad.classList.remove('rotation-phase');
      const rotateButtons = quad.querySelectorAll('.rotate-btn');
      rotateButtons.forEach(btn => {
        btn.disabled = !canRotate;
      });
    });

    if (canRotate) {
      document.querySelectorAll('.quadrant').forEach(quad => {
        quad.classList.add('rotation-phase');
      });
    }
  }

  /**
   * Handler: Fim de jogo
   */
  handleGameOver(data) {
    this.updateUI();

    let message = '';
    let type = 'info';

    if (data.draw) {
      message = '🤝 Empate! O tabuleiro ficou cheio.';
      type = 'draw';
    } else if (data.winner) {
      const isWinner = data.winner === this.playerNumber;
      if (isWinner) {
        message = '🎉 VOCÊ VENCEU! Parabéns! 🎉';
        type = 'winner';
      } else {
        const opponentName = data.winner === 1
          ? this.game.player1.userId.name
          : this.game.player2.userId.name;
        message = `😢 ${opponentName} venceu! Mais sorte na próxima.`;
        type = 'info';
      }
    }

    this.showMessage(message, type);

    // Desabilitar todos os botões
    document.querySelectorAll('.rotate-btn').forEach(btn => {
      btn.disabled = true;
    });
  }

  /**
   * Sair da partida
   */
  leaveGame() {
    // Fechar vídeo chat se estiver aberto
    if (this.videoChatOpen) {
      this.closeVideoChat();
    }

    if (this.socket && this.connected) {
      this.socket.emit('leave_game');
    }
  }

  /**
   * Exibir mensagem
   */
  showMessage(text, type = 'info') {
    const messageEl = document.getElementById('gameMessage');
    messageEl.textContent = text;
    messageEl.className = `game-message ${type}`;
    messageEl.classList.remove('hidden');
  }

  /**
   * Esconder mensagem
   */
  hideMessage() {
    document.getElementById('gameMessage').classList.add('hidden');
  }

  /**
   * Mostrar sidebar da fila
   */
  showQueueSidebar() {
    const sidebar = document.querySelector('.sidebar-right');
    if (sidebar) {
      sidebar.style.display = 'block';
    }
  }

  /**
   * Esconder sidebar da fila
   */
  hideQueueSidebar() {
    const sidebar = document.querySelector('.sidebar-right');
    if (sidebar) {
      sidebar.style.display = 'none';
    }
  }

  /**
   * Atualizar UI da fila
   */
  updateQueueUI() {
    this.showQueueSidebar();
  }

  /**
   * Atualizar display da fila
   */
  updateQueueDisplay(queueData) {
    const queueList = document.getElementById('queueList');
    const queueCount = document.getElementById('queueCount');

    if (!queueList || !queueCount) return;

    // Atualizar contador
    queueCount.textContent = `${queueData.size}/${queueData.maxSize}`;

    // Limpar lista
    queueList.innerHTML = '';

    if (queueData.players.length === 0) {
      queueList.innerHTML = '<p class="queue-empty">Nenhum jogador na fila</p>';
      return;
    }

    // Adicionar jogadores
    queueData.players.forEach((player, index) => {
      const playerEl = document.createElement('div');
      playerEl.className = 'queue-player';
      playerEl.innerHTML = `
        <div class="queue-player-avatar">
          <img src="${player.avatar || '/assets/img/avatars/default.png'}" alt="${player.username}">
        </div>
        <div class="queue-player-info">
          <div class="queue-player-name">${player.username}</div>
          <div class="queue-player-stats">
            <span class="queue-player-score">⭐ ${player.score || 0}</span>
            <span class="queue-player-wait">⏱️ ${player.waitingTime}s</span>
          </div>
        </div>
      `;
      queueList.appendChild(playerEl);
    });
  }

  /**
   * Enviar mensagem do chat
   */
  sendChatMessage() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput) return;

    const message = chatInput.value.trim();
    if (!message) return;

    if (!this.connected) {
      console.error('Socket não conectado');
      return;
    }

    // Enviar mensagem no canal ativo
    const messageData = {
      content: message,
      channel: this.activeChannel
    };

    // Adicionar gameId apenas se for canal de jogo
    if (this.activeChannel === 'game' && this.gameId) {
      messageData.gameId = this.gameId;
    }

    this.socket.emit('send_message', messageData);

    // Limpar input
    chatInput.value = '';
  }

  /**
   * Adicionar mensagem ao chat
   */
  addMessageToChat(message) {
    // Adicionar mensagem ao array do canal apropriado
    const channel = message.channel || 'game';
    if (this.messages[channel]) {
      this.messages[channel].push(message);
    }

    // Se a mensagem for do canal ativo, renderizar
    if (channel === this.activeChannel) {
      this.renderMessage(message);
    }

    // Mostrar chat se estiver escondido
    this.showChat();
  }

  /**
   * Renderizar uma mensagem no chat
   */
  renderMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    const currentUser = AuthManager.getUser();
    const isOwnMessage = currentUser && message.sender._id === currentUser._id;

    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${isOwnMessage ? 'own-message' : ''}`;

    const time = new Date(message.createdAt).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    messageEl.innerHTML = `
      <div class="message-header">
        <img src="${message.sender.avatar || '/assets/img/avatars/default.png'}"
             alt="${message.sender.name}"
             class="message-avatar">
        <span class="message-sender">${message.sender.name}</span>
        <span class="message-time">${time}</span>
      </div>
      <div class="message-content">${message.content}</div>
    `;

    chatMessages.appendChild(messageEl);

    // Auto-scroll para última mensagem
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  /**
   * Carregar histórico de mensagens
   */
  loadMessagesHistory(data) {
    const { channel, messages } = data;

    // Armazenar mensagens no canal apropriado
    if (this.messages[channel]) {
      this.messages[channel] = messages;
    }

    // Se for o canal ativo, renderizar as mensagens
    if (channel === this.activeChannel) {
      this.renderChannelMessages();
    }
  }

  /**
   * Renderizar todas as mensagens do canal ativo
   */
  renderChannelMessages() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    // Limpar mensagens atuais
    chatMessages.innerHTML = '';

    // Renderizar mensagens do canal ativo
    const messages = this.messages[this.activeChannel] || [];
    messages.forEach(message => this.renderMessage(message));
  }

  /**
   * Alternar entre canais de chat
   */
  switchChatChannel(channel) {
    if (channel === this.activeChannel) return;

    // Atualizar canal ativo
    this.activeChannel = channel;

    // Atualizar UI dos botões
    const toggleButtons = document.querySelectorAll('.chat-toggle-btn');
    toggleButtons.forEach(btn => {
      if (btn.dataset.channel === channel) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Renderizar mensagens do novo canal
    this.renderChannelMessages();

    // Carregar histórico se o canal estiver vazio
    if (this.messages[channel].length === 0 && this.connected) {
      const requestData = {
        channel,
        limit: 50
      };

      // Adicionar gameId se for canal de jogo
      if (channel === 'game' && this.gameId) {
        requestData.gameId = this.gameId;
      }

      this.socket.emit('get_messages', requestData);
    }
  }

  /**
   * Mostrar indicador de digitação
   */
  showTypingIndicator(userId) {
    // Implementação simples - pode ser expandida
    console.log(`Usuário ${userId} está digitando...`);
  }

  /**
   * Esconder indicador de digitação
   */
  hideTypingIndicator(userId) {
    console.log(`Usuário ${userId} parou de digitar`);
  }

  /**
   * Mostrar chat
   */
  showChat() {
    const chatCard = document.querySelector('.chat-card');
    if (chatCard) {
      chatCard.style.display = 'block';
    }
  }

  /**
   * Habilitar chat do lobby (para jogadores na fila)
   */
  enableLobbyChat() {
    const chatInput = document.getElementById('chatInput');
    const chatSend = document.getElementById('chatSend');

    if (chatInput) chatInput.disabled = false;
    if (chatSend) chatSend.disabled = false;

    // Definir canal ativo como lobby
    this.activeChannel = 'lobby';

    // Atualizar UI dos botões de toggle
    const toggleButtons = document.querySelectorAll('.chat-toggle-btn');
    toggleButtons.forEach(btn => {
      if (btn.dataset.channel === 'lobby') {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Buscar histórico do lobby
    if (this.connected) {
      this.socket.emit('get_messages', {
        channel: 'lobby',
        limit: 50
      });
    }

    this.showChat();
  }

  /**
   * Habilitar chat quando partida começar
   */
  enableChat() {
    const chatInput = document.getElementById('chatInput');
    const chatSend = document.getElementById('chatSend');

    if (chatInput) chatInput.disabled = false;
    if (chatSend) chatSend.disabled = false;

    // Definir canal ativo como jogo quando partida começar
    this.activeChannel = 'game';

    // Atualizar UI dos botões de toggle
    const toggleButtons = document.querySelectorAll('.chat-toggle-btn');
    toggleButtons.forEach(btn => {
      if (btn.dataset.channel === 'game') {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Buscar histórico de ambos os canais
    if (this.connected) {
      // Canal do jogo
      if (this.gameId) {
        this.socket.emit('get_messages', {
          channel: 'game',
          gameId: this.gameId,
          limit: 50
        });
      }

      // Canal do lobby (se ainda não carregado)
      if (this.messages.lobby.length === 0) {
        this.socket.emit('get_messages', {
          channel: 'lobby',
          limit: 50
        });
      }
    }

    this.showChat();
  }

  /**
   * Desabilitar controles do jogo (quando jogo acabar)
   */
  disableGameControls() {
    // Desabilitar cliques nas células
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
      cell.style.pointerEvents = 'none';
      cell.style.opacity = '0.6';
    });

    // Desabilitar botões de rotação
    const rotateButtons = document.querySelectorAll('.rotate-button');
    rotateButtons.forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.5';
    });
  }

  /**
   * Inicializar WebRTC Manager (chamado quando o jogo começa)
   */
  initializeWebRTCManager() {
    if (this.webrtcManager || !this.gameId) return;

    // Verificar suporte a WebRTC
    if (!WebRTCManager.isSupported()) {
      console.warn('⚠️ WebRTC não suportado neste navegador');
      return;
    }

    // Criar WebRTC Manager
    this.webrtcManager = new WebRTCManager(this.socket, this.gameId);

    // Inicializar com elementos de vídeo
    const localVideo = document.getElementById('localVideo');
    const remoteVideo = document.getElementById('remoteVideo');
    const videoStatus = document.getElementById('videoStatus');

    this.webrtcManager.initialize(localVideo, remoteVideo, videoStatus);

    // Configurar callback para quando receber oferta
    this.webrtcManager.onOfferReceived = () => {
      // Mostrar card de vídeo chat automaticamente
      const videoChatCard = document.getElementById('videoChatCard');
      if (videoChatCard && !this.videoChatOpen) {
        videoChatCard.style.display = 'block';
        this.videoChatOpen = true;

        // Atualizar botões
        document.getElementById('toggleVideo').classList.add('active');
        document.getElementById('toggleAudio').classList.add('active');

        this.showMessage('Oponente iniciou vídeo chat!', 'info');
        setTimeout(() => this.hideMessage(), 3000);
      }
    };

    console.log('📹 WebRTC Manager inicializado');
  }

  /**
   * Inicializar listeners do vídeo chat
   */
  initializeVideoChatListeners() {
    const openVideoChatBtn = document.getElementById('openVideoChat');
    const toggleVideoChatBtn = document.getElementById('toggleVideoChat');
    const toggleVideoBtn = document.getElementById('toggleVideo');
    const toggleAudioBtn = document.getElementById('toggleAudio');

    if (!openVideoChatBtn) return;

    // Verificar suporte a WebRTC
    if (!WebRTCManager.isSupported()) {
      openVideoChatBtn.disabled = true;
      openVideoChatBtn.title = 'Seu navegador não suporta vídeo chat';
      console.warn('⚠️ WebRTC não suportado neste navegador');
      return;
    }

    // Abrir vídeo chat
    openVideoChatBtn.addEventListener('click', () => {
      this.openVideoChat();
    });

    // Fechar vídeo chat
    if (toggleVideoChatBtn) {
      toggleVideoChatBtn.addEventListener('click', () => {
        this.closeVideoChat();
      });
    }

    // Ativar/Desativar vídeo
    if (toggleVideoBtn) {
      toggleVideoBtn.addEventListener('click', () => {
        if (this.webrtcManager) {
          const isEnabled = this.webrtcManager.toggleVideo();
          toggleVideoBtn.classList.toggle('active', isEnabled);
          toggleVideoBtn.classList.toggle('inactive', !isEnabled);
        }
      });
    }

    // Ativar/Desativar áudio
    if (toggleAudioBtn) {
      toggleAudioBtn.addEventListener('click', () => {
        if (this.webrtcManager) {
          const isEnabled = this.webrtcManager.toggleAudio();
          toggleAudioBtn.classList.toggle('active', isEnabled);
          toggleAudioBtn.classList.toggle('inactive', !isEnabled);
        }
      });
    }
  }

  /**
   * Abrir vídeo chat
   */
  async openVideoChat() {
    if (this.videoChatOpen) return;

    // Verificar se está em uma partida
    if (!this.gameId) {
      alert('Você precisa estar em uma partida para usar o vídeo chat.');
      return;
    }

    // Verificar se o jogo está em andamento
    if (!this.game || this.game.status !== 'playing') {
      alert('O vídeo chat só está disponível durante a partida.');
      return;
    }

    // Verificar se WebRTC Manager foi criado
    if (!this.webrtcManager) {
      this.initializeWebRTCManager();
    }

    if (!this.webrtcManager) {
      alert('Vídeo chat não está disponível (navegador não suportado).');
      return;
    }

    try {
      // Mostrar card de vídeo chat
      const videoChatCard = document.getElementById('videoChatCard');
      if (videoChatCard) {
        videoChatCard.style.display = 'block';
        this.videoChatOpen = true;
      }

      // Iniciar conexão (player 1 é o iniciador)
      const isInitiator = this.playerNumber === 1;
      await this.webrtcManager.startConnection(isInitiator);

      // Atualizar estado dos botões de controle
      document.getElementById('toggleVideo').classList.add('active');
      document.getElementById('toggleAudio').classList.add('active');

      console.log('📹 Vídeo chat iniciado');
    } catch (error) {
      console.error('Erro ao abrir vídeo chat:', error);
      alert('Erro ao iniciar vídeo chat: ' + error.message);
      this.closeVideoChat();
    }
  }

  /**
   * Fechar vídeo chat
   */
  closeVideoChat() {
    if (!this.videoChatOpen) return;

    // Desconectar WebRTC
    if (this.webrtcManager) {
      this.webrtcManager.disconnect();
    }

    // Esconder card de vídeo chat
    const videoChatCard = document.getElementById('videoChatCard');
    if (videoChatCard) {
      videoChatCard.style.display = 'none';
      this.videoChatOpen = false;
    }

    // Resetar estado dos botões
    document.getElementById('toggleVideo').classList.remove('active', 'inactive');
    document.getElementById('toggleAudio').classList.remove('active', 'inactive');

    console.log('📹 Vídeo chat fechado');
  }

  /**
   * ========================================
   * QUEUE AND MATCHMAKING METHODS
   * ========================================
   */

  /**
   * Show queue panel
   */
  showQueuePanel() {
    const queuePanel = document.getElementById('queuePanel');
    const gameBoard = document.querySelector('.game-board');
    const gameControls = document.querySelector('.game-controls');
    
    if (queuePanel) {
      queuePanel.style.display = 'block';
      queuePanel.classList.add('active');
    }
    if (gameBoard) gameBoard.style.display = 'none';
    if (gameControls) gameControls.style.display = 'none';
  }

  /**
   * Hide queue panel
   */
  hideQueuePanel() {
    const queuePanel = document.getElementById('queuePanel');
    const gameBoard = document.querySelector('.game-board');
    const gameControls = document.querySelector('.game-controls');
    
    if (queuePanel) {
      queuePanel.style.display = 'none';
      queuePanel.classList.remove('active');
    }
    if (gameBoard) gameBoard.style.display = 'grid';
    if (gameControls) gameControls.style.display = 'flex';
  }

  /**
   * Join queue
   */
  joinQueue() {
    if (!this.connected) {
      this.showMessage('Conectando ao servidor...', 'info');
      return;
    }

    console.log('🎯 Entrando na fila...');
    this.socket.emit('join_queue');

    // Show waiting state
    document.getElementById('queueActions').style.display = 'none';
    document.getElementById('queueWaiting').style.display = 'flex';
    this.inQueue = true;
  }

  /**
   * Leave queue
   */
  leaveQueue() {
    console.log('👋 Saindo da fila...');
    this.socket.emit('leave_queue');

    // Reset UI
    document.getElementById('queueActions').style.display = 'flex';
    document.getElementById('queueWaiting').style.display = 'none';
    this.inQueue = false;
    this.queuePosition = null;
  }

  /**
   * Handle match found
   */
  handleMatchFound(data) {
    console.log('🎮 Partida encontrada!', data);

    this.pendingMatch = data;

    // Show confirmation modal
    this.showConfirmationModal(data);

    // Start countdown timer
    this.startConfirmationTimer(data.timeout || 30);
  }

  /**
   * Show confirmation modal
   */
  showConfirmationModal(data) {
    const modal = document.getElementById('matchConfirmModal');
    const opponentAvatar = document.getElementById('confirmOpponentAvatar');
    const opponentName = document.getElementById('confirmOpponentName');
    const opponentScore = document.getElementById('confirmOpponentScore');

    if (data.opponent) {
      opponentAvatar.src = data.opponent.avatar || '/assets/img/avatars/default.png';
      opponentName.textContent = data.opponent.username || 'Oponente';
      opponentScore.textContent = data.opponent.score || 0;
    }

    modal.style.display = 'flex';
  }

  /**
   * Hide confirmation modal
   */
  hideConfirmationModal() {
    const modal = document.getElementById('matchConfirmModal');
    modal.style.display = 'none';

    // Clear timers
    if (this.confirmationTimer) {
      clearTimeout(this.confirmationTimer);
      this.confirmationTimer = null;
    }
    if (this.confirmationInterval) {
      clearInterval(this.confirmationInterval);
      this.confirmationInterval = null;
    }
  }

  /**
   * Start confirmation countdown
   */
  startConfirmationTimer(seconds) {
    const timerDisplay = document.getElementById('confirmTimer');
    let remaining = seconds;

    timerDisplay.textContent = remaining;

    // Update every second
    this.confirmationInterval = setInterval(() => {
      remaining--;
      timerDisplay.textContent = remaining;

      if (remaining <= 0) {
        clearInterval(this.confirmationInterval);
      }
    }, 1000);
  }

  /**
   * Confirm match
   */
  confirmMatch() {
    if (!this.pendingMatch) {
      console.error('❌ Nenhuma partida pendente');
      return;
    }

    console.log('✅ Confirmando partida...');

    this.socket.emit('confirm_match', {
      matchId: this.pendingMatch.matchId
    });

    // Disable buttons while waiting
    document.getElementById('confirmMatchBtn').disabled = true;
    document.getElementById('declineMatchBtn').disabled = true;
  }

  /**
   * Decline match
   */
  declineMatch() {
    if (!this.pendingMatch) {
      console.error('❌ Nenhuma partida pendente');
      return;
    }

    console.log('❌ Recusando partida...');

    this.socket.emit('decline_match', {
      matchId: this.pendingMatch.matchId
    });

    this.hideConfirmationModal();
    this.pendingMatch = null;

    // Return to queue panel
    this.showQueuePanel();
  }

  /**
   * Handle match confirmed - both players ready
   */
  handleMatchConfirmed(data) {
    console.log('✅ Partida confirmada! Iniciando...', data);

    this.hideConfirmationModal();
    this.pendingMatch = null;

    // Set game data
    this.gameId = data.gameId;
    this.playerNumber = data.playerNumber;
    this.game = data.game;

    // Hide queue panel and show game
    this.hideQueuePanel();

    // Join the game room
    this.socket.emit('join_game', { gameId: data.gameId });
  }

  /**
   * Handle match cancelled
   */
  handleMatchCancelled(data) {
    console.log('❌ Partida cancelada:', data.reason);

    this.hideConfirmationModal();
    this.pendingMatch = null;

    this.showMessage(data.message, 'warning');

    // If player confirmed but opponent didn't, they're back in queue
    if (data.reason === 'opponent_timeout' || data.reason === 'opponent_declined') {
      // Show waiting state again
      document.getElementById('queueActions').style.display = 'none';
      document.getElementById('queueWaiting').style.display = 'flex';
      this.inQueue = true;
    } else {
      // Player didn't confirm or declined - show join button again
      document.getElementById('queueActions').style.display = 'flex';
      document.getElementById('queueWaiting').style.display = 'none';
      this.inQueue = false;
    }
  }

  /**
   * Handle queue updated
   */
  handleQueueUpdated(data) {
    const queueCount = document.getElementById('queuePlayersInline');
    if (queueCount) {
      queueCount.textContent = data.size || 0;
    }
  }

  /**
   * Handle queue joined
   */
  handleQueueJoined(data) {
    console.log('✅ Entrou na fila', data);
    if (data.success) {
      this.showMessage(data.message, 'success');
      this.queuePosition = data.position;
      
      const positionText = document.getElementById('queuePositionText');
      if (positionText) {
        positionText.textContent = data.position || '?';
      }
    } else {
      this.showMessage(data.message, 'error');
      this.leaveQueue();
    }
  }

  /**
   * Handle queue left
   */
  handleQueueLeft(data) {
    console.log('👋 Saiu da fila', data);
    if (data.success) {
      this.showMessage(data.message, 'info');
    }
  }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const game = new PentagoGameClient();

  // Torna acessível globalmente para debugging
  window.pentagoGame = game;

  // Desconectar ao sair da página
  window.addEventListener('beforeunload', () => {
    if (game.socket && game.connected) {
      game.leaveGame();
    }
  });
});
