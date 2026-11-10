const mongoose = require('mongoose')
const Meeting = require('../models/Meeting')
const Workspace = require('../models/Workspace')

const editableFields = [
  'title',
  'description',
  'meetingDate',
  'duration',
  'status',
  'audioUrl',
  'transcript',
  'summary',
  'participants',
]

function isObjectBody(body) {
  return body !== null && typeof body === 'object' && !Array.isArray(body)
}

function pickMeetingFields(body) {
  return Object.fromEntries(
    editableFields
      .filter((field) => Object.hasOwn(body, field))
      .map((field) => [field, body[field]]),
  )
}

function sendError(res, status, message, fields) {
  const response = { success: false, message, data: null }
  if (fields) response.fields = fields
  return res.status(status).json(response)
}

function sendModelError(res, error) {
  if (error instanceof mongoose.Error.ValidationError) {
    return sendError(
      res,
      400,
      'Meeting validation failed.',
      Object.keys(error.errors),
    )
  }

  if (error instanceof mongoose.Error.CastError) {
    return sendError(res, 400, 'One or more meeting fields have an invalid value.')
  }

  return sendError(res, 500, 'An unexpected error occurred while processing the meeting.')
}

function isValidMeetingId(id) {
  return /^[a-f\d]{24}$/i.test(id) && mongoose.isValidObjectId(id)
}

async function createMeeting(req, res) {
  if (!isObjectBody(req.body)) {
    return sendError(res, 400, 'Request body must be a JSON object.')
  }

  const fields = pickMeetingFields(req.body)
  if (!Object.hasOwn(fields, 'title') || !Object.hasOwn(fields, 'meetingDate')) {
    return sendError(res, 400, 'title and meetingDate are required.', [
      ...(!Object.hasOwn(fields, 'title') ? ['title'] : []),
      ...(!Object.hasOwn(fields, 'meetingDate') ? ['meetingDate'] : []),
    ])
  }

  try {
    if (Object.hasOwn(req.body, 'workspaceId') && req.body.workspaceId !== null) {
      if (!isValidMeetingId(req.body.workspaceId)) {
        return sendError(res, 400, 'Workspace ID is invalid.', ['workspaceId'])
      }

      const workspaceExists = await Workspace.exists({ _id: req.body.workspaceId })
      if (!workspaceExists) return sendError(res, 404, 'Workspace not found.')
    }

    const meeting = new Meeting(fields)
    if (Object.hasOwn(req.body, 'workspaceId')) {
      meeting.workspaceId = req.body.workspaceId
    }
    await meeting.save()
    return res.status(201).json({
      success: true,
      message: 'Meeting created successfully.',
      data: meeting,
    })
  } catch (error) {
    return sendModelError(res, error)
  }
}

async function getAllMeetings(_req, res) {
  try {
    const meetings = await Meeting.find().sort({ meetingDate: -1, createdAt: -1 })
    return res.status(200).json({
      success: true,
      message: 'Meetings retrieved successfully.',
      data: meetings,
    })
  } catch {
    return sendError(res, 500, 'An unexpected error occurred while retrieving meetings.')
  }
}

async function getMeetingById(req, res) {
  if (!isValidMeetingId(req.params.id)) {
    return sendError(res, 400, 'Meeting ID is invalid.')
  }

  try {
    const meeting = await Meeting.findById(req.params.id)
    if (!meeting) return sendError(res, 404, 'Meeting not found.')

    return res.status(200).json({
      success: true,
      message: 'Meeting retrieved successfully.',
      data: meeting,
    })
  } catch {
    return sendError(res, 500, 'An unexpected error occurred while retrieving the meeting.')
  }
}

