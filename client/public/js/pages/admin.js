/**
 * Admin Panel JavaScript
 * Gerencia o painel administrativo do Pentago Web
 */

// Estado da aplicacao
const state = {
  users: {
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
    search: '',
    role: '',
    isBanned: ''
  },
  games: {
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
    status: ''
  },
  currentUserId: null
};

// Inicializacao
document.addEventListener('DOMContentLoaded', async () => {
  // Verificar autenticacao
  if (!requireAuth()) return;

  // Obter dados do usuario
  try {
    const response = await AuthAPI.getMe();
    if (!response.success) {
      window.location.href = '/pages/login.html';
      return;
    }

    const user = response.data;

    if (user.role !== 'admin') {
      UIUtils.showMessage('Acesso negado. Voce nao tem permissao para acessar esta pagina.', 'error');
      setTimeout(() => {
        window.location.href = '/pages/index.html';
      }, 2000);
      return;
    }
  } catch (error) {
    console.error('Erro ao verificar autenticacao:', error);
    window.location.href = '/pages/login.html';
    return;
  }

  // Configurar event listeners
  setupEventListeners();

  // Carregar dados iniciais
  loadDashboard();
});

// Configurar event listeners
function setupEventListeners() {
  // Tabs navigation
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const section = tab.dataset.section;
      switchSection(section);
    });
  });

  // Users search
  document.getElementById('searchUsersBtn').addEventListener('click', () => {
    state.users.page = 1;
    state.users.search = document.getElementById('userSearch').value;
    state.users.role = document.getElementById('userRoleFilter').value;
    state.users.isBanned = document.getElementById('userBanFilter').value;
    loadUsers();
  });

  document.getElementById('userSearch').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('searchUsersBtn').click();
    }
  });

  // Users pagination
  document.getElementById('usersPrevBtn').addEventListener('click', () => {
    if (state.users.page > 1) {
      state.users.page--;
      loadUsers();
    }
  });

  document.getElementById('usersNextBtn').addEventListener('click', () => {
    if (state.users.page < state.users.pages) {
      state.users.page++;
      loadUsers();
    }
  });

  // Games filter
  document.getElementById('searchGamesBtn').addEventListener('click', () => {
    state.games.page = 1;
    state.games.status = document.getElementById('gameStatusFilter').value;
    loadGames();
  });

  // Games pagination
  document.getElementById('gamesPrevBtn').addEventListener('click', () => {
    if (state.games.page > 1) {
      state.games.page--;
      loadGames();
    }
  });

  document.getElementById('gamesNextBtn').addEventListener('click', () => {
    if (state.games.page < state.games.pages) {
      state.games.page++;
      loadGames();
    }
  });

  // Ban modal
  document.getElementById('cancelBanBtn').addEventListener('click', () => {
    closeBanModal();
  });

  document.getElementById('confirmBanBtn').addEventListener('click', async () => {
    await banUser();
  });

  // Delete modal
  document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
    closeDeleteModal();
  });

  document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    await deleteUser();
  });

  // Close modals on outside click
  document.getElementById('banModal').addEventListener('click', (e) => {
    if (e.target.id === 'banModal') closeBanModal();
  });

  document.getElementById('deleteModal').addEventListener('click', (e) => {
    if (e.target.id === 'deleteModal') closeDeleteModal();
  });
}

// Alternar entre secoes
function switchSection(sectionId) {
  // Update tabs
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.classList.remove('active');
    if (tab.dataset.section === sectionId) {
      tab.classList.add('active');
    }
  });

  // Update sections
  document.querySelectorAll('.admin-section').forEach(section => {
    section.classList.remove('active');
  });
  document.getElementById(sectionId).classList.add('active');

  // Load section data
  switch (sectionId) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'users':
      loadUsers();
      break;
    case 'games':
      loadGames();
      break;
    case 'config':
      loadConfig();
      break;
  }
}

