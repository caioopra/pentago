/**
 * Pentago Bot - IA para jogar Pentago
 * Adaptado do código original em OLD_PENTAGO_GAME/pentagoBot.js
 */

class PentagoBot {
  constructor(difficulty = 'medium') {
    this.playerNumber = 2; // Bot é sempre o jogador 2
    this.opponent = 1;     // Humano é sempre o jogador 1
    this.difficulty = difficulty; // 'easy', 'medium', 'hard'
  }

  /**
   * Decide o próximo movimento do bot
   * @param {Object} game - Objeto do jogo com board e gamePhase
   * @returns {Object} - { quadrant, cell } ou { quadrant, direction }
   */
  makeMove(game) {
    if (game.gamePhase === 'place') {
      return this.choosePlacement(game);
    } else if (game.gamePhase === 'rotate') {
      return this.chooseRotation(game);
    }
    return null;
  }

  /**
   * Escolhe a melhor célula para colocar uma peça
   */
  choosePlacement(game) {
    const moves = this.getValidPlacements(game.board);
    if (moves.length === 0) return null;

    // EASY: Jogada aleatória 70% do tempo, estratégica 30%
    if (this.difficulty === 'easy' && Math.random() < 0.7) {
      return moves[Math.floor(Math.random() * moves.length)];
    }

    let bestMove = null;
    let bestScore = -Infinity;

    for (const move of moves) {
      const score = this.evaluatePlacementMove(game, move);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  /**
   * Escolhe a melhor rotação
   */
  chooseRotation(game) {
    const rotations = this.getValidRotations();

    // EASY: Rotação aleatória 80% do tempo
    if (this.difficulty === 'easy' && Math.random() < 0.8) {
      return rotations[Math.floor(Math.random() * rotations.length)];
    }

    let bestRotation = null;
    let bestScore = -Infinity;

    for (const rotation of rotations) {
      const score = this.evaluateRotationMove(game, rotation);
      if (score > bestScore) {
        bestScore = score;
        bestRotation = rotation;
      }
    }

    return bestRotation;
  }

  /**
   * Retorna todas as posições válidas para colocar peça
   */
  getValidPlacements(board) {
    const moves = [];
    for (let quadrant = 0; quadrant < 4; quadrant++) {
      for (let cell = 0; cell < 9; cell++) {
        if (board[quadrant][cell] === 0) {
          moves.push({ quadrant, cell });
        }
      }
    }
    return moves;
  }

  /**
   * Retorna todas as rotações possíveis
   */
  getValidRotations() {
    const rotations = [];
    for (let quadrant = 0; quadrant < 4; quadrant++) {
      rotations.push({ quadrant, direction: 'left' });
      rotations.push({ quadrant, direction: 'right' });
    }
    return rotations;
  }

  /**
   * Avalia uma jogada de colocação de peça
   */
  evaluatePlacementMove(game, move) {
    const tempBoard = this.copyBoard(game.board);
    tempBoard[move.quadrant][move.cell] = this.playerNumber;

    let score = 0;

    // EASY: Apenas vitória imediata e bloqueio básico
    if (this.difficulty === 'easy') {
      score += this.checkImmediateWin(tempBoard, this.playerNumber) * 10000;
      score += this.checkBlockOpponentWin(game.board, move) * 3000;
      score += Math.random() * 100; // Mais aleatoriedade
      return score;
    }

    // MEDIUM: Estratégia balanceada
    if (this.difficulty === 'medium') {
      score += this.checkImmediateWin(tempBoard, this.playerNumber) * 10000;
      score += this.checkBlockOpponentWin(game.board, move) * 5000;
      score += this.evaluateThreats(tempBoard, this.playerNumber) * 100;
      score += this.evaluatePositionalValue(move) * 10;
      score += Math.random() * 5;
      return score;
    }

    // HARD: Estratégia avançada com look-ahead
    score += this.checkImmediateWin(tempBoard, this.playerNumber) * 10000;
    score += this.checkBlockOpponentWin(game.board, move) * 6000;
    score += this.evaluateThreats(tempBoard, this.playerNumber) * 150;
    score -= this.evaluateThreats(tempBoard, this.opponent) * 80; // Reduz ameaças do oponente
    score += this.evaluatePositionalValue(move) * 15;
    score += this.evaluateControl(tempBoard) * 20; // Controle do tabuleiro
    score += Math.random() * 2; // Menos aleatoriedade

    return score;
  }

  /**
   * Avalia uma jogada de rotação
   */
  evaluateRotationMove(game, rotation) {
    const tempBoard = this.copyBoard(game.board);
    this.simulateRotation(tempBoard, rotation.quadrant, rotation.direction);

    let score = 0;

    // EASY: Apenas vitória e bloqueio básico
    if (this.difficulty === 'easy') {
      score += this.checkImmediateWin(tempBoard, this.playerNumber) * 10000;
      score += this.checkBlockOpponentWin(tempBoard, null, this.opponent) * 3000;
      score += Math.random() * 100;
      return score;
    }

    // MEDIUM: Estratégia balanceada
    if (this.difficulty === 'medium') {
      score += this.checkImmediateWin(tempBoard, this.playerNumber) * 10000;
      score += this.checkBlockOpponentWin(tempBoard, null, this.opponent) * 5000;
      score += this.evaluateThreats(tempBoard, this.playerNumber) * 100;
      score -= this.evaluateThreats(tempBoard, this.opponent) * 50;
      score += Math.random() * 5;
      return score;
    }

    // HARD: Estratégia avançada
    score += this.checkImmediateWin(tempBoard, this.playerNumber) * 10000;
    score += this.checkBlockOpponentWin(tempBoard, null, this.opponent) * 6000;
    score += this.evaluateThreats(tempBoard, this.playerNumber) * 150;
    score -= this.evaluateThreats(tempBoard, this.opponent) * 100;
    score += this.evaluateControl(tempBoard) * 20;
    score += Math.random() * 2;

    return score;
  }

  /**
   * Verifica se a jogada resulta em vitória imediata
   */
  checkImmediateWin(board, player) {
    const fullBoard = this.convertToFullBoard(board);
    return this.checkPlayerWin(fullBoard, player) ? 1 : 0;
  }

  /**
   * Verifica se precisa bloquear vitória do oponente
   */
  checkBlockOpponentWin(board, move, player = null) {
    if (!move) {
      return this.checkImmediateWin(board, player || this.opponent) ? 1 : 0;
    }

    const tempBoard = this.copyBoard(board);
    tempBoard[move.quadrant][move.cell] = this.opponent;

    const fullBoard = this.convertToFullBoard(tempBoard);
    return this.checkPlayerWin(fullBoard, this.opponent) ? 1 : 0;
  }

  /**
   * Avalia ameaças (sequências de 2, 3 ou 4 peças)
   */
  evaluateThreats(board, player) {
    const fullBoard = this.convertToFullBoard(board);
    let threats = 0;

    const directions = [
      [0, 1],   // horizontal
      [1, 0],   // vertical
      [1, 1],   // diagonal
      [1, -1]   // anti-diagonal
    ];

    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 6; col++) {
        if (fullBoard[row][col] === player) {
          for (let [dRow, dCol] of directions) {
            const lineValue = this.evaluateLine(fullBoard, row, col, dRow, dCol, player);
            threats += lineValue;
          }
        }
      }
    }

    return threats;
  }

