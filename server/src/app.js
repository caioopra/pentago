require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');
const connectDB = require('./config/database');
const GameSocketService = require('./services/gameSocketService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  path: '/socket.io',
  transports: ['websocket', 'pooling'],
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const PORT = process.env.PORT || 3000;

// Conectar ao MongoDB
connectDB();

// Middleware de logging HTTP
// Usa 'dev' para desenvolvimento (colorido e conciso) ou 'combined' para produção
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Middlewares básicos
// Configure Helmet with CSP (strict in production, relaxed in development)
const isDevelopment = process.env.NODE_ENV !== 'production';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: isDevelopment
        ? ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "'unsafe-eval'"] // Allow inline scripts only in development
        : ["'self'", "https://cdnjs.cloudflare.com", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"], // CSS inline is generally safe
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:", "http://localhost:*", "https://localhost:*"], // WebSocket connections
      fontSrc: ["'self'", "data:", "https://cdnjs.cloudflare.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "blob:", "mediastream:"], // Allow WebRTC media streams
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: isDevelopment ? [] : null, // Force HTTPS in production
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny'
  },
  noSniff: true,
  xssFilter: true
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
const cookieParser = require('cookie-parser');
app.use(cookieParser());

// CSRF Protection
const {
  doubleCsrfProtection,
  csrfTokenGenerator,
  csrfErrorHandler,
  getCsrfToken
} = require('./middleware/csrf');

// Rate Limiting
const { generalLimiter } = require('./middleware/rateLimiter');

// Sanitizacao contra NoSQL injection
// Remove caracteres como $ e . de req.body, req.query e req.params
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`🛡️ NoSQL injection attempt blocked in ${key}`);
  }
}));

// Inicializar Socket.io para o jogo
const gameSocketService = new GameSocketService(io);
gameSocketService.initialize();
console.log('🎮 Socket.io inicializado para partidas em tempo real');

// Servir arquivos estáticos do cliente
app.use(express.static(path.join(__dirname, '../../client/public')));

// Servir arquivos de upload
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Servir a apresentação
app.use('/apresentacao', express.static(path.join(__dirname, '../../presentation')));

// Rota de teste
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Servidor Pentago funcionando!',
    timestamp: new Date()
  });
});

// Rota para obter token CSRF (pública)
app.get('/api/csrf-token', csrfTokenGenerator, getCsrfToken);

// Aplicar rate limiting geral em todas as rotas da API
app.use('/api', generalLimiter);

// Aplicar proteção CSRF em todas as rotas da API (exceto GET, HEAD, OPTIONS)
app.use('/api', doubleCsrfProtection);

// Rotas da API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/games', require('./routes/games'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/upload', require('./routes/upload'));

// Rota padrão - servir index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/public/pages/index.html'));
});

// Error handler para CSRF (deve vir depois de todas as rotas)
app.use(csrfErrorHandler);

// Iniciar servidor HTTP com Socket.io
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
});

module.exports = { app, server, io, gameSocketService };
