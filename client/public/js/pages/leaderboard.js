/**
 * Pentago - Leaderboard Page
 * Displays player scores and rankings
 */

class LeaderboardPage {
  constructor() {
    this.users = [];
    this.init();
  }

  async init() {
    await this.fetchLeaderboard();
  }

  async fetchLeaderboard() {
    try {
      // Build absolute URL to avoid credential parsing issues
      const url = new URL('/api/users/leaderboard/full', window.location.origin);
      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.success) {
        this.users = data.data.users;
        this.renderLeaderboard();
      } else {
        this.showError(data.message || 'Erro ao carregar placar');
      }
    } catch (error) {
      console.error('Erro ao buscar placar:', error);
      this.showError('Erro ao conectar com o servidor');
    }
  }

  renderLeaderboard() {
    // Hide loading
    document.getElementById('loadingState').style.display = 'none';

    if (this.users.length === 0) {
      this.showError('Nenhum jogador registrado ainda');
      return;
    }

    // Show sections
    document.getElementById('podiumSection').style.display = 'block';
    document.getElementById('tableSection').style.display = 'block';

    // Render podium (top 3)
    this.renderPodium();

    // Render full table
    this.renderTable();

    // Update stats
    document.getElementById('totalPlayers').textContent = this.users.length;
  }

  renderPodium() {
    const top3 = this.users.slice(0, 3);

    // First place
    if (top3[0]) {
      this.renderPodiumPlace('firstPlace', top3[0]);
    }

    // Second place
    if (top3[1]) {
      this.renderPodiumPlace('secondPlace', top3[1]);
    }

    // Third place
    if (top3[2]) {
      this.renderPodiumPlace('thirdPlace', top3[2]);
    }
  }

  renderPodiumPlace(elementId, user) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const avatar = element.querySelector('.podium-avatar');
    const name = element.querySelector('.podium-name');
    const score = element.querySelector('.podium-score');

    if (avatar) avatar.src = user.avatar || '/assets/img/avatars/default.png';
    if (name) name.textContent = user.name;
    if (score) score.textContent = `${user.score} pts`;
  }

  renderTable() {
    const tbody = document.getElementById('leaderboardTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    this.users.forEach((user) => {
      const row = document.createElement('tr');

      // Rank
      const rankCell = document.createElement('td');
      rankCell.className = 'col-rank';
      rankCell.innerHTML = this.getRankBadge(user.rank);
      row.appendChild(rankCell);

      // Avatar
      const avatarCell = document.createElement('td');
      avatarCell.className = 'col-avatar';
      avatarCell.innerHTML = `
        <img src="${user.avatar || '/assets/img/avatars/default.png'}"
             alt="${user.name}"
             class="player-avatar">
      `;
      row.appendChild(avatarCell);

      // Name
      const nameCell = document.createElement('td');
      nameCell.className = 'col-name';
      nameCell.innerHTML = `
        <div class="player-name">
          <div class="player-name-text">${user.name}</div>
          <div class="player-email">${user.email}</div>
        </div>
      `;
      row.appendChild(nameCell);

      // Score
      const scoreCell = document.createElement('td');
      scoreCell.className = 'col-score';
      scoreCell.innerHTML = `<span class="score-value">${user.score}</span>`;
      row.appendChild(scoreCell);

      // Location
      const locationCell = document.createElement('td');
      locationCell.className = 'col-location';
      const location = this.formatLocation(user);
      locationCell.innerHTML = `<span class="location-text">${location}</span>`;
      row.appendChild(locationCell);

      // Age
      const ageCell = document.createElement('td');
      ageCell.className = 'col-age';
      ageCell.innerHTML = `<span class="age-text">${user.age || '-'}</span>`;
      row.appendChild(ageCell);

      tbody.appendChild(row);
    });
  }

  getRankBadge(rank) {
    let badgeClass = 'rank-other';
    let rankText = rank;

    if (rank === 1) {
      badgeClass = 'rank-1';
      rankText = '🥇';
    } else if (rank === 2) {
      badgeClass = 'rank-2';
      rankText = '🥈';
    } else if (rank === 3) {
      badgeClass = 'rank-3';
      rankText = '🥉';
    }

    return `<span class="rank-badge ${badgeClass}">${rankText}</span>`;
  }

  formatLocation(user) {
    const parts = [];
    if (user.city) parts.push(user.city);
    if (user.state) parts.push(user.state);
    if (user.country) parts.push(user.country);

    return parts.length > 0 ? parts.join(', ') : 'Não informado';
  }

  showError(message) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'block';
    document.getElementById('errorMessage').textContent = message;
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  new LeaderboardPage();
});
