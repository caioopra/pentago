const mongoose = require('mongoose');
const seedAdmin = require('./seedAdmin');
const { initGridFS } = require('./gridfs');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pentago');

    console.log(`✅ MongoDB conectado: ${conn.connection.host}`);

    // Initialize GridFS for video storage
    initGridFS();

    // Seed do administrador padrão
    await seedAdmin();
  } catch (error) {
    console.error(`❌ Erro ao conectar MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
