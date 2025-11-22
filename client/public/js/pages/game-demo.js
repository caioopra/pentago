/**
 * Pentago Game Demo - Single Player vs Bot
 * Não requer login, jogo local contra IA
 */

class PentagoGameDemo {
  constructor() {
    // Estado do jogo
    this.board = Array(4).fill().map(() => Array(9).fill(0));
    this.currentPlayer = 1; // 1 = Humano, 2 = Bot
    this.gamePhase = 'place'; // 'place' ou 'rotate'
    this.gameOver = false;
    this.winner = null;

    // Dificuldade inicial
    this.difficulty = 'easy'; // easy, medium, hard

    // Bot AI (criado com dificuldade)
    this.bot = new PentagoBot(this.difficulty);

    // Flag para controlar animação de rotação
    this.isRotating = false;

    // Inicializar
    this.initializeEventListeners();
    this.updateDisplay();
    this.showMessage('Bem-vindo! Você é o Jogador 1 (Vermelho). Boa sorte!', 'success');
    setTimeout(() => this.hideMessage(), 3000);
  }

  /**
   * Inicializa event listeners
   */
  initializeEventListeners() {
    // Seletor de dificuldade
    document.getElementById('difficulty').addEventListener('change', (e) => {
      this.difficulty = e.target.value;
      this.bot = new PentagoBot(this.difficulty); // Recria bot com nova dificuldade
      this.showMessage(`Dificuldade alterada para: ${this.getDifficultyLabel()}. Reinicie o jogo para aplicar.`, 'info');
      setTimeout(() => this.hideMessage(), 3000);
    });

    // Células do tabuleiro
    document.querySelectorAll('.cell').forEach(cell => {
      cell.addEventListener('click', (e) => this.handleCellClick(e));
    });

    // Botões de rotação
    document.querySelectorAll('.rotate-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleRotateClick(e));
    });

