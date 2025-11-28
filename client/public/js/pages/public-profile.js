/**
 * Public Profile Page Logic
 */

// DOM Elements
const loadingMessage = document.getElementById('loadingMessage');
const errorMessage = document.getElementById('errorMessage');
const profileContent = document.getElementById('profileContent');

// Profile elements
const profileAvatar = document.getElementById('profileAvatar');
const profileName = document.getElementById('profileName');
const profileLocation = document.getElementById('profileLocation');
const profileRank = document.getElementById('profileRank');
const profileScore = document.getElementById('profileScore');
const memberSince = document.getElementById('memberSince');

// Statistics elements
const totalGames = document.getElementById('totalGames');
const wins = document.getElementById('wins');
const losses = document.getElementById('losses');
const draws = document.getElementById('draws');
const winRate = document.getElementById('winRate');

// Recent games elements
const recentGamesSection = document.getElementById('recentGamesSection');
const recentGamesList = document.getElementById('recentGamesList');
const noGamesMessage = document.getElementById('noGamesMessage');

/**
 * Get user ID from URL parameters
 */
function getUserIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('id');
}

/**
 * Format date to Portuguese locale
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Format datetime to Portuguese locale
 */
function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format location string
 */
function formatLocation(location) {
  const parts = [];
  if (location.city) parts.push(location.city);
  if (location.state) parts.push(location.state);
  if (location.country) parts.push(location.country);
  return parts.length > 0 ? parts.join(', ') : 'Localização não informada';
}

/**
 * Render recent games list
 */
function renderRecentGames(games, currentUserId) {
  if (!games || games.length === 0) {
    recentGamesSection.style.display = 'block';
    noGamesMessage.style.display = 'block';
    return;
  }

  recentGamesSection.style.display = 'block';
  recentGamesList.innerHTML = '';

  games.forEach(game => {
    const gameItem = document.createElement('div');
    gameItem.className = 'game-item';

    // Determine result from current user's perspective
    let resultClass = 'draw';
    let resultText = 'Empate';

    if (game.winner) {
      if (game.winner.id === currentUserId) {
        resultClass = 'win';
        resultText = 'Vitória';
      } else {
        resultClass = 'loss';
        resultText = 'Derrota';
      }
    }

    // Create video link if available
    const videoLink = game.video ? `
      <a href="/api/videos/${game.video.id}" target="_blank" class="game-video-link" title="Assistir gravação">
        🎥 Vídeo
      </a>
    ` : '';

    // Create game HTML
    gameItem.innerHTML = `
      <div class="game-players">
        <img src="${game.player1.avatar}" alt="${game.player1.name}" class="game-avatar" title="${game.player1.name}">
        <span class="game-player-name">${game.player1.name}</span>
        <span class="game-vs">vs</span>
        <img src="${game.player2.avatar}" alt="${game.player2.name}" class="game-avatar" title="${game.player2.name}">
        <span class="game-player-name">${game.player2.name}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 1rem;">
        <span class="game-result ${resultClass}">${resultText}</span>
        <span class="game-date">${formatDateTime(game.date)}</span>
        ${videoLink}
      </div>
    `;

    recentGamesList.appendChild(gameItem);
  });
}

/**
 * Load and display public profile
 */
async function loadPublicProfile() {
  try {
    const userId = getUserIdFromUrl();

    if (!userId) {
      throw new Error('ID do usuário não especificado na URL');
    }

    // Show loading
    loadingMessage.style.display = 'block';
    errorMessage.style.display = 'none';
    profileContent.style.display = 'none';

    // Fetch profile data
    const response = await UserAPI.getPublicProfile(userId);

    if (!response.success) {
      throw new Error(response.message || 'Erro ao carregar perfil');
    }

    const { user, statistics, recentGames } = response.data;

    // Update profile header
    profileAvatar.src = user.avatar || '/assets/img/avatars/default.png';
    profileAvatar.alt = user.name;
    profileName.textContent = user.name;
    profileLocation.textContent = formatLocation(user.location);
    profileRank.textContent = `#${user.rank} no Ranking`;
    profileScore.textContent = `${user.score} pontos`;
    memberSince.textContent = formatDate(user.memberSince);

    // Update statistics
    totalGames.textContent = statistics.totalGames;
    wins.textContent = statistics.wins;
    losses.textContent = statistics.losses;
    draws.textContent = statistics.draws;
    winRate.textContent = `${statistics.winRate}%`;

    // Render recent games
    renderRecentGames(recentGames, userId);

    // Hide loading, show content
    loadingMessage.style.display = 'none';
    profileContent.style.display = 'block';

    // Update page title
    document.title = `${user.name} - Perfil Público - Pentago Web`;

  } catch (error) {
    console.error('Erro ao carregar perfil público:', error);

    // Show error message
    loadingMessage.style.display = 'none';
    profileContent.style.display = 'none';
    errorMessage.style.display = 'block';
    errorMessage.textContent = error.message || 'Erro ao carregar perfil. Tente novamente mais tarde.';
  }
}

// Load profile on page load
document.addEventListener('DOMContentLoaded', loadPublicProfile);
