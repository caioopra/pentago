const rateLimit = require('express-rate-limit');

/**
 * Rate limiter geral para todas as rotas da API
 * Previne abuso e ataques de força bruta
 */
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos padrão
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requisições por janela
  message: {
    success: false,
    error: 'Muitas requisições deste IP. Por favor, tente novamente mais tarde.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true, // Retorna informações no header `RateLimit-*`
  legacyHeaders: false, // Desabilita headers `X-RateLimit-*`
  handler: (req, res) => {
    console.warn(`🛡️ Rate limit excedido para IP ${req.ip} na rota ${req.path}`);
    res.status(429).json({
      success: false,
      error: 'Muitas requisições deste IP. Por favor, tente novamente mais tarde.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

/**
 * Rate limiter mais rigoroso para rotas de autenticação
 * Previne ataques de força bruta em login/registro
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas por janela
  skipSuccessfulRequests: true, // Não conta requisições bem-sucedidas
  message: {
    success: false,
    error: 'Muitas tentativas de autenticação. Por favor, aguarde 15 minutos antes de tentar novamente.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`🛡️ Rate limit de autenticação excedido para IP ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Muitas tentativas de autenticação. Por favor, aguarde 15 minutos antes de tentar novamente.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

/**
 * Rate limiter para criação de recursos
 * Previne spam de criação de usuários, partidas, etc.
 */
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // 10 criações por hora
  message: {
    success: false,
    error: 'Limite de criação excedido. Por favor, aguarde antes de criar novos recursos.',
    code: 'CREATE_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`🛡️ Rate limit de criação excedido para IP ${req.ip} na rota ${req.path}`);
    res.status(429).json({
      success: false,
      error: 'Limite de criação excedido. Por favor, aguarde antes de criar novos recursos.',
      code: 'CREATE_RATE_LIMIT_EXCEEDED',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

/**
 * Rate limiter para upload de arquivos
 * Previne abuso de upload de avatares
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // 5 uploads por hora
  message: {
    success: false,
    error: 'Limite de upload excedido. Por favor, aguarde antes de fazer novo upload.',
    code: 'UPLOAD_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`🛡️ Rate limit de upload excedido para IP ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Limite de upload excedido. Por favor, aguarde antes de fazer novo upload.',
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

module.exports = {
  generalLimiter,
  authLimiter,
  createLimiter,
  uploadLimiter
};
