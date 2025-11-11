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

  static setToken(token) {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  static getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static removeToken() {
    localStorage.removeItem(this.TOKEN_KEY);
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
  }
}

/**
 * Função auxiliar para fazer requisições HTTP
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  // Adicionar token de autenticação se existir
  const token = AuthManager.getToken();
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
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
      throw {
        status: response.status,
        message: data.message || 'Erro na requisição',
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
        element.textContent = message;
        element.style.display = 'block';
        element.className = 'alert alert-error';
      }
    } else {
      alert(message);
    }
  },

  /**
   * Mostra mensagem de sucesso
   */
  showSuccess(message, elementId = null) {
    if (elementId) {
      const element = document.getElementById(elementId);
      if (element) {
        element.textContent = message;
        element.style.display = 'block';
        element.className = 'alert alert-success';
      }
    } else {
      alert(message);
    }
  },

  /**
   * Limpa mensagens
   */
  clearMessages(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = '';
      element.style.display = 'none';
    }
  },

  /**
   * Redireciona para uma página
   */
  redirect(url, delay = 0) {
    setTimeout(() => {
      window.location.href = url;
    }, delay);
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
