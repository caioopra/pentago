// Register page functionality
const form = document.getElementById('registerForm');
const passwordInput = document.getElementById('password');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const ageInput = document.getElementById('age');

// Function to update validation message
function updateValidationMessage(input) {
  if (input.validity.valueMissing) {
    if (input === nameInput) {
      input.setCustomValidity('Por favor, preencha seu nome.');
    } else if (input === emailInput) {
      input.setCustomValidity('Por favor, preencha seu email.');
    } else if (input === passwordInput) {
      input.setCustomValidity('Por favor, preencha este campo.');
    } else if (input === ageInput) {
      input.setCustomValidity('Por favor, preencha sua idade.');
    }
  } else if (input.validity.typeMismatch && input === emailInput) {
    input.setCustomValidity('Por favor, insira um email válido.');
  } else if (input.validity.tooShort && input === passwordInput) {
    input.setCustomValidity(`A senha deve ter no mínimo ${input.minLength} caracteres.`);
  } else if (input.validity.rangeUnderflow && input === ageInput) {
    input.setCustomValidity('A idade mínima é 13 anos.');
  } else if (input.validity.rangeOverflow && input === ageInput) {
    input.setCustomValidity('Por favor, insira uma idade válida.');
  } else {
    input.setCustomValidity('');
  }
}

// Set custom validation messages on invalid event
[nameInput, emailInput, passwordInput, ageInput].forEach(input => {
  input.addEventListener('invalid', function(e) {
    e.preventDefault();
    updateValidationMessage(this);
  });

  input.addEventListener('input', function() {
    this.setCustomValidity('');
  });

  input.addEventListener('change', function() {
    updateValidationMessage(this);
  });
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Clear previous messages
  UIUtils.clearMessages('message');

  // Validate all inputs before submitting
  [nameInput, emailInput, passwordInput, ageInput].forEach(input => {
    updateValidationMessage(input);
  });

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const formData = {
    name: nameInput.value.trim(),
    email: emailInput.value.trim(),
    password: passwordInput.value,
    age: parseInt(ageInput.value)
  };

  // Disable submit button
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Cadastrando...';

  try {
    console.log('Enviando dados de registro:', formData);
    const response = await AuthAPI.register(formData);
    console.log('Resposta recebida:', response);

    if (response.success) {
      // Show success message
      UIUtils.showSuccess('Cadastro realizado com sucesso! Redirecionando para seu perfil...', 'message');

      // Scroll to top to show message
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Clear form
      form.reset();

      // Redirect to profile page after 1.5 seconds
      setTimeout(() => {
        window.location.href = '/pages/profile.html';
      }, 1500);
    } else {
      // Should not reach here, but just in case
      throw new Error(response.message || 'Erro desconhecido ao cadastrar.');
    }
  } catch (error) {
    console.error('Erro no cadastro:', error);

    // Determine error message
    let errorMessage = 'Erro ao cadastrar. Por favor, tente novamente.';

    if (error.message) {
      errorMessage = error.message;
    } else if (error.status === 0) {
      errorMessage = 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet.';
    } else if (error.status === 400) {
      errorMessage = error.data?.message || 'Dados inválidos. Verifique os campos do formulário.';
    } else if (error.status === 401) {
      errorMessage = 'Não autorizado. Verifique suas credenciais.';
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
