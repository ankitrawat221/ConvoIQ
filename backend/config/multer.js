const crypto = require('crypto')
const fs = require('fs')
const multer = require('multer')
const path = require('path')

const uploadDirectory = path.join(__dirname, '..', 'uploads', 'meetings')
const supportedMimeTypes = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/vnd.wave',
])

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    fs.mkdir(uploadDirectory, { recursive: true }, (error) => callback(error, uploadDirectory))
  },
  filename: (_req, file, callback) => {
    callback(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase()
    if (!['.mp3', '.wav'].includes(extension) || !supportedMimeTypes.has(file.mimetype)) {
      const error = new Error('Only MP3 and WAV audio files are supported.')
      error.code = 'UNSUPPORTED_AUDIO_TYPE'
      callback(error)
      return
    }
    callback(null, true)
  },
})

module.exports = { upload, uploadDirectory }
