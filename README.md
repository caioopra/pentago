# 🎮 Pentago Web - Projeto Final INE5646

<div align="center">

**Universidade Federal de Santa Catarina**
**Curso:** Ciência da Computação
**Disciplina:** INE5646 - Programação para Web
**Período:** 2025.2

</div>

## 👥 Equipe

- **Caio Prá Silva** - Back-end & DevOps
- **Pedro Nack Martins** - Front-end & UI/UX

## 📖 Sobre o Projeto

Aplicação web completa do jogo de tabuleiro **Pentago** com funcionalidades multiplayer em tempo real, chat de texto, vídeochat, sistema de ranking, gravação de partidas e painel administrativo.

### O que é Pentago?

Pentago é um jogo de tabuleiro abstrato para dois jogadores onde o objetivo é conseguir cinco peças da sua cor em linha (horizontal, vertical ou diagonal). A mecânica única do jogo permite que, após cada jogada, o jogador rotacione um dos quatro quadrantes do tabuleiro em 90 graus, tornando o jogo altamente estratégico.

## ✨ Principais Funcionalidades

### 🎯 Jogo
- ✅ Modo 2 jogadores (multiplayer online)
- ✅ Modo vs Bot (IA)
- ✅ Tabuleiro 6x6 dividido em 4 quadrantes rotacionáveis
- ✅ Detecção automática de vitória
- ✅ Sistema de turnos sincronizado

### 👤 Usuários
- ✅ Cadastro completo (nome, email, senha, idade, localização)
- ✅ Autenticação JWT
- ✅ Perfil editável
- ✅ Upload de avatar
- ✅ Histórico de partidas

### 💬 Comunicação
- ✅ Chat de texto em tempo real
- ✅ Vídeochat com WebRTC (webcam + áudio)
- ✅ Chat para jogadores em partida
- ✅ Chat geral para todos os jogadores online

### 🎥 Gravação
- ✅ Gravação de partidas com FFMPEG
- ✅ Armazenamento em MongoDB (GridFS)
- ✅ Compartilhamento por URL
- ✅ Player HTML5 integrado

### 🏆 Ranking
- ✅ Sistema de pontuação
- ✅ Ranking geral
- ✅ High scores
- ✅ Estatísticas detalhadas

### 🔐 Segurança
- ✅ Proteção contra XSS
- ✅ Proteção contra CSRF
- ✅ Rate limiting
- ✅ Validação e sanitização de inputs
- ✅ HTTPS obrigatório

### 🎨 Interface
- ✅ Design responsivo (desktop e mobile)
- ✅ Tema light e dark
- ✅ Animações suaves
- ✅ Interface intuitiva

### 👨‍💼 Administração
- ✅ Painel administrativo
- ✅ Gerenciamento de usuários
- ✅ Gerenciamento de avatares
- ✅ Configuração de limites
- ✅ Estatísticas do sistema

## 🛠️ Tecnologias Utilizadas

### Back-end
- **Node.js** 18+ (LTS)
- **Express.js** 4.x
- **MongoDB** 6.x + Mongoose
- **Socket.io** 4.x (WebSocket)
- **JWT** (Autenticação)
- **bcrypt** (Hash de senhas)
- **FFMPEG** (Gravação de vídeo)

### Front-end
- **HTML5** (Estrutura)
- **CSS3** (Estilização)
- **JavaScript ES6+** (Lógica)
- **WebRTC** (Vídeochat)
- **Socket.io Client** (Comunicação real-time)

### Segurança
- **helmet** (Headers HTTP seguros)
- **express-rate-limit** (Rate limiting)
- **express-validator** (Validação)
- **express-mongo-sanitize** (Sanitização)

### DevOps
- **Git + GitHub** (Controle de versão)
- **PM2** (Process manager)
- **Nginx** (Reverse proxy)
- **Let's Encrypt** (SSL/TLS)

## 🏗️ Arquitetura (Padrão MVC)

```
pentago-web-project/
├── client/              # VIEW (Front-end)
│   ├── public/
│   │   ├── pages/       # HTML
│   │   ├── css/         # Estilos
│   │   ├── js/          # Scripts
│   │   └── assets/      # Imagens, ícones
│
├── server/              # MODEL + CONTROLLER (Back-end)
│   ├── models/          # Modelos de dados (MODEL)
│   ├── controllers/     # Lógica de negócio (CONTROLLER)
│   ├── routes/          # Rotas da API
│   ├── middleware/      # Middlewares
│   ├── services/        # Serviços (Socket, FFMPEG)
│   └── config/          # Configurações
│
├── presentation/        # Apresentação reveal.js
├── docs/                # Documentação
└── latex/               # Artigo LaTeX (futuro)
```