async function updateMeeting(req, res) {
  if (!isValidMeetingId(req.params.id)) {
    return sendError(res, 400, 'Meeting ID is invalid.')
  }
  if (!isObjectBody(req.body)) {
    return sendError(res, 400, 'Request body must be a JSON object.')
  }

  const fields = pickMeetingFields(req.body)
  if (Object.keys(fields).length === 0) {
    return sendError(res, 400, 'Provide at least one valid meeting field to update.')
  }

  try {
    const meeting = await Meeting.findById(req.params.id)
    if (!meeting) return sendError(res, 404, 'Meeting not found.')
    const transcriptChanged = Object.hasOwn(fields, 'transcript') && fields.transcript !== meeting.transcript
    if (transcriptChanged && ['transcribing', 'transcription_completed', 'analyzing'].includes(meeting.processingStatus)) {
      return sendError(res, 409, 'Wait for meeting processing to finish before changing its transcript.')
    }

    meeting.set(fields)
    if (transcriptChanged) {
      meeting.set({
        summary: null,
        discussionPoints: [],
        customerInsights: { concerns: [], responses: [], outcomes: [] },
        tasks: [],
        decisions: [],
        unresolvedQuestions: [],
        processingStatus: null,
        processingError: null,
        processingStartedAt: null,
        processingCompletedAt: null,
        processingAudioUrl: null,
        processingTranscript: null,
        processingTranscriptSegments: [],
      })
    }
    await meeting.save()
    return res.status(200).json({
      success: true,
      message: 'Meeting updated successfully.',
      data: meeting,
    })
  } catch (error) {
    return sendModelError(res, error)
  }
}

async function updateMeetingTaskStatus(req, res) {
  if (!isValidMeetingId(req.params.id) || !mongoose.isValidObjectId(req.params.taskId)) {
    return sendError(res, 400, 'Meeting or task ID is invalid.')
  }
  const allowedStatuses = new Set(['pending', 'in_progress', 'completed', 'cancelled'])
  if (!isObjectBody(req.body) || !allowedStatuses.has(req.body.status)) {
    return sendError(res, 400, 'Task status is invalid.', ['status'])
  }
  try {
    const meeting = await Meeting.findOneAndUpdate(
      { _id: req.params.id, 'tasks._id': req.params.taskId },
      { $set: { 'tasks.$.status': req.body.status } },
      { returnDocument: 'after', runValidators: true },
    )
    if (!meeting) return sendError(res, 404, 'Meeting or task not found.')
    return res.status(200).json({ success: true, message: 'Task status updated successfully.', data: meeting })
  } catch (error) {
    return sendModelError(res, error)
  }
}

async function deleteMeeting(req, res) {
  if (!isValidMeetingId(req.params.id)) {
    return sendError(res, 400, 'Meeting ID is invalid.')
  }

  try {
    const meeting = await Meeting.findByIdAndDelete(req.params.id)
    if (!meeting) return sendError(res, 404, 'Meeting not found.')

    return res.status(200).json({
      success: true,
      message: 'Meeting deleted successfully.',
      data: meeting,
    })
  } catch {
    return sendError(res, 500, 'An unexpected error occurred while deleting the meeting.')
  }
}

async function updateMeetingWorkspace(req, res) {
  if (!isValidMeetingId(req.params.id)) {
    return sendError(res, 400, 'Meeting ID is invalid.')
  }
  if (!isObjectBody(req.body) || !Object.hasOwn(req.body, 'workspaceId')) {
    return sendError(res, 400, 'workspaceId is required and must be a workspace ID or null.')
  }

  const { workspaceId } = req.body
  if (workspaceId !== null && !isValidMeetingId(workspaceId)) {
    return sendError(res, 400, 'Workspace ID is invalid.', ['workspaceId'])
  }

  try {
    if (workspaceId !== null) {
      const workspaceExists = await Workspace.exists({ _id: workspaceId })
      if (!workspaceExists) return sendError(res, 404, 'Workspace not found.')
    }

    const meeting = await Meeting.findById(req.params.id)
    if (!meeting) return sendError(res, 404, 'Meeting not found.')

    meeting.workspaceId = workspaceId
    await meeting.save()
    return res.status(200).json({
      success: true,
      message: workspaceId === null ? 'Meeting removed from its workspace.' : 'Meeting assigned to workspace.',
      data: meeting,
    })
  } catch (error) {
    return sendModelError(res, error)
  }
}

module.exports = {
  createMeeting,
  getAllMeetings,
  getMeetingById,
  updateMeeting,
  updateMeetingTaskStatus,
  deleteMeeting,
  updateMeetingWorkspace,
}
