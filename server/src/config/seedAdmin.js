const User = require('../models/User');

/**
 * Seed do administrador padrão
 * Cria um usuário admin se não existir nenhum no sistema
 */
async function seedAdmin() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@pentago.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    // Verificar se já existe um admin no sistema
    const existingAdmin = await User.findOne({ role: 'admin' });

    if (existingAdmin) {
      console.log('✅ Administrador já existe no sistema');
      return;
    }

    // Verificar se o email do admin já está em uso
    const existingUser = await User.findOne({ email: adminEmail });

    if (existingUser) {
      // Promover usuário existente a admin
      existingUser.role = 'admin';
      await existingUser.save();
      console.log(`✅ Usuário ${adminEmail} promovido a administrador`);
      return;
    }

    // Criar novo usuário admin
    const adminUser = await User.create({
      name: 'Administrador',
      email: adminEmail,
      password: adminPassword,
      age: 18,
      role: 'admin',
      city: 'Florianópolis',
      state: 'SC',
      country: 'Brasil'
    });

    console.log(`✅ Administrador criado com sucesso: ${adminUser.email}`);
    console.log('   Use as credenciais do arquivo .env para fazer login');

  } catch (error) {
    console.error('❌ Erro ao criar administrador:', error.message);
  }
}

module.exports = seedAdmin;
