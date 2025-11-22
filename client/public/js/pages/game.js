/**
 * Pentago Game - Multiplayer com Socket.io
 * Cliente gerenciado pelo servidor via WebSocket
 */

class PentagoGameClient {
  constructor() {
    // Socket.io
    this.socket = null;
    this.connected = false;

    // Estado do jogo (sincronizado com servidor)
    this.gameId = null;
    this.playerNumber = null; // 1 ou 2
    this.game = null; // Objeto Game do servidor

    // Estado local temporário
    this.awaitingRotation = false;

    // Inicializar
    this.init();
  }

  /**
   * Inicialização
   */
  async init() {
    // Verificar autenticação
    const token = localStorage.getItem('token');

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

    // Criar ou entrar em partida
    await this.findOrCreateGame();
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
        localStorage.removeItem('token');
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
  }

  /**
   * Encontrar ou criar partida
   */
  async findOrCreateGame() {
    try {
      const token = localStorage.getItem('token');

      const response = await fetch('/api/games/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!data.success) {
        if (data.gameId) {
          // Usuário já está em uma partida
          this.gameId = data.gameId;
          this.showMessage('Reconectando à sua partida...', 'info');
        } else {
          this.showMessage(data.message, 'error');
          return;
        }
      } else {
        this.gameId = data.game._id;
        this.playerNumber = data.playerNumber;
        this.game = data.game;

        if (data.message.includes('Aguardando')) {
          this.showMessage(data.message, 'info');
        } else {
          this.showMessage(data.message, 'success');
        }
      }

      // Entrar na partida via Socket.io
      this.socket.emit('join_game', { gameId: this.gameId });
    } catch (error) {
      console.error('Erro ao criar/entrar em partida:', error);
      this.showMessage('Erro ao conectar à partida.', 'error');
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
}

// Inicializar quando a página carregar
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