// Carregar dashboard com estatisticas
async function loadDashboard() {
  try {
    const response = await apiRequest('/api/admin/stats');

    if (response.success) {
      const { users, games, topPlayers } = response.data;

      // Update stats
      document.getElementById('totalUsers').textContent = users.total;
      document.getElementById('onlineUsers').textContent = users.online;
      document.getElementById('bannedUsers').textContent = users.banned;
      document.getElementById('adminUsers').textContent = users.admins;
      document.getElementById('totalGames').textContent = games.total;
      document.getElementById('activeGames').textContent = games.active;
      document.getElementById('newUsersWeek').textContent = users.newLastWeek;
      document.getElementById('recentGamesWeek').textContent = games.recentLastWeek;

      // Update top players
      const topPlayersList = document.getElementById('topPlayersList');
      if (topPlayers.length === 0) {
        topPlayersList.innerHTML = '<li>Nenhum jogador encontrado</li>';
      } else {
        topPlayersList.innerHTML = topPlayers.map((player, index) => `
          <li>
            <span class="rank-number">#${index + 1}</span>
            <img src="${player.avatar}" alt="${player.name}" class="player-avatar-small">
            <span class="player-info">${player.name}</span>
            <span class="player-score">${player.score} pts</span>
          </li>
        `).join('');
      }
    }
  } catch (error) {
    console.error('Erro ao carregar dashboard:', error);
    UIUtils.showMessage('Erro ao carregar estatisticas.', 'error');
  }
}

// Carregar lista de usuarios
async function loadUsers() {
  try {
    const params = new URLSearchParams({
      page: state.users.page,
      limit: state.users.limit
    });

    if (state.users.search) params.append('search', state.users.search);
    if (state.users.role) params.append('role', state.users.role);
    if (state.users.isBanned) params.append('isBanned', state.users.isBanned);

    const response = await apiRequest(`/api/admin/users?${params}`);

    if (response.success) {
      state.users.total = response.pagination.total;
      state.users.pages = response.pagination.pages;

      renderUsersTable(response.data);
      updateUsersPagination();
    }
  } catch (error) {
    console.error('Erro ao carregar usuarios:', error);
    UIUtils.showMessage('Erro ao carregar usuarios.', 'error');
  }
}

// Renderizar tabela de usuarios
function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nenhum usuario encontrado</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(user => `
    <tr>
      <td>
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="${user.avatar}" alt="${user.name}" style="width: 30px; height: 30px; border-radius: 50%;">
          <span>${user.name}</span>
        </div>
      </td>
      <td>${user.email}</td>
      <td><span class="badge ${user.role}">${user.role === 'admin' ? 'Admin' : 'Usuario'}</span></td>
      <td>
        ${user.isBanned ? '<span class="badge banned">Banido</span>' :
          (user.isOnline ? '<span class="badge online">Online</span>' : '<span class="badge offline">Offline</span>')}
      </td>
      <td>${user.score}</td>
      <td>
        ${user.role !== 'admin' ? `
          ${user.isBanned ?
            `<button class="action-btn unban" onclick="showUnbanUser('${user._id}', '${user.name}')">Desbanir</button>` :
            `<button class="action-btn ban" onclick="showBanModal('${user._id}', '${user.name}')">Banir</button>`
          }
          <button class="action-btn promote" onclick="promoteUser('${user._id}', '${user.name}')">Promover</button>
          <button class="action-btn delete" onclick="showDeleteModal('${user._id}', '${user.name}')">Deletar</button>
        ` : `
          <button class="action-btn demote" onclick="demoteUser('${user._id}', '${user.name}')">Rebaixar</button>
        `}
      </td>
    </tr>
  `).join('');
}

// Atualizar paginacao de usuarios
function updateUsersPagination() {
  document.getElementById('usersPageInfo').textContent = `Pagina ${state.users.page} de ${state.users.pages || 1}`;
  document.getElementById('usersPrevBtn').disabled = state.users.page <= 1;
  document.getElementById('usersNextBtn').disabled = state.users.page >= state.users.pages;
}

