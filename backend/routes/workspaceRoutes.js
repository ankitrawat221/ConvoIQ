const express = require('express')
const {
  createWorkspace,
  getWorkspaces,
  getWorkspaceById,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceMeetings,
  askWorkspaceQuestion,
} = require('../controllers/workspaceController')

const router = express.Router()

router.post('/', createWorkspace)
router.get('/', getWorkspaces)
router.get('/:id/meetings', getWorkspaceMeetings)
router.post('/:id/chat', askWorkspaceQuestion)
router.get('/:id', getWorkspaceById)
router.put('/:id', updateWorkspace)
router.delete('/:id', deleteWorkspace)

module.exports = router
