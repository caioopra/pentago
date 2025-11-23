const Message = require('../models/Message');
const User = require('../models/User');

/**
 * Serviço de Chat
 * Gerencia mensagens de lobby e in-game
 */
class ChatService {
  constructor(io) {
    this.io = io;
    this.typingUsers = new Map(); // socketId -> { userId, channel, gameId? }
  }

  /**
   * Enviar mensagem
   */
  async sendMessage(senderId, content, channel, gameId = null) {
    try {
      // Validar conteúdo
      if (!content || content.trim().length === 0) {
        return {
          success: false,
          message: 'Mensagem vazia.'
        };
      }

      if (content.length > 500) {
        return {
          success: false,
          message: 'Mensagem muito longa (máximo 500 caracteres).'
        };
      }

      // Sanitizar conteúdo (remover tags HTML)
      const sanitizedContent = content
        .trim()
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // Criar mensagem
      const message = await Message.create({
        sender: senderId,
        content: sanitizedContent,
        channel,
        gameId: channel === 'game' ? gameId : undefined
      });

      // Populate sender info
      await message.populate('sender', 'name avatar');

      // Broadcast mensagem
      const messageData = {
        _id: message._id,
        sender: {
          _id: message.sender._id,
          name: message.sender.name,
          avatar: message.sender.avatar
        },
        content: message.content,
        channel: message.channel,
        gameId: message.gameId,
        createdAt: message.createdAt
      };

      if (channel === 'lobby') {
        // Broadcast para todos online
        this.io.emit('chat_message', messageData);
      } else if (channel === 'game' && gameId) {
        // Broadcast apenas para jogadores da partida
        this.io.to(`game_${gameId}`).emit('chat_message', messageData);
      }

      return {
        success: true,
        message: messageData
      };
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      return {
        success: false,
        message: 'Erro ao enviar mensagem.'
      };
    }
  }

  /**
   * Buscar histórico de mensagens
   */
  async getMessages(channel, gameId = null, limit = 50) {
    try {
      const query = { channel };

      if (channel === 'game' && gameId) {
        query.gameId = gameId;
      }

      const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('sender', 'name avatar')
        .lean();

      // Retornar em ordem cronológica
      return messages.reverse();
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
      return [];
    }
  }

  /**
   * Marcar usuário como digitando
   */
  setTyping(socketId, userId, channel, gameId = null) {
    this.typingUsers.set(socketId, { userId, channel, gameId });

    // Broadcast "typing" para o canal apropriado
    if (channel === 'lobby') {
      this.io.emit('user_typing', { userId, channel });
    } else if (channel === 'game' && gameId) {
      this.io.to(`game_${gameId}`).emit('user_typing', { userId, channel, gameId });
    }

    // Auto-limpar após 3 segundos
    setTimeout(() => {
      if (this.typingUsers.get(socketId)) {
        this.stopTyping(socketId);
      }
    }, 3000);
  }

  /**
   * Parar de digitar
   */
  stopTyping(socketId) {
    const typingData = this.typingUsers.get(socketId);

    if (typingData) {
      const { userId, channel, gameId } = typingData;

      // Broadcast "stopped typing"
      if (channel === 'lobby') {
        this.io.emit('user_stopped_typing', { userId, channel });
      } else if (channel === 'game' && gameId) {
        this.io.to(`game_${gameId}`).emit('user_stopped_typing', { userId, channel, gameId });
      }

      this.typingUsers.delete(socketId);
    }
  }

  /**
   * Limpar typing ao desconectar
   */
  handleDisconnect(socketId) {
    this.stopTyping(socketId);
  }
}

module.exports = ChatService;
