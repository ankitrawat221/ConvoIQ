const mongoose = require('mongoose')

async function connectDB() {
  const mongoUri = process.env.MONGO_URI

  if (!mongoUri) {
    throw new Error('MONGO_URI is not configured in backend/.env.')
  }

  try {
    await mongoose.connect(mongoUri)
    console.log('MongoDB connected successfully.')
  } catch {
    throw new Error(
      'MongoDB connection failed. Check MONGO_URI, Atlas network access, and database user settings.',
    )
  }
}

module.exports = connectDB
