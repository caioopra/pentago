const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Gera token JWT para o usuário
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

/**
 * @desc    Registrar novo usuário
 * @route   POST /api/auth/register
 * @access  Public
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password, age } = req.body;

    // Validação básica
    if (!name || !email || !password || !age) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, preencha todos os campos obrigatórios.'
      });
    }

    // Validar idade mínima
    if (age < 13) {
      return res.status(400).json({
        success: false,
        message: 'A idade mínima para cadastro é 13 anos.'
      });
    }

    // Validar tamanho mínimo da senha
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'A senha deve ter no mínimo 6 caracteres.'
      });
    }

    // Verificar se o email já existe
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Este email já está cadastrado.'
      });
    }

    // Criar usuário
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      age
    });

    // Gerar token
    const token = generateToken(user._id);

    // Remover senha da resposta
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      age: user.age,
      avatar: user.avatar,
      score: user.score,
      createdAt: user.createdAt
    };

    res.status(201).json({
      success: true,
      message: 'Usuário cadastrado com sucesso!',
      data: {
        user: userResponse,
        token
      }
    });
  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao cadastrar usuário. Por favor, tente novamente.'
    });
  }
};

/**
 * @desc    Login de usuário
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validação
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, forneça email e senha.'
      });
    }

    // Buscar usuário com senha (campo select: false no modelo)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email ou senha incorretos.'
      });
    }

    // Verificar senha
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Email ou senha incorretos.'
      });
    }

    // Atualizar status online
    user.isOnline = true;
    await user.save();

    // Gerar token
    const token = generateToken(user._id);

    // Remover senha da resposta
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      age: user.age,
      avatar: user.avatar,
      score: user.score,
      isOnline: user.isOnline,
      createdAt: user.createdAt
    };

    res.status(200).json({
      success: true,
      message: 'Login realizado com sucesso!',
      data: {
        user: userResponse,
        token
      }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao realizar login. Por favor, tente novamente.'
    });
  }
};

/**
 * @desc    Logout de usuário
 * @route   POST /api/auth/logout
 * @access  Private
 */
exports.logout = async (req, res) => {
  try {
    // Atualizar status online do usuário
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, { isOnline: false });
    }

    res.status(200).json({
      success: true,
      message: 'Logout realizado com sucesso!'
    });
  } catch (error) {
    console.error('Erro no logout:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao realizar logout.'
    });
  }
};

/**
 * @desc    Obter usuário atual autenticado
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar dados do usuário.'
    });
  }
};

/**
 * @desc    Atualizar senha
 * @route   PUT /api/auth/updatepassword
 * @access  Private
 */
exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, forneça a senha atual e a nova senha.'
      });
    }

    // Validar tamanho da nova senha
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'A nova senha deve ter no mínimo 6 caracteres.'
      });
    }

    // Buscar usuário com senha
    const user = await User.findById(req.user._id).select('+password');

    // Verificar senha atual
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Senha atual incorreta.'
      });
    }

    // Atualizar senha
    user.password = newPassword;
    await user.save();

    // Gerar novo token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Senha atualizada com sucesso!',
      data: { token }
    });
  } catch (error) {
    console.error('Erro ao atualizar senha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar senha.'
    });
  }
};
