const express = require('express')
const mongoose = require('mongoose')
const Meeting = require('../models/Meeting')
const { processMeetingAudio } = require('../services/meetingProcessingService')
const {
  createMeeting,
  getAllMeetings,
  getMeetingById,
  updateMeeting,
  deleteMeeting,
  updateMeetingWorkspace,
} = require('../controllers/meetingController')

const router = express.Router()

router.post('/:id/process', async (req, res) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id) || !mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Meeting ID is invalid.', data: null })
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      success: false,
      message: 'AI processing is not configured. Add OPENAI_API_KEY to backend/.env and restart the backend.',
      data: null,
    })
  }

  try {
    const meeting = await Meeting.findById(req.params.id)
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found.', data: null })
    }
    if (!meeting.audioUrl) {
      return res.status(400).json({ success: false, message: 'Upload an audio recording before starting AI processing.', data: null })
    }
    if (['transcribing', 'analyzing'].includes(meeting.processingStatus)) {
      return res.status(409).json({ success: false, message: 'This meeting is already being processed.', data: null })
    }
    if (meeting.processingStatus === 'completed' && meeting.processingAudioUrl === meeting.audioUrl) {
      return res.status(409).json({ success: false, message: 'This recording has already been processed.', data: null })
    }

    const started = await Meeting.findOneAndUpdate(
      {
        _id: meeting._id,
        audioUrl: meeting.audioUrl,
        processingStatus: { $nin: ['transcribing', 'analyzing', 'completed'] },
      },
      {
        $set: {
          processingStatus: 'transcribing',
          processingError: null,
          processingAudioUrl: meeting.audioUrl,
          processingStartedAt: new Date(),
          processingCompletedAt: null,
          transcriptSegments: [],
          discussionPoints: [],
          customerInsights: { concerns: [], responses: [], outcomes: [] },
          tasks: [],
          decisions: [],
        },
        $unset: {
          transcript: 1,
          summary: 1,
        },
      },
      { returnDocument: 'after' },
    )
    if (!started) {
      return res.status(409).json({ success: false, message: 'This meeting is already being processed or this recording is complete.', data: null })
    }

    setImmediate(() => {
      processMeetingAudio(String(started._id), started.audioUrl).catch((error) => {
        console.error('Meeting processing worker failed:', error.name || 'Error', error.code || 'NO_CODE')
      })
    })

    return res.status(202).json({
      success: true,
      message: 'AI meeting processing started.',
      data: started,
    })
  } catch (error) {
    console.error(
      'Could not start meeting processing:',
      error.name || 'Error',
      error.code || 'NO_CODE',
    )
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while starting meeting processing.',
      data: null,
    })
  }
})

router.post('/', createMeeting)
router.get('/', getAllMeetings)
router.patch('/:id/workspace', updateMeetingWorkspace)
router.get('/:id', getMeetingById)
router.put('/:id', updateMeeting)
router.delete('/:id', deleteMeeting)

module.exports = router
