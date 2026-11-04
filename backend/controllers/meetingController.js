const mongoose = require('mongoose')
const Meeting = require('../models/Meeting')

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
    const meeting = new Meeting(fields)
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

    meeting.set(fields)
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

module.exports = {
  createMeeting,
  getAllMeetings,
  getMeetingById,
  updateMeeting,
  deleteMeeting,
}
