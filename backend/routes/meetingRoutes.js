const express = require('express')
const {
  createMeeting,
  getAllMeetings,
  getMeetingById,
  updateMeeting,
  deleteMeeting,
} = require('../controllers/meetingController')

const router = express.Router()

router.post('/', createMeeting)
router.get('/', getAllMeetings)
router.get('/:id', getMeetingById)
router.put('/:id', updateMeeting)
router.delete('/:id', deleteMeeting)

module.exports = router
