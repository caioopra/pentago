/* ========================================
   THEME MANAGER
   Handles light/dark theme switching
   ======================================== */

const ThemeManager = {
  STORAGE_KEY: 'pentago-theme',
  THEME_LIGHT: 'light',
  THEME_DARK: 'dark',

  /**
   * Inicializa o gerenciador de tema
   * Aplica o tema salvo ou o tema padrão (light)
   */
  init() {
    const savedTheme = this.getTheme();
    console.log('🎨 ThemeManager.init() - Tema salvo:', savedTheme);
    this.applyTheme(savedTheme);
  },

  /**
   * Obtém o tema salvo no localStorage
   * @returns {string} 'light' ou 'dark'
   */
  getTheme() {
    const savedTheme = localStorage.getItem(this.STORAGE_KEY);
    return savedTheme || this.THEME_LIGHT;
  },

  /**
   * Salva o tema no localStorage
   * @param {string} theme - 'light' ou 'dark'
   */
  saveTheme(theme) {
    localStorage.setItem(this.STORAGE_KEY, theme);
  },

  /**
   * Aplica o tema ao documento
   * @param {string} theme - 'light' ou 'dark'
   */
  applyTheme(theme) {
    const root = document.documentElement;

    if (theme === this.THEME_DARK) {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }

    // Atualizar estado do toggle se existir
    this.updateToggleState();
  },

  /**
   * Alterna entre light e dark theme
   * @returns {string} O novo tema aplicado
   */
  toggleTheme() {
    const currentTheme = this.getTheme();
    const newTheme = currentTheme === this.THEME_LIGHT ? this.THEME_DARK : this.THEME_LIGHT;

    console.log('🔄 ThemeManager.toggleTheme() -', currentTheme, '→', newTheme);

    this.applyTheme(newTheme);
    this.saveTheme(newTheme);

    return newTheme;
  },

  /**
   * Define um tema específico
   * @param {string} theme - 'light' ou 'dark'
   */
  setTheme(theme) {
    if (theme !== this.THEME_LIGHT && theme !== this.THEME_DARK) {
      console.warn(`Tema inválido: ${theme}. Usando tema padrão.`);
      theme = this.THEME_LIGHT;
    }

    this.applyTheme(theme);
    this.saveTheme(theme);
  },

  /**
   * Verifica se o tema atual é dark
   * @returns {boolean}
   */
  isDark() {
    return this.getTheme() === this.THEME_DARK;
  },

  /**
   * Atualiza o estado visual do toggle (se existir na página)
   */
  updateToggleState() {
    const toggle = document.getElementById('themeToggle');
    if (toggle) {
      toggle.checked = this.isDark();
    }
  }
};

// Inicializa o tema assim que o script é carregado
// Isso garante que o tema seja aplicado antes da renderização
ThemeManager.init();