    // Botão de reset
    document.getElementById('resetBtn').addEventListener('click', () => this.resetGame());
  }

  /**
   * Handler: Clique em célula
   */
  handleCellClick(e) {
    // Só permite jogar se for turno do humano e fase de colocar peça
    if (this.gameOver || this.gamePhase !== 'place' || this.currentPlayer !== 1) return;

    const quadrant = parseInt(e.target.dataset.quadrant);
    const cell = parseInt(e.target.dataset.cell);

    // Verifica se célula está vazia
    if (this.board[quadrant][cell] !== 0) {
      this.showMessage('Esta célula já está ocupada!', 'warning');
      setTimeout(() => this.hideMessage(), 2000);
      return;
    }

    // Coloca a peça
    this.placePiece(quadrant, cell);
    this.updateDisplay();

    // Verifica vitória
    if (this.checkWinCondition()) {
      this.endGame(this.currentPlayer);
      return;
    }

    // Muda para fase de rotação
    this.gamePhase = 'rotate';
    this.updateDisplay();
  }

  /**
   * Handler: Clique em botão de rotação
   */
  handleRotateClick(e) {
    // Só permite rotar se for turno do humano e fase de rotação
    if (this.gameOver || this.gamePhase !== 'rotate' || this.currentPlayer !== 1) return;

    const quadrant = parseInt(e.target.dataset.quadrant);
    const direction = e.target.dataset.direction;

    // Rotaciona (com callback para continuar após animação)
    this.rotateQuadrant(quadrant, direction, () => {
      // Verifica vitória
      if (this.checkWinCondition()) {
        this.endGame(this.currentPlayer);
        return;
      }

      // Troca jogador e volta para fase de colocação
      this.switchPlayer();
      this.gamePhase = 'place';
      this.updateDisplay();

      // Turno do bot
      if (this.currentPlayer === 2) {
        setTimeout(() => this.makeBotMove(), 500);
      }
    });
  }

  /**
   * Coloca uma peça no tabuleiro
   */
  placePiece(quadrant, cell) {
    this.board[quadrant][cell] = this.currentPlayer;
  }

  /**
   * Rotaciona um quadrante
   */
  rotateQuadrant(quadrant, direction, callback) {
    const quad = this.board[quadrant];
    const rotated = new Array(9);

    if (direction === 'right') {
      // Rotação horária
      rotated[0] = quad[6];
      rotated[1] = quad[3];
      rotated[2] = quad[0];
      rotated[3] = quad[7];
      rotated[4] = quad[4];
      rotated[5] = quad[1];
      rotated[6] = quad[8];
      rotated[7] = quad[5];
      rotated[8] = quad[2];
    } else {
      // Rotação anti-horária
      rotated[0] = quad[2];
      rotated[1] = quad[5];
      rotated[2] = quad[8];
      rotated[3] = quad[1];
      rotated[4] = quad[4];
      rotated[5] = quad[7];
      rotated[6] = quad[0];
      rotated[7] = quad[3];
      rotated[8] = quad[6];
    }

    // Marca que uma rotação está em andamento
    this.isRotating = true;

    // Inicia a animação visual com a direção correta
    const quadrantElement = document.getElementById(`quadrant-${quadrant}`);
    const animationClass = direction === 'right' ? 'rotate-animation-right' : 'rotate-animation-left';
    quadrantElement.classList.add(animationClass);

    // Aguarda a animação terminar ANTES de atualizar o board
    setTimeout(() => {
      // Atualiza o board após a animação
      this.board[quadrant] = rotated;

      quadrantElement.classList.remove(animationClass);
      this.isRotating = false; // Rotação concluída
      this.updateBoard(); // Atualiza o visual após a animação
      if (callback) callback(); // Executa callback se fornecido
    }, 500);
  }

  /**
   * Turno do bot
   */
  makeBotMove() {
    if (this.gameOver || this.currentPlayer !== 2) return;

    // Fase de colocar peça
    if (this.gamePhase === 'place') {
      const move = this.bot.makeMove(this);
      if (!move) return;

      this.placePiece(move.quadrant, move.cell);
      this.updateDisplay();

      if (this.checkWinCondition()) {
        this.endGame(this.currentPlayer);
        return;
      }

      this.gamePhase = 'rotate';
      this.updateDisplay();
      setTimeout(() => this.makeBotMove(), 500);
    }
    // Fase de rotação
    else if (this.gamePhase === 'rotate') {
      const move = this.bot.makeMove(this);
      if (!move) return;

      this.rotateQuadrant(move.quadrant, move.direction, () => {
        if (this.checkWinCondition()) {
          this.endGame(this.currentPlayer);
          return;
        }

        this.switchPlayer();
        this.gamePhase = 'place';
        this.updateDisplay();
      });
    }
  }

  /**
   * Verifica condição de vitória
   */
  checkWinCondition() {
    const fullBoard = this.convertToFullBoard();

    // Verifica vitória para ambos
    for (let player = 1; player <= 2; player++) {
      if (this.checkPlayerWin(fullBoard, player)) {
        this.winner = player;
        return true;
      }
    }

    // Verifica empate
    if (this.isBoardFull()) {
      this.winner = 'draw';
      return true;
    }

    return false;
  }

  /**
   * Converte board para matriz 6x6
   */
  convertToFullBoard() {
    const fullBoard = Array(6).fill().map(() => Array(6).fill(0));

    for (let q = 0; q < 4; q++) {
      const startRow = Math.floor(q / 2) * 3;
      const startCol = (q % 2) * 3;

      for (let i = 0; i < 9; i++) {
        const row = Math.floor(i / 3);
        const col = i % 3;
        fullBoard[startRow + row][startCol + col] = this.board[q][i];
      }
    }

    return fullBoard;
  }

  /**
   * Verifica se um jogador venceu
   */
  checkPlayerWin(board, player) {
    const directions = [
      [0, 1],   // horizontal
      [1, 0],   // vertical
      [1, 1],   // diagonal
      [1, -1]   // anti-diagonal
    ];

    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 6; col++) {
        if (board[row][col] === player) {
          for (let [dRow, dCol] of directions) {
            if (this.checkDirection(board, row, col, dRow, dCol, player)) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  /**
   * Verifica 5 em linha
   */
  checkDirection(board, startRow, startCol, dRow, dCol, player) {
    let count = 0;
    let row = startRow;
    let col = startCol;

    while (row >= 0 && row < 6 && col >= 0 && col < 6 && board[row][col] === player) {
      count++;
      if (count >= 5) return true;
      row += dRow;
      col += dCol;
    }

    return false;
  }

  /**
   * Verifica se tabuleiro está cheio
   */
  isBoardFull() {
    for (let q = 0; q < 4; q++) {
      for (let c = 0; c < 9; c++) {
        if (this.board[q][c] === 0) return false;
      }
    }
    return true;
  }

  /**
   * Troca o jogador
   */
  switchPlayer() {
    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
  }

  /**
   * Atualiza toda a interface
   */
  updateDisplay() {
    this.updateBoard();
    this.updatePlayerDisplay();
    this.updateGamePhase();
    this.updateQuadrantHighlights();
  }

  /**
   * Atualiza o tabuleiro visual
   */
  updateBoard() {
    // Não atualiza o tabuleiro se uma rotação estiver em andamento
    if (this.isRotating) {
      return;
    }

    for (let q = 0; q < 4; q++) {
      for (let c = 0; c < 9; c++) {
        const cell = document.querySelector(`[data-quadrant="${q}"][data-cell="${c}"]`);
        const value = this.board[q][c];

        cell.className = 'cell';
        if (value !== 0) {
          cell.classList.add('occupied', `player-${value}`);
        }
      }
    }
  }

  /**
   * Atualiza display do jogador atual
   */
  updatePlayerDisplay() {
    const display = document.getElementById('currentPlayerDisplay');
    if (this.currentPlayer === 1) {
      display.textContent = 'Você (Vermelho)';
      display.className = 'player-badge player-1-badge';
    } else {
      display.textContent = 'Bot (Azul)';
      display.className = 'player-badge player-2-badge';
    }
  }

  /**
   * Atualiza fase do jogo
   */
  updateGamePhase() {
    const phaseDisplay = document.getElementById('gamePhase');
    if (this.gamePhase === 'place') {
      phaseDisplay.textContent = 'Coloque uma peça';
      phaseDisplay.className = 'phase-badge phase-place';
    } else {
      phaseDisplay.textContent = 'Gire um quadrante';
      phaseDisplay.className = 'phase-badge phase-rotate';
    }
  }

  /**
   * Atualiza highlights dos quadrantes
   */
  updateQuadrantHighlights() {
    document.querySelectorAll('.quadrant').forEach(quad => {
      quad.classList.remove('rotation-phase');

      const rotateButtons = quad.querySelectorAll('.rotate-btn');
      rotateButtons.forEach(btn => {
        // Só habilita se for fase de rotação, turno do humano, e jogo não acabou
        btn.disabled = this.gamePhase !== 'rotate' || this.currentPlayer !== 1 || this.gameOver;
      });
    });

    if (this.gamePhase === 'rotate' && this.currentPlayer === 1) {
      document.querySelectorAll('.quadrant').forEach(quad => {
        quad.classList.add('rotation-phase');
      });
    }
  }

  /**
   * Finaliza o jogo
   */
  endGame(winner) {
    this.gameOver = true;
    this.winner = winner;

    let message = '';
    if (winner === 'draw') {
      message = '🤝 Empate! O tabuleiro ficou cheio.';
    } else if (winner === 1) {
      message = '🎉 VOCÊ VENCEU! Parabéns! 🎉';
    } else {
      message = '😢 O Bot venceu! Tente novamente.';
    }

    this.showMessageWithPlayAgain(message, winner);

    // Desabilita botões
    document.querySelectorAll('.rotate-btn').forEach(btn => {
      btn.disabled = true;
    });
  }

  /**
   * Reinicia o jogo
   */
  resetGame() {
    this.board = Array(4).fill().map(() => Array(9).fill(0));
    this.currentPlayer = 1;
    this.gamePhase = 'place';
    this.gameOver = false;
    this.winner = null;

    // Recria bot com dificuldade atual
    this.bot = new PentagoBot(this.difficulty);

    this.hideMessage();
    this.updateDisplay();
    this.showMessage(`Novo jogo iniciado em dificuldade ${this.getDifficultyLabel()}! Boa sorte!`, 'success');
    setTimeout(() => this.hideMessage(), 2000);
  }

  /**
   * Obtém label da dificuldade
   */
  getDifficultyLabel() {
    const labels = {
      easy: 'Fácil',
      medium: 'Médio',
      hard: 'Difícil'
    };
    return labels[this.difficulty] || 'Fácil';
  }

  /**
   * Exibe mensagem
   */
  showMessage(text, type = 'info') {
    const messageEl = document.getElementById('gameMessage');
    messageEl.textContent = text;
    messageEl.className = `game-message ${type}`;
    messageEl.classList.remove('hidden');
  }

  /**
   * Exibe mensagem com botão "Jogar Novamente"
   */
  showMessageWithPlayAgain(text, winner) {
    const messageEl = document.getElementById('gameMessage');
    messageEl.innerHTML = ''; // Limpa conteúdo anterior

    // Determina a classe baseada no resultado
    let messageClass = 'info';
    if (winner === 'draw') {
      messageClass = 'draw';
    } else if (winner === 1) {
      messageClass = 'winner';
    }

    messageEl.className = `game-message ${messageClass}`;

    // Cria o texto da mensagem
    const messageText = document.createElement('span');
    messageText.textContent = text;
    messageEl.appendChild(messageText);

    // Cria o botão "Jogar Novamente"
    const playAgainBtn = document.createElement('button');
    playAgainBtn.textContent = '🔄 Jogar Novamente';
    playAgainBtn.className = 'btn btn-play-again';
    playAgainBtn.style.marginLeft = '15px';
    playAgainBtn.addEventListener('click', () => this.resetGame());

    messageEl.appendChild(playAgainBtn);
    messageEl.classList.remove('hidden');
  }

  /**
   * Esconde mensagem
   */
  hideMessage() {
    document.getElementById('gameMessage').classList.add('hidden');
  }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
  const game = new PentagoGameDemo();

  // Torna acessível globalmente para debugging
  window.pentagoGame = game;
});
