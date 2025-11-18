const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware para processar erros de validacao
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => err.msg);
    return res.status(400).json({
      success: false,
      message: errorMessages[0], // Retorna primeira mensagem de erro
      errors: errorMessages
    });
  }
  next();
};

/**
 * Validacoes para autenticacao
 */
const authValidation = {
  register: [
    body('name')
      .trim()
      .notEmpty().withMessage('Nome é obrigatório')
      .isLength({ min: 2, max: 50 }).withMessage('Nome deve ter entre 2 e 50 caracteres')
      .escape(),
    body('email')
      .trim()
      .notEmpty().withMessage('Email é obrigatório')
      .isEmail().withMessage('Email inválido')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Senha é obrigatória')
      .isLength({ min: 6 }).withMessage('Senha deve ter no mínimo 6 caracteres'),
    body('age')
      .notEmpty().withMessage('Idade é obrigatória')
      .isInt({ min: 13, max: 120 }).withMessage('Idade deve ser entre 13 e 120 anos'),
    handleValidationErrors
  ],

  login: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email é obrigatório')
      .isEmail().withMessage('Email inválido')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Senha é obrigatória'),
    handleValidationErrors
  ],

  updatePassword: [
    body('currentPassword')
      .notEmpty().withMessage('Senha atual é obrigatória'),
    body('newPassword')
      .notEmpty().withMessage('Nova senha é obrigatória')
      .isLength({ min: 6 }).withMessage('Nova senha deve ter no mínimo 6 caracteres'),
    handleValidationErrors
  ]
};

/**
 * Validacoes para usuarios
 */
const userValidation = {
  update: [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 }).withMessage('Nome deve ter entre 2 e 50 caracteres')
      .escape(),
    body('age')
      .optional()
      .isInt({ min: 13, max: 120 }).withMessage('Idade deve ser entre 13 e 120 anos'),
    body('city')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Cidade deve ter no máximo 100 caracteres')
      .escape(),
    body('state')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Estado deve ter no máximo 100 caracteres')
      .escape(),
    body('country')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('País deve ter no máximo 100 caracteres')
      .escape(),
    handleValidationErrors
  ],

  getById: [
    param('id')
      .isMongoId().withMessage('ID de usuário inválido'),
    handleValidationErrors
  ]
};

/**
 * Validacoes para jogos
 */
const gameValidation = {
  getById: [
    param('id')
      .isMongoId().withMessage('ID de jogo inválido'),
    handleValidationErrors
  ],

  placePiece: [
    param('id')
      .isMongoId().withMessage('ID de jogo inválido'),
    body('quadrant')
      .isInt({ min: 0, max: 3 }).withMessage('Quadrante deve ser entre 0 e 3'),
    body('cell')
      .isInt({ min: 0, max: 8 }).withMessage('Célula deve ser entre 0 e 8'),
    handleValidationErrors
  ],

  rotateQuadrant: [
    param('id')
      .isMongoId().withMessage('ID de jogo inválido'),
    body('quadrant')
      .isInt({ min: 0, max: 3 }).withMessage('Quadrante deve ser entre 0 e 3'),
    body('direction')
      .isIn(['left', 'right']).withMessage('Direção deve ser "left" ou "right"'),
    handleValidationErrors
  ]
};

/**
 * Validacoes para admin
 */
const adminValidation = {
  getUsers: [
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Página deve ser um número positivo'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limite deve ser entre 1 e 100'),
    query('search')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Busca deve ter no máximo 100 caracteres')
      .escape(),
    handleValidationErrors
  ],

  userAction: [
    param('id')
      .isMongoId().withMessage('ID de usuário inválido'),
    handleValidationErrors
  ],

  banUser: [
    param('id')
      .isMongoId().withMessage('ID de usuário inválido'),
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Motivo deve ter no máximo 500 caracteres')
      .escape(),
    handleValidationErrors
  ],

  getGames: [
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Página deve ser um número positivo'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limite deve ser entre 1 e 100'),
    query('status')
      .optional()
      .isIn(['waiting', 'playing', 'finished', 'abandoned']).withMessage('Status inválido'),
    handleValidationErrors
  ],

  gameAction: [
    param('id')
      .isMongoId().withMessage('ID de jogo inválido'),
    handleValidationErrors
  ]
};

module.exports = {
  handleValidationErrors,
  authValidation,
  userValidation,
  gameValidation,
  adminValidation
};
