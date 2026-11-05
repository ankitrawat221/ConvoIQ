const express = require('express')
const { generateResponse, MAX_PROMPT_LENGTH } = require('../services/ollamaService')

const router = express.Router()

router.post('/test', async (req, res) => {
  if (
    req.body === null ||
    typeof req.body !== 'object' ||
    Array.isArray(req.body) ||
    typeof req.body.prompt !== 'string' ||
    !req.body.prompt.trim()
  ) {
    return res.status(400).json({
      success: false,
      message: 'A non-empty prompt string is required.',
      data: null,
    })
  }
  if (req.body.prompt.length > MAX_PROMPT_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Prompt must be ${MAX_PROMPT_LENGTH} characters or fewer.`,
      data: null,
    })
  }

  try {
    const data = await generateResponse(req.body.prompt)
    return res.status(200).json({
      success: true,
      message: 'Local AI response generated successfully.',
      data,
    })
  } catch (error) {
    const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError'
    console.error('Local AI request failed:', error.name || 'Error', error.code || 'NO_CODE')
    return res.status(timedOut ? 504 : 502).json({
      success: false,
      message: timedOut
        ? 'The local AI request timed out.'
        : 'The local AI service is unavailable or returned an invalid response.',
      data: null,
    })
  }
})

module.exports = router
