/**
 * Profile Page Logic
 */

// Require authentication
if (!requireAuth()) {
  throw new Error('Unauthorized');
}

// Get current user data
const currentUser = AuthManager.getUser();
if (!currentUser) {
  window.location.href = '/pages/login.html';
  throw new Error('No user data found');
}

// DOM Elements
const profileForm = document.getElementById('profileForm');
const passwordForm = document.getElementById('passwordForm');
const avatarInput = document.getElementById('avatarInput');
const avatarPreview = document.getElementById('avatarPreview');
const uploadAvatarBtn = document.getElementById('uploadAvatarBtn');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');

// Form fields
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const ageInput = document.getElementById('age');
const cityInput = document.getElementById('city');
const stateInput = document.getElementById('state');
const countryInput = document.getElementById('country');
const scoreDisplay = document.getElementById('score');
const memberSinceDisplay = document.getElementById('memberSince');

// Password form fields
const currentPasswordInput = document.getElementById('currentPassword');
const newPasswordInput = document.getElementById('newPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');

// Store selected avatar file
let selectedAvatarFile = null;

/**
 * Load and display user profile data
 */
async function loadProfile() {
  try {
    const response = await UserAPI.getUser(currentUser._id);

    if (response.success) {
      const user = response.data;

      // Update form fields
      nameInput.value = user.name || '';
      emailInput.value = user.email || '';
      ageInput.value = user.age || '';
      cityInput.value = user.city || '';
      stateInput.value = user.state || '';
      countryInput.value = user.country || '';
      scoreDisplay.textContent = user.score || 0;

      // Update avatar
      if (user.avatar) {
        avatarPreview.src = user.avatar;
      }

      // Format member since date
      if (user.createdAt) {
        const date = new Date(user.createdAt);
        memberSinceDisplay.textContent = date.toLocaleDateString('pt-BR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      }

      // Update stored user data
      AuthManager.setUser(user);
    }
  } catch (error) {
    console.error('Erro ao carregar perfil:', error);
    UIUtils.showError('Erro ao carregar dados do perfil.', 'message');
  }
}

/**
 * Handle avatar file selection
 */
avatarInput.addEventListener('change', (e) => {
  const file = e.target.files[0];

  if (file) {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      UIUtils.showError('Por favor, selecione uma imagem válida (JPEG, PNG, GIF ou WebP).', 'message');
      avatarInput.value = '';
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      UIUtils.showError('A imagem deve ter no máximo 10MB.', 'message');
      avatarInput.value = '';
      return;
    }

    // Preview the image
    const reader = new FileReader();
    reader.onload = (e) => {
      avatarPreview.src = e.target.result;
      uploadAvatarBtn.style.display = 'inline-block';
      selectedAvatarFile = file;
    };
    reader.readAsDataURL(file);
  }
});

/**
 * Handle avatar upload
 */
uploadAvatarBtn.addEventListener('click', async () => {
  if (!selectedAvatarFile) {
    UIUtils.showError('Por favor, selecione uma imagem primeiro.', 'message');
    return;
  }

  UIUtils.clearMessages('message');
  uploadAvatarBtn.disabled = true;
  uploadAvatarBtn.textContent = 'Enviando...';

  try {
    const response = await UserAPI.updateAvatar(currentUser._id, selectedAvatarFile);

    if (response.success) {
      UIUtils.showSuccess('Avatar atualizado com sucesso!', 'message');
      uploadAvatarBtn.style.display = 'none';
      selectedAvatarFile = null;
      avatarInput.value = '';

      // Update stored user data
      const user = AuthManager.getUser();
      user.avatar = response.data.avatar;
      AuthManager.setUser(user);
    }
  } catch (error) {
    console.error('Erro ao atualizar avatar:', error);
    UIUtils.showError(error.message || 'Erro ao atualizar avatar.', 'message');
  } finally {
    uploadAvatarBtn.disabled = false;
    uploadAvatarBtn.textContent = 'Salvar Avatar';
  }
});

/**
 * Handle profile form submission
 */
profileForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  UIUtils.clearMessages('message');

  const profileData = {
    name: nameInput.value.trim(),
    age: parseInt(ageInput.value),
    city: cityInput.value.trim(),
    state: stateInput.value.trim(),
    country: countryInput.value.trim()
  };

  const submitBtn = profileForm.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Salvando...';

  try {
    const response = await UserAPI.updateProfile(currentUser._id, profileData);

    if (response.success) {
      UIUtils.showSuccess('Perfil atualizado com sucesso!', 'message');

      // Update stored user data
      AuthManager.setUser(response.data);

      // Scroll to top to show message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    UIUtils.showError(error.message || 'Erro ao atualizar perfil.', 'message');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});

/**
 * Handle password form submission
 */
passwordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  UIUtils.clearMessages('message');

  const currentPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  // Validate passwords match
  if (newPassword !== confirmPassword) {
    UIUtils.showError('As senhas não coincidem.', 'message');
    return;
  }

  const submitBtn = passwordForm.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Atualizando...';

  try {
    const response = await AuthAPI.updatePassword({
      currentPassword,
      newPassword
    });

    if (response.success) {
      UIUtils.showSuccess('Senha atualizada com sucesso!', 'message');

      // Clear form
      passwordForm.reset();

      // Update token
      if (response.data && response.data.token) {
        AuthManager.setToken(response.data.token);
      }

      // Scroll to top to show message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  } catch (error) {
    console.error('Erro ao atualizar senha:', error);
    UIUtils.showError(error.message || 'Erro ao atualizar senha.', 'message');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});

/**
 * Handle account deletion
 */
deleteAccountBtn.addEventListener('click', async () => {
  const confirmation = confirm(
    'Tem certeza que deseja deletar sua conta? Esta ação não pode ser desfeita.\n\nDigite seu email para confirmar.'
  );

  if (!confirmation) {
    return;
  }

  const emailConfirmation = prompt('Digite seu email para confirmar a exclusão:');

  if (emailConfirmation !== currentUser.email) {
    alert('Email incorreto. Exclusão cancelada.');
    return;
  }

  UIUtils.clearMessages('message');
  deleteAccountBtn.disabled = true;
  deleteAccountBtn.textContent = 'Deletando...';

  try {
    const response = await UserAPI.deleteAccount(currentUser._id);

    if (response.success) {
      alert('Conta deletada com sucesso. Você será desconectado.');
      AuthManager.logout();
      window.location.href = '/pages/index.html';
    }
  } catch (error) {
    console.error('Erro ao deletar conta:', error);
    UIUtils.showError(error.message || 'Erro ao deletar conta.', 'message');
    deleteAccountBtn.disabled = false;
    deleteAccountBtn.textContent = 'Deletar Conta';
  }
});

// Load profile data on page load
loadProfile();
