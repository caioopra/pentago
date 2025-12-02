/**
 * Utilitário para chamadas à API
 * Gerencia autenticação, headers e erros
 */

const API_BASE_URL = '/api';

/**
 * Classe para gerenciar o token de autenticação
 */
class AuthManager {
  static TOKEN_KEY = 'pentago_auth_token';
  static USER_KEY = 'pentago_user';
  static CSRF_TOKEN_KEY = 'pentago_csrf_token';

  static setToken(token) {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  static getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static removeToken() {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  static setCsrfToken(token) {
    localStorage.setItem(this.CSRF_TOKEN_KEY, token);
  }

  static getCsrfToken() {
    return localStorage.getItem(this.CSRF_TOKEN_KEY);
  }

  static removeCsrfToken() {
    localStorage.removeItem(this.CSRF_TOKEN_KEY);
  }

  static async fetchCsrfToken() {
    try {
      // Build absolute URL to avoid any credential parsing issues
      const url = new URL('/api/csrf-token', window.location.origin);
      const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json'
        }
      });
      const data = await response.json();
      if (data.success && data.csrfToken) {
        this.setCsrfToken(data.csrfToken);
        return data.csrfToken;
      }
    } catch (error) {
      console.error('Erro ao obter token CSRF:', error);
      console.error('URL tentada:', window.location.origin + '/api/csrf-token');
    }
    return null;
  }

  static setUser(user) {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  static getUser() {
    const user = localStorage.getItem(this.USER_KEY);
    return user ? JSON.parse(user) : null;
  }

  static removeUser() {
    localStorage.removeItem(this.USER_KEY);
  }

  static isAuthenticated() {
    return !!this.getToken();
  }

  static logout() {
    this.removeToken();
    this.removeUser();
    this.removeCsrfToken();
  }
}

/**
 * Função auxiliar para fazer requisições HTTP
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultHeaders = {};

  // Adicionar token de autenticação se existir
  const token = AuthManager.getToken();
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  // Adicionar token CSRF para métodos que modificam dados
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    let csrfToken = AuthManager.getCsrfToken();

    // Se não tiver token CSRF, buscar um novo
    if (!csrfToken) {
      csrfToken = await AuthManager.fetchCsrfToken();
    }

    if (csrfToken) {
      defaultHeaders['x-csrf-token'] = csrfToken;
    }
  }

  // Only set Content-Type for non-FormData requests
  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const config = {
    ...options,
    credentials: 'same-origin', // Importante para cookies CSRF
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  // Se tiver body e não for FormData, converter para JSON
  if (config.body && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      // Se erro CSRF, buscar novo token e tentar novamente
      if (response.status === 403 && data.code === 'CSRF_ERROR') {
        const newCsrfToken = await AuthManager.fetchCsrfToken();
        if (newCsrfToken) {
          // Tentar novamente com o novo token
          if (defaultHeaders['x-csrf-token']) {
            defaultHeaders['x-csrf-token'] = newCsrfToken;
            config.headers['x-csrf-token'] = newCsrfToken;
            const retryResponse = await fetch(url, config);
            const retryData = await retryResponse.json();

            if (!retryResponse.ok) {
              throw {
                status: retryResponse.status,
                message: retryData.message || 'Erro na requisição',
                data: retryData
              };
            }
            return retryData;
          }
        }
      }

      throw {
        status: response.status,
        message: data.message || data.error || 'Erro na requisição',
        data: data
      };
    }

    return data;
  } catch (error) {
    // Se for erro de rede
    if (!error.status) {
      throw {
        status: 0,
        message: 'Erro de conexão com o servidor',
        data: null
      };
    }
    throw error;
  }
}

/**
 * API de Autenticação
 */
const AuthAPI = {
  /**
   * Registrar novo usuário
   */
  async register(userData) {
    const response = await apiRequest('/auth/register', {
      method: 'POST',
      body: userData
    });

    if (response.success && response.data) {
      AuthManager.setToken(response.data.token);
      AuthManager.setUser(response.data.user);
    }

    return response;
  },

  /**
   * Login de usuário
   */
  async login(credentials) {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: credentials
    });

    if (response.success && response.data) {
      AuthManager.setToken(response.data.token);
      AuthManager.setUser(response.data.user);
    }

    return response;
  },

  /**
   * Logout de usuário
   */
  async logout() {
    try {
      await apiRequest('/auth/logout', {
        method: 'POST'
      });
    } catch (error) {
      console.error('Erro no logout:', error);
    } finally {
      AuthManager.logout();
    }
  },

  /**
   * Obter dados do usuário atual
   */
  async getMe() {
    const response = await apiRequest('/auth/me', {
      method: 'GET'
    });

    if (response.success && response.data) {
      AuthManager.setUser(response.data);
    }

    return response;
  },

  /**
   * Atualizar senha
   */
  async updatePassword(passwords) {
    return await apiRequest('/auth/updatepassword', {
      method: 'PUT',
      body: passwords
    });
  }
};

