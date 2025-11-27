const path = require('path');
const fs = require('fs').promises;

/**
 * @desc    Upload avatar (for admin default avatar or general uploads)
 * @route   POST /api/upload/avatar
 * @access  Private
 */
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, envie uma imagem.'
      });
    }

    // Return the uploaded file path
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    res.status(200).json({
      success: true,
      message: 'Avatar enviado com sucesso!',
      data: {
        avatarUrl
      }
    });
  } catch (error) {
    console.error('Erro ao fazer upload do avatar:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao fazer upload do avatar.'
    });
  }
};

/**
 * @desc    Delete an uploaded file
 * @route   DELETE /api/upload/:filename
 * @access  Private/Admin
 */
exports.deleteFile = async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../../uploads/avatars', filename);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        success: false,
        message: 'Arquivo não encontrado.'
      });
    }

    // Don't allow deleting default avatar
    if (filename.includes('default')) {
      return res.status(403).json({
        success: false,
        message: 'Não é possível deletar o avatar padrão.'
      });
    }

    await fs.unlink(filePath);

    res.status(200).json({
      success: true,
      message: 'Arquivo deletado com sucesso!'
    });
  } catch (error) {
    console.error('Erro ao deletar arquivo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar arquivo.'
    });
  }
};
