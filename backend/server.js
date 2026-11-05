const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })

const cors = require('cors')
const express = require('express')
const multer = require('multer')
const connectDB = require('./config/db')
const meetingRoutes = require('./routes/meetingRoutes')
const audioRoutes = require('./routes/audioRoutes')
const workspaceRoutes = require('./routes/workspaceRoutes')
const aiRoutes = require('./routes/aiRoutes')
const { markInterruptedProcessingAsFailed } = require('./services/meetingProcessingService')

const app = express()
const port = process.env.PORT || 5000

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
}))
app.use(express.json())
app.use('/api/meetings', meetingRoutes)
app.use('/api/workspaces', workspaceRoutes)
app.use('/api/audio', audioRoutes)
app.use('/api/ai', aiRoutes)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { fallthrough: false, index: false }))

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'ConvoIQ backend is running',
  })
})

app.use((error, _req, res, _next) => {
  if (error.status === 404) {
    return res.status(404).json({ success: false, message: 'Uploaded file not found.', data: null })
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Request body contains invalid JSON.',
      data: null,
    })
  }

  if (error instanceof multer.MulterError) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400
    return res.status(status).json({
      success: false,
      message: error.code === 'LIMIT_FILE_SIZE'
        ? 'Audio files must be 100 MB or smaller.'
        : 'The audio upload could not be processed.',
      data: null,
    })
  }

  if (error.code === 'UNSUPPORTED_AUDIO_TYPE') {
    return res.status(415).json({ success: false, message: error.message, data: null })
  }

  console.error('Request failed:', error.name || 'Error', error.code || 'NO_CODE')
  return res.status(500).json({
    success: false,
    message: 'An unexpected server error occurred.',
    data: null,
  })
})

async function startServer() {
  try {
    await connectDB()
    await markInterruptedProcessingAsFailed()
    app.listen(port, () => {
      console.log(`ConvoIQ backend listening on port ${port}`)
    })
  } catch (error) {
    console.error(`Backend startup failed: ${error.message}`)
    process.exitCode = 1
  }
}

startServer()
