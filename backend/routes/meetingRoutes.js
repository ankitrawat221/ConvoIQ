const express = require('express')
const mongoose = require('mongoose')
const {
  processMeetingAudio,
  processMeetingTranscript,
} = require('../services/meetingProcessingService')
const {
  createMeeting,
  getAllMeetings,
  getMeetingById,
  updateMeeting,
  updateMeetingTaskStatus,
  deleteMeeting,
  updateMeetingWorkspace,
} = require('../controllers/meetingController')

const router = express.Router()

router.post('/:id/process', async (req, res) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id) || !mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Meeting ID is invalid.', data: null })
  }
  if (
    req.body !== undefined &&
    (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body))
  ) {
    return res.status(400).json({ success: false, message: 'Request body must be a JSON object.', data: null })
  }
  if (
    req.body &&
    Object.hasOwn(req.body, 'transcript') &&
    typeof req.body.transcript !== 'string'
  ) {
    return res.status(400).json({ success: false, message: 'transcript must be a string.', data: null })
  }

  try {
    const transcript = req.body && Object.hasOwn(req.body, 'transcript')
      ? req.body.transcript
      : undefined
    const audioProcessing = transcript === undefined
    const meeting = audioProcessing
      ? await processMeetingAudio(req.params.id)
      : await processMeetingTranscript(req.params.id, transcript)
    return res.status(200).json({
      success: true,
      message: audioProcessing
        ? 'Meeting audio transcribed and analyzed successfully.'
        : 'Meeting transcript analyzed successfully.',
      data: meeting,
    })
  } catch (error) {
    const statusByCode = {
      AUDIO_ACCESS_FAILED: 500,
      AUDIO_NOT_FOUND: 404,
      AUDIO_REQUIRED: 400,
      MEETING_NOT_FOUND: 404,
      TRANSCRIPT_REQUIRED: 400,
      DUPLICATE_PROCESSING: 409,
      EMPTY_TRANSCRIPT: 422,
      MODEL_NOT_INSTALLED: 503,
      OLLAMA_UNAVAILABLE: 503,
      OLLAMA_TIMEOUT: 504,
      TRANSCRIPT_TOO_LONG: 413,
      INVALID_MODEL_RESPONSE: 502,
      INVALID_TRANSCRIPTION_RESPONSE: 502,
      DATABASE_SAVE_FAILED: 500,
      ANALYSIS_FAILED: 502,
      PROCESSING_CONFLICT: 409,
      PROCESSING_FAILED: 502,
      TRANSCRIBER_NOT_CONFIGURED: 503,
      TRANSCRIPTION_FAILED: 502,
      TRANSCRIPTION_TIMEOUT: 504,
      UNSUPPORTED_AUDIO_FORMAT: 415,
    }
    const status = statusByCode[error.code] || 500
    const message = error.publicMessage || (
      status === 500
        ? 'An unexpected error occurred while analyzing the meeting.'
        : error.message
    )
    console.error(JSON.stringify({
      event: 'meeting_processing_request_failed',
      meetingId: req.params.id,
      stage: error.processingStage || error.stage || 'request',
      error: {
        name: error.name || 'Error',
        code: error.code || null,
        message: error.message || 'Unknown error',
        ...(process.env.NODE_ENV !== 'production' && error.stack ? { stack: error.stack } : {}),
      },
    }))
    return res.status(status).json({
      success: false,
      message,
      data: null,
    })
  }
})

router.post('/', createMeeting)
router.get('/', getAllMeetings)
router.patch('/:id/workspace', updateMeetingWorkspace)
router.get('/:id', getMeetingById)
router.put('/:id', updateMeeting)
router.patch('/:id/tasks/:taskId/status', updateMeetingTaskStatus)
router.delete('/:id', deleteMeeting)

module.exports = router