/**
 * Utilitários de UI para exibir mensagens
 */
const UIUtils = {
  /**
   * Mostra mensagem de erro
   */
  showError(message, elementId = null) {
    if (elementId) {
      const element = document.getElementById(elementId);
      if (element) {
        element.innerHTML = `<strong>Erro:</strong> ${message}`;
        element.style.display = 'block';
        element.className = 'alert alert-error';

        // Auto-hide after 10 seconds
        setTimeout(() => {
          this.clearMessages(elementId);
        }, 10000);
      }
    } else {
      alert('Erro: ' + message);
    }
  },

  /**
   * Mostra mensagem de sucesso
   */
  showSuccess(message, elementId = null) {
    if (elementId) {
      const element = document.getElementById(elementId);
      if (element) {
        element.innerHTML = `<strong>Sucesso:</strong> ${message}`;
        element.style.display = 'block';
        element.className = 'alert alert-success';
      }
    } else {
      alert('Sucesso: ' + message);
    }
  },

  /**
   * Mostra mensagem de informação
   */
  showInfo(message, elementId = null) {
    if (elementId) {
      const element = document.getElementById(elementId);
      if (element) {
        element.innerHTML = `<strong>Info:</strong> ${message}`;
        element.style.display = 'block';
        element.className = 'alert alert-info';

        // Auto-hide after 8 seconds
        setTimeout(() => {
          this.clearMessages(elementId);
        }, 8000);
      }
    } else {
      alert('Info: ' + message);
    }
  },

  /**
   * Limpa mensagens
   */
  clearMessages(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.innerHTML = '';
      element.style.display = 'none';
      element.className = 'alert';
    }
  },

  /**
   * Mostra mensagem generica (wrapper para showError/showSuccess)
   */
  showMessage(message, type = 'info', elementId = 'message') {
    switch (type) {
      case 'error':
        this.showError(message, elementId);
        break;
      case 'success':
        this.showSuccess(message, elementId);
        break;
      default:
        this.showInfo(message, elementId);
    }
  },

  /**
   * Redireciona para uma página
   */
  redirect(url, delay = 0) {
    setTimeout(() => {
      window.location.href = url;
    }, delay);
  },

  /**
   * Adiciona classe de loading ao botão
   */
  setButtonLoading(button, loading = true) {
    if (loading) {
      button.classList.add('btn-loading');
      button.disabled = true;
    } else {
      button.classList.remove('btn-loading');
      button.disabled = false;
    }
  }
};

/**
 * Middleware para proteger páginas que requerem autenticação
 */
function requireAuth() {
  if (!AuthManager.isAuthenticated()) {
    window.location.href = '/pages/login.html';
    return false;
  }
  return true;
}

/**
 * Middleware para redirecionar usuários autenticados
 */
function redirectIfAuthenticated(redirectTo = '/pages/game.html') {
  if (AuthManager.isAuthenticated()) {
    window.location.href = redirectTo;
    return true;
  }
  return false;
}

/**
 * API de Usuários
 */
const UserAPI = {
  /**
   * Obter usuário por ID
   */
  async getUser(userId) {
    return await apiRequest(`/users/${userId}`, {
      method: 'GET'
    });
  },

  /**
   * Atualizar perfil do usuário
   */
  async updateProfile(userId, userData) {
    return await apiRequest(`/users/${userId}`, {
      method: 'PUT',
      body: userData
    });
  },

  /**
   * Atualizar avatar
   */
  async updateAvatar(userId, avatarFile) {
    const formData = new FormData();
    formData.append('avatar', avatarFile);

    return await apiRequest(`/users/${userId}/avatar`, {
      method: 'PUT',
      headers: {
        // Don't set Content-Type for FormData, browser will set it with boundary
      },
      body: formData
    });
  },

  /**
   * Deletar conta
   */
  async deleteAccount(userId) {
    return await apiRequest(`/users/${userId}`, {
      method: 'DELETE'
    });
  },

  /**
   * Obter ranking/leaderboard
   */
  async getLeaderboard(limit = 10) {
    return await apiRequest(`/users/leaderboard?limit=${limit}`, {
      method: 'GET'
    });
  },

  /**
   * Listar usuários (com paginação)
   */
  async getUsers(page = 1, limit = 10, filters = {}) {
    const queryParams = new URLSearchParams({
      page,
      limit,
      ...filters
    });

    return await apiRequest(`/users?${queryParams}`, {
      method: 'GET'
    });
  },

  /**
   * Obter perfil público de um usuário
   */
  async getPublicProfile(userId) {
    return await apiRequest(`/users/${userId}/public`, {
      method: 'GET'
    });
  }
};
