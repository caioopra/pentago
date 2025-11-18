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
// Configure Helmet with custom CSP to allow inline scripts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for development
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"], // Allow WebSocket connections
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
const cookieParser = require('cookie-parser');
app.use(cookieParser());

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

// Rota de teste
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Servidor Pentago funcionando!',
    timestamp: new Date()
  });
});

// Rotas da API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/games', require('./routes/games'));
app.use('/api/admin', require('./routes/admin'));

// Debug routes (apenas desenvolvimento - remover em produção)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/debug', require('./routes/debug'));
}

// Rota padrão - servir index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/public/pages/index.html'));
});

// Iniciar servidor HTTP com Socket.io
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
});

module.exports = { app, server, io };
