// ========================================
// PENTAGO WEB - SCRIPT PRINCIPAL
// ========================================

// Tema é gerenciado pelo ThemeManager em /js/utils/theme.js

// Inicializar ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ Pentago Web carregado!');
  console.log('💡 Tema atual:', document.documentElement.getAttribute('data-theme') || 'light');
});