## 📦 Instalação e Configuração

### Pré-requisitos

- Node.js 18+ ([Download](https://nodejs.org/))
- MongoDB 6+ ([Download](https://www.mongodb.com/try/download/community))
- FFMPEG ([Download](https://ffmpeg.org/download.html))
- Git ([Download](https://git-scm.com/downloads))

### Passo a Passo

1. **Clone o repositório:**
```bash
git clone https://github.com/caioopra/pentago-web.git
cd pentago-web-project
```

2. **Instale as dependências do servidor:**
```bash
cd server
npm install
```

3. **Configure as variáveis de ambiente:**
```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

4. **Inicie o MongoDB:**
```bash
# Linux/Mac
mongod

# Windows
net start MongoDB
```

5. **Inicie o servidor:**
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

6. **Acesse a aplicação:**
```
http://localhost:3000
```

### Variáveis de Ambiente (.env)

```env
# Server
PORT=3000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/pentago

# JWT
JWT_SECRET=seu_secret_super_secreto_aqui
JWT_EXPIRE=7d

# FFMPEG
FFMPEG_PATH=/usr/bin/ffmpeg

# Limites
MAX_VIDEO_AGE_DAYS=15
MAX_VIDEO_SIZE_GB=1
MAX_QUEUE_SIZE=25
INACTIVITY_TIMEOUT_SECONDS=60
```

## 📚 Documentação Completa

- **[PLANEJAMENTO_ESTRATEGICO.md](./PLANEJAMENTO_ESTRATEGICO.md)** - Planejamento detalhado do projeto (11 fases)
- **[INSTALACAO.md](./docs/INSTALACAO.md)** - Guia completo de instalação (em breve)
- **[API.md](./docs/API.md)** - Documentação da API REST (em breve)
- **[DEPLOY.md](./docs/DEPLOY.md)** - Guia de deploy no VPS-UFSC (em breve)

## 🎯 Roadmap

### ✅ Concluído
- [x] Planejamento estratégico
- [x] Estrutura base do projeto
- [x] Protótipo do jogo (versão básica)

### 🚧 Em Desenvolvimento (Próximos Passos)
- [ ] Configurar estrutura MVC completa
- [ ] Implementar back-end com MongoDB
- [ ] Implementar sistema de autenticação
- [ ] Integrar jogo com back-end
- [ ] Implementar chat em tempo real
- [ ] Implementar fila de jogadores

### 📅 Planejado
- [ ] Vídeochat (WebRTC)
- [ ] Gravação de partidas (FFMPEG)
- [ ] Sistema de ranking
- [ ] Painel administrativo
- [ ] Medidas de segurança
- [ ] Deploy VPS-UFSC
- [ ] Apresentação reveal.js
- [ ] Artigo em LaTeX

## 🎓 Critérios de Avaliação

| Categoria | Pontuação |
|-----------|-----------|
| **Apresentação (AP)** | 10.0 pts |
| - Infraestrutura (Server, MVC, Deploy) | 2.0 pts |
| - Back-end (MongoDB, CRUD, Segurança) | 3.625 pts |
| - Front-end (UI, Chat, Vídeochat, etc.) | 4.375 pts |
| **Escrita (EP)** | 10.0 pts |
| - Artigo LaTeX completo | 8.0 pts |
| - Repositório e código-fonte | 2.0 pts |
| **TOTAL** | **20.0 pts** |

## 🔐 Segurança

Este projeto implementa múltiplas camadas de segurança:

- **Autenticação:** JWT com tokens seguros
- **Senhas:** Hash bcrypt com salt
- **XSS:** Sanitização de inputs e CSP
- **CSRF:** Tokens CSRF em formulários
- **Rate Limiting:** Proteção contra brute-force
- **HTTPS:** Comunicação criptografada
- **Validação:** Validação rigorosa de todos os inputs

## 📄 Licença

Este projeto é desenvolvido para fins acadêmicos como parte da disciplina INE5646 - Programação para Web da UFSC.

## 📞 Contato

- **Caio Prá Silva** - caio.pra@grad.ufsc.br
- **Pedro Nack Martins** - pedro.nack@grad.ufsc.br

## 🙏 Agradecimentos

- Professor da disciplina INE5646
- Monitores
- Colegas de turma
- Comunidade open-source

---

<div align="center">

**Desenvolvido por Caio Prá e Pedro Nack**

[Repositório](https://github.com/caioopra/pentago-web) • [Documentação](./PLANEJAMENTO_ESTRATEGICO.md) • [Issues](https://github.com/caioopra/pentago-web/issues)

</div>