// Mostrar modal de banimento
function showBanModal(userId, userName) {
  state.currentUserId = userId;
  document.getElementById('banUserName').textContent = userName;
  document.getElementById('banReason').value = '';
  document.getElementById('banModal').classList.add('active');
}

// Fechar modal de banimento
function closeBanModal() {
  document.getElementById('banModal').classList.remove('active');
  state.currentUserId = null;
}

// Banir usuario
async function banUser() {
  if (!state.currentUserId) return;

  try {
    const reason = document.getElementById('banReason').value || 'Motivo nao especificado';
    const response = await apiRequest(`/api/admin/users/${state.currentUserId}/ban`, {
      method: 'PUT',
      body: JSON.stringify({ reason })
    });

    if (response.success) {
      UIUtils.showMessage(response.message, 'success');
      closeBanModal();
      loadUsers();
      loadDashboard();
    } else {
      UIUtils.showMessage(response.message, 'error');
    }
  } catch (error) {
    console.error('Erro ao banir usuario:', error);
    UIUtils.showMessage('Erro ao banir usuario.', 'error');
  }
}

// Desbanir usuario
async function showUnbanUser(userId, userName) {
  if (!confirm(`Deseja desbanir o usuario ${userName}?`)) return;

  try {
    const response = await apiRequest(`/api/admin/users/${userId}/unban`, {
      method: 'PUT'
    });

    if (response.success) {
      UIUtils.showMessage(response.message, 'success');
      loadUsers();
      loadDashboard();
    } else {
      UIUtils.showMessage(response.message, 'error');
    }
  } catch (error) {
    console.error('Erro ao desbanir usuario:', error);
    UIUtils.showMessage('Erro ao desbanir usuario.', 'error');
  }
}

// Mostrar modal de exclusao
function showDeleteModal(userId, userName) {
  state.currentUserId = userId;
  document.getElementById('deleteUserName').textContent = userName;
  document.getElementById('deleteModal').classList.add('active');
}

// Fechar modal de exclusao
function closeDeleteModal() {
  document.getElementById('deleteModal').classList.remove('active');
  state.currentUserId = null;
}

// Deletar usuario
async function deleteUser() {
  if (!state.currentUserId) return;

  try {
    const response = await apiRequest(`/api/admin/users/${state.currentUserId}`, {
      method: 'DELETE'
    });

    if (response.success) {
      UIUtils.showMessage(response.message, 'success');
      closeDeleteModal();
      loadUsers();
      loadDashboard();
    } else {
      UIUtils.showMessage(response.message, 'error');
    }
  } catch (error) {
    console.error('Erro ao deletar usuario:', error);
    UIUtils.showMessage('Erro ao deletar usuario.', 'error');
  }
}

// Promover usuario a admin
async function promoteUser(userId, userName) {
  if (!confirm(`Deseja promover ${userName} a administrador?`)) return;

  try {
    const response = await apiRequest(`/api/admin/users/${userId}/promote`, {
      method: 'PUT'
    });

    if (response.success) {
      UIUtils.showMessage(response.message, 'success');
      loadUsers();
      loadDashboard();
    } else {
      UIUtils.showMessage(response.message, 'error');
    }
  } catch (error) {
    console.error('Erro ao promover usuario:', error);
    UIUtils.showMessage('Erro ao promover usuario.', 'error');
  }
}

// Rebaixar admin a usuario
async function demoteUser(userId, userName) {
  if (!confirm(`Deseja rebaixar ${userName} a usuario comum?`)) return;

  try {
    const response = await apiRequest(`/api/admin/users/${userId}/demote`, {
      method: 'PUT'
    });

    if (response.success) {
      UIUtils.showMessage(response.message, 'success');
      loadUsers();
      loadDashboard();
    } else {
      UIUtils.showMessage(response.message, 'error');
    }
  } catch (error) {
    console.error('Erro ao rebaixar usuario:', error);
    UIUtils.showMessage('Erro ao rebaixar usuario.', 'error');
  }
}

