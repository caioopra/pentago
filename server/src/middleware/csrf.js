const { doubleCsrf } = require('csrf-csrf');

// Configuração do CSRF protection
const {
  generateCsrfToken, // Gera um novo token CSRF
  doubleCsrfProtection, // Middleware de proteção
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || 'your-csrf-secret-change-this-in-production',
  getSessionIdentifier: (req) => req.ip || 'unknown', // Identifica a sessão pelo IP do cliente
  cookieName: 'x-csrf-token',
  cookieOptions: {
    sameSite: 'strict',
    path: '/',
    secure: process.env.NODE_ENV === 'production', // HTTPS apenas em produção
    httpOnly: true,
  },
  size: 64, // Tamanho do token em bytes
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'], // Métodos que não precisam de CSRF
  getTokenFromRequest: (req) => {
    // Aceita token do header ou do body
    return req.headers['x-csrf-token'] || req.body._csrf;
  },
});

/**
 * Middleware para gerar e anexar o token CSRF ao request
 * Útil para endpoints que precisam retornar o token para o cliente
 */
const csrfTokenGenerator = (req, res, next) => {
  try {
    const csrfToken = generateCsrfToken(req, res);
    req.csrfToken = () => csrfToken;
    next();
  } catch (error) {
    console.error('❌ Erro ao gerar token CSRF:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao gerar token de segurança'
    });
  }
};

/**
 * Middleware de tratamento de erros CSRF
 * Retorna mensagens amigáveis em português
 */
const csrfErrorHandler = (err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN' || err.message?.includes('CSRF')) {
    console.warn('🛡️ Tentativa de requisição com token CSRF inválido:', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    return res.status(403).json({
      success: false,
      error: 'Token de segurança inválido. Por favor, recarregue a página e tente novamente.',
      code: 'CSRF_ERROR'
    });
  }
  next(err);
};

/**
 * Endpoint para obter um novo token CSRF
 * GET /api/csrf-token
 */
const getCsrfToken = (req, res) => {
  try {
    const token = req.csrfToken();
    res.json({
      success: true,
      csrfToken: token
    });
  } catch (error) {
    console.error('❌ Erro ao gerar token CSRF:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao gerar token de segurança'
    });
  }
};

module.exports = {
  doubleCsrfProtection,
  csrfTokenGenerator,
  csrfErrorHandler,
  getCsrfToken,
  generateCsrfToken
};
