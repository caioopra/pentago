/**
 * Pentago Game - Client-side logic
 * Adaptado da implementação original para integração com o sistema web
 */

class PentagoGame {
  constructor() {
    // Estado do jogo
    this.board = Array(4).fill().map(() => Array(9).fill(0));
    this.currentPlayer = 1;
    this.gamePhase = 'place'; // 'place' ou 'rotate'
    this.gameMode = '2player'; // '2player' ou 'bot'
    this.gameOver = false;
    this.winner = null;

    // Informações dos jogadores
    this.players = {
      1: {
        name: 'Jogador 1',
        avatar: '/assets/img/avatars/default.png',
        score: 0
      },
      2: {
        name: 'Jogador 2',
        avatar: '/assets/img/avatars/default.png',
        score: 0
      }
    };

    // Inicializar interface e eventos
    this.initializeEventListeners();
    this.initializePlayers();
    this.updateDisplay();
  }

  /**
   * Inicializa os event listeners
   */
  initializeEventListeners() {
    // Botão de reset
    document.getElementById('resetBtn').addEventListener('click', () => this.resetGame());

    // Células do tabuleiro
    document.querySelectorAll('.cell').forEach(cell => {
      cell.addEventListener('click', (e) => this.handleCellClick(e));
    });

    // Botões de rotação
    document.querySelectorAll('.rotate-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleRotateClick(e));
    });
  }

  /**
   * Inicializa informações dos jogadores
   * Futuramente vai buscar dados do servidor
   */
  async initializePlayers() {
    // TODO: Buscar informações dos jogadores autenticados
    // Por enquanto, usa dados padrão
    this.updatePlayerUI(1, this.players[1]);
    this.updatePlayerUI(2, this.players[2]);
  }

  /**
   * Atualiza a UI com informações do jogador
   */
  updatePlayerUI(playerNumber, playerData) {
    document.getElementById(`player${playerNumber}Name`).textContent = playerData.name;
    document.getElementById(`player${playerNumber}Avatar`).src = playerData.avatar;
    document.getElementById(`player${playerNumber}Score`).textContent = playerData.score;
  }

  /**
   * Manipula clique em uma célula do tabuleiro
   */
  handleCellClick(e) {
    // Validações
    if (this.gameOver || this.gamePhase !== 'place') return;

    const quadrant = parseInt(e.target.dataset.quadrant);
    const cell = parseInt(e.target.dataset.cell);

    // Verifica se a célula está vazia
    if (this.board[quadrant][cell] !== 0) return;

    // Coloca a peça
    this.placePiece(quadrant, cell);
    this.updateDisplay();

    // Verifica vitória após colocar peça
    if (this.checkWinCondition()) {
      this.endGame(this.currentPlayer);
      return;
    }

    // Muda para fase de rotação
    this.gamePhase = 'rotate';
    this.updateDisplay();
  }

  /**
   * Manipula clique em botão de rotação
   */
  handleRotateClick(e) {
    // Validações
    if (this.gameOver || this.gamePhase !== 'rotate') return;

    const quadrant = parseInt(e.target.dataset.quadrant);
    const direction = e.target.dataset.direction;

    // Rotaciona o quadrante
    this.rotateQuadrant(quadrant, direction);
    this.updateDisplay();

    // Verifica vitória após rotação
    if (this.checkWinCondition()) {
      this.endGame(this.currentPlayer);
      return;
    }

    // Troca de jogador e volta para fase de colocação
    this.switchPlayer();
    this.gamePhase = 'place';
    this.updateDisplay();
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
  rotateQuadrant(quadrant, direction) {
    const quad = this.board[quadrant];
    const rotated = new Array(9);

    if (direction === 'right') {
      // Rotação horária (90° direita)
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
      // Rotação anti-horária (90° esquerda)
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

    this.board[quadrant] = rotated;

    // Animação de rotação
    const quadrantElement = document.getElementById(`quadrant-${quadrant}`);
    quadrantElement.classList.add('rotate-animation');

    setTimeout(() => {
      quadrantElement.classList.remove('rotate-animation');
    }, 500);
  }

  /**
   * Verifica condição de vitória
   */
  checkWinCondition() {
    const fullBoard = this.convertToFullBoard();

    // Verifica vitória para ambos os jogadores
    for (let player = 1; player <= 2; player++) {
      if (this.checkPlayerWin(fullBoard, player)) {
        this.winner = player;
        return true;
      }
    }

    // Verifica empate (tabuleiro cheio)
    if (this.isBoardFull()) {
      this.winner = 'draw';
      return true;
    }

    return false;
  }

  /**
   * Converte board de quadrantes para tabuleiro 6x6 completo
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
      [1, 1],   // diagonal principal
      [1, -1]   // diagonal secundária
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
   * Verifica 5 em linha em uma direção específica
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
   * Verifica se o tabuleiro está cheio
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
   * Troca o jogador atual
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
    this.updatePlayerStatus();
  }

  /**
   * Atualiza o tabuleiro visual
   */
  updateBoard() {
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
    display.textContent = this.players[this.currentPlayer].name;
    display.className = `player-badge player-${this.currentPlayer}-badge`;
  }

  /**
   * Atualiza a fase do jogo
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
    document.querySelectorAll('.quadrant').forEach((quad) => {
      quad.classList.remove('rotation-phase');

      const rotateButtons = quad.querySelectorAll('.rotate-btn');
      rotateButtons.forEach(btn => {
        btn.disabled = this.gamePhase !== 'rotate' || this.gameOver;
      });
    });

    if (this.gamePhase === 'rotate') {
      document.querySelectorAll('.quadrant').forEach(quad => {
        quad.classList.add('rotation-phase');
      });
    }
  }

  /**
   * Atualiza status dos jogadores (indica quem está jogando)
   */
  updatePlayerStatus() {
    const player1Status = document.getElementById('player1Status');
    const player2Status = document.getElementById('player2Status');

    // Remove classes ativas
    player1Status.classList.remove('active');
    player2Status.classList.remove('active');

    // Adiciona classe ativa ao jogador atual
    if (this.currentPlayer === 1) {
      player1Status.classList.add('active');
    } else {
      player2Status.classList.add('active');
    }
  }

  /**
   * Finaliza o jogo
   */
  endGame(winner) {
    this.gameOver = true;
    this.winner = winner;

    if (winner === 'draw') {
      this.showMessage('O jogo terminou empatado!', 'draw');
    } else {
      const winnerName = this.players[winner].name;
      this.showMessage(`🎉 ${winnerName.toUpperCase()} VENCEU! 🎉`, 'winner');

      // Atualiza pontuação do vencedor
      this.players[winner].score++;
      this.updatePlayerUI(winner, this.players[winner]);
    }

    // Desabilita todos os botões de rotação
    document.querySelectorAll('.rotate-btn').forEach(btn => {
      btn.disabled = true;
    });

    // TODO: Enviar resultado para o servidor
    // this.sendGameResult();
  }

  /**
   * Exibe mensagem na tela
   */
  showMessage(text, type = 'info') {
    const messageEl = document.getElementById('gameMessage');
    messageEl.textContent = text;
    messageEl.className = `game-message ${type}`;
    messageEl.classList.remove('hidden');
  }

  /**
   * Esconde a mensagem
   */
  hideMessage() {
    document.getElementById('gameMessage').classList.add('hidden');
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

    this.hideMessage();
    this.updateDisplay();
  }

  /**
   * Envia resultado do jogo para o servidor
   * TODO: Implementar quando WebSocket estiver pronto
   */
  async sendGameResult() {
    // const result = {
    //   winner: this.winner,
    //   players: [
    //     { id: this.players[1].id, score: this.players[1].score },
    //     { id: this.players[2].id, score: this.players[2].score }
    //   ],
    //   finalBoard: this.board
    // };

    // await fetch('/api/games/result', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(result)
    // });
  }
}

// Inicializa o jogo quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
  const game = new PentagoGame();

  // Torna o jogo acessível globalmente para debugging
  window.pentagoGame = game;
});
