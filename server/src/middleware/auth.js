const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware para proteger rotas que requerem autenticação
 * Verifica o token JWT no header Authorization
 */
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Verificar se o token está no header Authorization
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Também aceitar token de cookie (para futuras implementações)
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // Verificar se o token existe
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Não autorizado. Token não fornecido.'
      });
    }

    try {
      // Verificar e decodificar o token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Buscar o usuário pelo ID do token
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não encontrado.'
        });
      }

      // Verificar se o usuário está banido
      if (req.user.isBanned) {
        return res.status(403).json({
          success: false,
          message: 'Sua conta foi suspensa. Entre em contato com o administrador.',
          isBanned: true
        });
      }

      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido ou expirado.'
      });
    }
  } catch (error) {
    console.error('Erro no middleware de autenticação:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro no servidor.'
    });
  }
};

/**
 * Middleware para verificar se o usuário é administrador
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Não autorizado.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Você não tem permissão para acessar este recurso.'
      });
    }

    next();
  };
};

/**
 * Middleware opcional - não retorna erro se não houver token,
 * apenas não popula req.user
 */
exports.optional = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-password');
      } catch (err) {
        // Token inválido, mas não retorna erro
        req.user = null;
      }
    }

    next();
  } catch (error) {
    next();
  }
};