// Carregar lista de jogos
async function loadGames() {
  try {
    const params = new URLSearchParams({
      page: state.games.page,
      limit: state.games.limit
    });

    if (state.games.status) params.append('status', state.games.status);

    const response = await apiRequest(`/api/admin/games?${params}`);

    if (response.success) {
      state.games.total = response.pagination.total;
      state.games.pages = response.pagination.pages;

      renderGamesTable(response.data);
      updateGamesPagination();
    }
  } catch (error) {
    console.error('Erro ao carregar jogos:', error);
    UIUtils.showMessage('Erro ao carregar jogos.', 'error');
  }
}

// Renderizar tabela de jogos
function renderGamesTable(games) {
  const tbody = document.getElementById('gamesTableBody');

  if (games.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Nenhum jogo encontrado</td></tr>';
    return;
  }

  const statusLabels = {
    waiting: 'Aguardando',
    playing: 'Em andamento',
    finished: 'Finalizado',
    abandoned: 'Abandonado'
  };

  tbody.innerHTML = games.map(game => `
    <tr>
      <td title="${game._id}">${game._id.substring(0, 8)}...</td>
      <td>${game.user1 ? game.user1.name : 'N/A'}</td>
      <td>${game.user2 ? game.user2.name : 'Aguardando...'}</td>
      <td><span class="badge ${game.status}">${statusLabels[game.status] || game.status}</span></td>
      <td>${game.winner ? game.winner.name : '-'}</td>
      <td>${new Date(game.createdAt).toLocaleDateString('pt-BR')}</td>
      <td>
        <button class="action-btn delete" onclick="deleteGame('${game._id}')">Deletar</button>
      </td>
    </tr>
  `).join('');
}

// Atualizar paginacao de jogos
function updateGamesPagination() {
  document.getElementById('gamesPageInfo').textContent = `Pagina ${state.games.page} de ${state.games.pages || 1}`;
  document.getElementById('gamesPrevBtn').disabled = state.games.page <= 1;
  document.getElementById('gamesNextBtn').disabled = state.games.page >= state.games.pages;
}

// Deletar jogo
async function deleteGame(gameId) {
  if (!confirm('Deseja deletar este jogo?')) return;

  try {
    const response = await apiRequest(`/api/admin/games/${gameId}`, {
      method: 'DELETE'
    });

    if (response.success) {
      UIUtils.showMessage(response.message, 'success');
      loadGames();
      loadDashboard();
    } else {
      UIUtils.showMessage(response.message, 'error');
    }
  } catch (error) {
    console.error('Erro ao deletar jogo:', error);
    UIUtils.showMessage('Erro ao deletar jogo.', 'error');
  }
}

// Carregar configuracoes
async function loadConfig() {
  try {
    const response = await apiRequest('/api/admin/config');

    if (response.success) {
      const { game, video, upload, rateLimit } = response.data;

      // Game config
      document.getElementById('configMaxQueue').textContent = `${game.maxQueueSize} jogadores`;
      document.getElementById('configInactivity').textContent = `${game.inactivityTimeout} segundos`;
      document.getElementById('configMaxDuration').textContent = `${game.maxGameDuration} minutos`;

      // Video config
      document.getElementById('configVideoAge').textContent = `${video.maxAgeDays} dias`;
      document.getElementById('configVideoSize').textContent = `${video.maxSizeGB} GB`;
      document.getElementById('configVideoFps').textContent = video.fps;
      document.getElementById('configVideoBitrate').textContent = video.bitrate;

      // Upload config
      document.getElementById('configUploadSize').textContent = `${upload.maxSizeMB} MB`;

      // Rate limit config
      document.getElementById('configRateWindow').textContent = `${Math.round(rateLimit.windowMs / 60000)} minutos`;
      document.getElementById('configRateMax').textContent = `${rateLimit.maxRequests} requisicoes`;
    }
  } catch (error) {
    console.error('Erro ao carregar configuracoes:', error);
    UIUtils.showMessage('Erro ao carregar configuracoes.', 'error');
  }
}
