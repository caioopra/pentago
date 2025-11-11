require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const connectDB = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Conectar ao MongoDB
connectDB();

// Middlewares básicos
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const cookieParser = require('cookie-parser');
app.use(cookieParser());

// Servir arquivos estáticos do cliente
app.use(express.static(path.join(__dirname, '../../client/public')));

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
// app.use('/api/users', require('./routes/users'));
// app.use('/api/games', require('./routes/games'));

// Rota padrão - servir index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/public/pages/index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
});

module.exports = app;
