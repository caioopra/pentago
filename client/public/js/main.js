// ========================================
// PENTAGO WEB - SCRIPT PRINCIPAL
// ========================================

// Tema light/dark
const initTheme = () => {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
};

const toggleTheme = () => {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';

  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
};

// Inicializar tema ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  // Adicionar botão de toggle tema (será implementado no HTML posteriormente)
  console.log('✅ Pentago Web carregado!');
  console.log('💡 Tema atual:', document.documentElement.getAttribute('data-theme'));
});

// Exportar funções globais
window.toggleTheme = toggleTheme;
