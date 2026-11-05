const mongoose = require('mongoose')
const Meeting = require('../models/Meeting')
const Workspace = require('../models/Workspace')

function isObjectBody(body) {
  return body !== null && typeof body === 'object' && !Array.isArray(body)
}

function isValidWorkspaceId(id) {
  return /^[a-f\d]{24}$/i.test(id) && mongoose.isValidObjectId(id)
}

function sendError(res, status, message, fields) {
  const response = { success: false, message, data: null }
  if (fields) response.fields = fields
  return res.status(status).json(response)
}

function sendModelError(res, error) {
  if (error instanceof mongoose.Error.ValidationError) {
    return sendError(res, 400, 'Workspace validation failed.', Object.keys(error.errors))
  }

  if (error instanceof mongoose.Error.CastError) {
    return sendError(res, 400, 'One or more workspace fields have an invalid value.')
  }

  return sendError(res, 500, 'An unexpected error occurred while processing the workspace.')
}

async function createWorkspace(req, res) {
  if (!isObjectBody(req.body)) {
    return sendError(res, 400, 'Request body must be a JSON object.')
  }

  if (typeof req.body.name !== 'string' || !req.body.name.trim()) {
    return sendError(res, 400, 'Workspace name is required.', ['name'])
  }
  if (Object.hasOwn(req.body, 'description') && typeof req.body.description !== 'string') {
    return sendError(res, 400, 'Workspace description must be a string.', ['description'])
  }

  try {
    const workspace = await Workspace.create({
      name: req.body.name,
      description: typeof req.body.description === 'string' ? req.body.description : '',
    })
    return res.status(201).json({
      success: true,
      message: 'Workspace created successfully.',
      data: workspace,
    })
  } catch (error) {
    return sendModelError(res, error)
  }
}

async function getWorkspaces(_req, res) {
  try {
    const [workspaces, counts] = await Promise.all([
      Workspace.find().sort({ updatedAt: -1 }).lean(),
      Meeting.aggregate([
        { $match: { workspaceId: { $type: 'objectId' } } },
        { $sort: { meetingDate: -1, createdAt: -1 } },
        {
          $group: {
            _id: '$workspaceId',
            meetingCount: { $sum: 1 },
            recentMeeting: {
              $first: {
                id: '$_id',
                title: '$title',
                meetingDate: '$meetingDate',
              },
            },
          },
        },
      ]),
    ])
    const statsByWorkspace = new Map(counts.map((item) => [String(item._id), item]))

    return res.status(200).json({
      success: true,
      message: 'Workspaces retrieved successfully.',
      data: workspaces.map((workspace) => {
        const stats = statsByWorkspace.get(String(workspace._id))
        return {
          ...workspace,
          meetingCount: stats?.meetingCount || 0,
          recentMeeting: stats?.recentMeeting || null,
        }
      }),
    })
  } catch {
    return sendError(res, 500, 'An unexpected error occurred while retrieving workspaces.')
  }
}

async function getWorkspaceById(req, res) {
  if (!isValidWorkspaceId(req.params.id)) {
    return sendError(res, 400, 'Workspace ID is invalid.')
  }

  try {
    const workspace = await Workspace.findById(req.params.id)
    if (!workspace) return sendError(res, 404, 'Workspace not found.')
    return res.status(200).json({
      success: true,
      message: 'Workspace retrieved successfully.',
      data: workspace,
    })
  } catch {
    return sendError(res, 500, 'An unexpected error occurred while retrieving the workspace.')
  }
}

async function updateWorkspace(req, res) {
  if (!isValidWorkspaceId(req.params.id)) {
    return sendError(res, 400, 'Workspace ID is invalid.')
  }
  if (!isObjectBody(req.body)) {
    return sendError(res, 400, 'Request body must be a JSON object.')
  }

  const fields = {}
  if (Object.hasOwn(req.body, 'name')) {
    if (typeof req.body.name !== 'string' || !req.body.name.trim()) {
      return sendError(res, 400, 'Workspace name cannot be empty.', ['name'])
    }
    fields.name = req.body.name
  }
  if (Object.hasOwn(req.body, 'description')) {
    if (typeof req.body.description !== 'string') {
      return sendError(res, 400, 'Workspace description must be a string.', ['description'])
    }
    fields.description = req.body.description
  }
  if (Object.keys(fields).length === 0) {
    return sendError(res, 400, 'Provide a workspace name or description to update.')
  }

  try {
    const workspace = await Workspace.findById(req.params.id)
    if (!workspace) return sendError(res, 404, 'Workspace not found.')
    workspace.set(fields)
    await workspace.save()
    return res.status(200).json({
      success: true,
      message: 'Workspace updated successfully.',
      data: workspace,
    })
  } catch (error) {
    return sendModelError(res, error)
  }
}

async function deleteWorkspace(req, res) {
  if (!isValidWorkspaceId(req.params.id)) {
    return sendError(res, 400, 'Workspace ID is invalid.')
  }

  try {
    const workspace = await Workspace.findById(req.params.id)
    if (!workspace) return sendError(res, 404, 'Workspace not found.')

    await Meeting.updateMany(
      { workspaceId: workspace._id },
      { $set: { workspaceId: null } },
    )
    await workspace.deleteOne()

    return res.status(200).json({
      success: true,
      message: 'Workspace deleted. Its meetings remain unassigned.',
      data: null,
    })
  } catch {
    return sendError(res, 500, 'An unexpected error occurred while deleting the workspace.')
  }
}

async function getWorkspaceMeetings(req, res) {
  if (!isValidWorkspaceId(req.params.id)) {
    return sendError(res, 400, 'Workspace ID is invalid.')
  }

  try {
    const workspaceExists = await Workspace.exists({ _id: req.params.id })
    if (!workspaceExists) return sendError(res, 404, 'Workspace not found.')

    const meetings = await Meeting.find({ workspaceId: req.params.id })
      .sort({ meetingDate: -1, createdAt: -1 })
    return res.status(200).json({
      success: true,
      message: 'Workspace meetings retrieved successfully.',
      data: meetings,
    })
  } catch {
    return sendError(res, 500, 'An unexpected error occurred while retrieving workspace meetings.')
  }
}

async function askWorkspaceQuestion(req, res) {
  if (!isValidWorkspaceId(req.params.id)) {
    return sendError(res, 400, 'Workspace ID is invalid.')
  }
  if (!isObjectBody(req.body) || typeof req.body.question !== 'string' || !req.body.question.trim()) {
    return sendError(res, 400, 'A non-empty question is required.', ['question'])
  }

  try {
    const workspaceExists = await Workspace.exists({ _id: req.params.id })
    if (!workspaceExists) return sendError(res, 404, 'Workspace not found.')

    return res.status(501).json({
      success: false,
      message: 'Workspace AI chat is unavailable because no AI provider is configured.',
      data: null,
    })
  } catch {
    return sendError(res, 500, 'An unexpected error occurred while checking the workspace.')
  }
}

module.exports = {
  createWorkspace,
  getWorkspaces,
  getWorkspaceById,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceMeetings,
  askWorkspaceQuestion,
}
