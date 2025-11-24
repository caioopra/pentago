// Login page functionality
const form = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

// Custom validation messages in Portuguese
emailInput.addEventListener('invalid', function(e) {
  e.preventDefault();
  if (this.validity.valueMissing) {
    this.setCustomValidity('Por favor, preencha seu email.');
  } else if (this.validity.typeMismatch) {
    this.setCustomValidity('Por favor, insira um email válido.');
  }
});

emailInput.addEventListener('input', function() {
  this.setCustomValidity('');
});

passwordInput.addEventListener('invalid', function(e) {
  e.preventDefault();
  if (this.validity.valueMissing) {
    this.setCustomValidity('Por favor, preencha sua senha.');
  }
});

passwordInput.addEventListener('input', function() {
  this.setCustomValidity('');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Clear previous messages
  UIUtils.clearMessages('message');

  const credentials = {
    email: emailInput.value.trim(),
    password: passwordInput.value
  };

  // Disable submit button
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Entrando...';

  try {
    console.log('Enviando credenciais de login...');
    const response = await AuthAPI.login(credentials);
    console.log('Resposta recebida:', response);

    if (response.success) {
      // Show success message
      UIUtils.showSuccess('Login realizado com sucesso! Redirecionando...', 'message');

      // Scroll to top to show message
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Redirect to main page after 1.5 seconds
      setTimeout(() => {
        window.location.href = '/pages/index.html';
      }, 1500);
    } else {
      // Should not reach here, but just in case
      throw new Error(response.message || 'Erro desconhecido ao fazer login.');
    }
  } catch (error) {
    console.error('Erro no login:', error);

    // Determine error message
    let errorMessage = 'Erro ao fazer login. Por favor, tente novamente.';

    if (error.message) {
      errorMessage = error.message;
    } else if (error.status === 0) {
      errorMessage = 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet.';
    } else if (error.status === 401) {
      errorMessage = 'Email ou senha incorretos. Verifique suas credenciais e tente novamente.';
    } else if (error.status === 400) {
      errorMessage = 'Dados inválidos. Preencha todos os campos corretamente.';
    } else if (error.status === 500) {
      errorMessage = 'Erro interno do servidor. Por favor, tente novamente mais tarde.';
    }

    // Show error message
    UIUtils.showError(errorMessage, 'message');

    // Scroll to top to show message
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Re-enable button
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});
