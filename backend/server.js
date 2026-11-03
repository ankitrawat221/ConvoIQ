const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })

const cors = require('cors')
const express = require('express')
const connectDB = require('./config/db')
const meetingRoutes = require('./routes/meetingRoutes')

const app = express()
const port = process.env.PORT || 5000

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
}))
app.use(express.json())
app.use('/api/meetings', meetingRoutes)

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'ConvoIQ backend is running',
  })
})

app.use((error, _req, res, _next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Request body contains invalid JSON.',
      data: null,
    })
  }

  return res.status(500).json({
    success: false,
    message: 'An unexpected server error occurred.',
    data: null,
  })
})

async function startServer() {
  try {
    await connectDB()
    app.listen(port, () => {
      console.log(`ConvoIQ backend listening on port ${port}`)
    })
  } catch (error) {
    console.error(`Backend startup failed: ${error.message}`)
    process.exitCode = 1
  }
}

startServer()