  /**
   * Avalia uma linha específica
   */
  evaluateLine(board, startRow, startCol, dRow, dCol, player) {
    let count = 0;
    let empty = 0;
    let blocked = false;

    for (let i = 0; i < 5; i++) {
      const row = startRow + i * dRow;
      const col = startCol + i * dCol;

      if (row < 0 || row >= 6 || col < 0 || col >= 6) {
        blocked = true;
        break;
      }

      const cell = board[row][col];
      if (cell === player) {
        count++;
      } else if (cell === 0) {
        empty++;
      } else {
        blocked = true;
        break;
      }
    }

    if (blocked) return 0;
    if (count + empty < 5) return 0;

    // Valoriza mais sequências maiores
    return count * count * (empty > 0 ? 1.5 : 1);
  }

  /**
   * Avalia valor posicional (centro é melhor)
   */
  evaluatePositionalValue(move) {
    const centerValues = [
      [1, 2, 1],
      [2, 4, 2],
      [1, 2, 1]
    ];

    const row = Math.floor(move.cell / 3);
    const col = move.cell % 3;
    return centerValues[row][col];
  }

  /**
   * Avalia controle do tabuleiro (HARD difficulty)
   * Conta a diferença entre peças do bot e do oponente
   */
  evaluateControl(board) {
    let botPieces = 0;
    let opponentPieces = 0;

    for (let q = 0; q < 4; q++) {
      for (let c = 0; c < 9; c++) {
        if (board[q][c] === this.playerNumber) {
          botPieces++;
        } else if (board[q][c] === this.opponent) {
          opponentPieces++;
        }
      }
    }

    return botPieces - opponentPieces;
  }

  /**
   * Converte board de quadrantes para matriz 6x6
   */
  convertToFullBoard(board) {
    const fullBoard = Array(6).fill().map(() => Array(6).fill(0));

    for (let q = 0; q < 4; q++) {
      const startRow = Math.floor(q / 2) * 3;
      const startCol = (q % 2) * 3;

      for (let i = 0; i < 9; i++) {
        const row = Math.floor(i / 3);
        const col = i % 3;
        fullBoard[startRow + row][startCol + col] = board[q][i];
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
   * Verifica 5 em linha em uma direção
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
   * Simula uma rotação no board
   */
  simulateRotation(board, quadrant, direction) {
    const quad = board[quadrant];
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

    board[quadrant] = rotated;
  }

  /**
   * Copia o board
   */
  copyBoard(board) {
    return board.map(quadrant => [...quadrant]);
  }
}
