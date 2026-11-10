const express = require('express')
const fs = require('fs/promises')
const mongoose = require('mongoose')
const path = require('path')
const Meeting = require('../models/Meeting')
const { upload, uploadDirectory } = require('../config/multer')

const router = express.Router()

function isValidMeetingId(id) {
  return /^[a-f\d]{24}$/i.test(id) && mongoose.isValidObjectId(id)
}

async function removeStoredAudio(audioUrl) {
  if (!audioUrl || !audioUrl.startsWith('/uploads/meetings/')) return
  const filePath = path.join(uploadDirectory, path.basename(audioUrl))
  await fs.unlink(filePath).catch((error) => {
    if (error.code !== 'ENOENT') throw error
  })
}

router.post('/:meetingId', async (req, res, next) => {
  if (!isValidMeetingId(req.params.meetingId)) {
    return res.status(400).json({ success: false, message: 'Meeting ID is invalid.', data: null })
  }

  try {
    const meeting = await Meeting.findById(req.params.meetingId)
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found.', data: null })
    }
    if (['transcribing', 'transcription_completed', 'analyzing'].includes(meeting.processingStatus)) {
      return res.status(409).json({
        success: false,
        message: 'This meeting is being processed. Wait for processing to finish before replacing its audio.',
        data: null,
      })
    }
    req.meeting = meeting
    return next()
  } catch (error) {
    return next(error)
  }
}, upload.single('audio'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload an audio file using the "audio" field.', data: null })
  }

  const previousProcessingAudioUrl = req.meeting.processingAudioUrl
  const audioUrl = `/uploads/meetings/${req.file.filename}`
  req.meeting.processingStatus = 'uploaded'
  req.meeting.processingError = null
  req.meeting.processingStartedAt = null
  req.meeting.processingCompletedAt = null
  req.meeting.processingProgress = 10
  req.meeting.processingStage = 'Audio uploaded'
  req.meeting.processingLastCompletedStage = 'Audio uploaded'
  req.meeting.processingProgressUpdatedAt = new Date()
  req.meeting.processingAudioUrl = audioUrl
  req.meeting.processingTranscript = null
  req.meeting.processingTranscriptSegments = []
  try {
    await req.meeting.save()
    if (previousProcessingAudioUrl && previousProcessingAudioUrl !== req.meeting.audioUrl) {
      await removeStoredAudio(previousProcessingAudioUrl).catch((error) => {
        console.error(`Unable to remove replaced staged meeting audio: ${error.message}`)
      })
    }
    return res.status(200).json({
      success: true,
      message: 'Audio uploaded successfully. Transcription has not been run.',
      data: {
        filename: req.file.filename,
        audioUrl,
        processingAudioUrl: audioUrl,
        size: req.file.size,
        meetingId: req.meeting.id,
      },
    })
  } catch (error) {
    await fs.unlink(req.file.path).catch((cleanupError) => {
      if (cleanupError.code !== 'ENOENT') {
        console.error(`Unable to remove failed audio upload: ${cleanupError.message}`)
      }
    })
    return next(error)
  }
})

module.exports = router
