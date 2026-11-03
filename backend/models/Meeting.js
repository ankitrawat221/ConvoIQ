const mongoose = require('mongoose')

const participantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    speakerLabel: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
)

const meetingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
    },
    meetingDate: {
      type: Date,
      required: true,
    },
    duration: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['scheduled', 'recording', 'processing', 'completed', 'failed'],
      default: 'scheduled',
    },
    audioUrl: {
      type: String,
    },
    transcript: {
      type: String,
    },
    summary: {
      type: String,
    },
    participants: {
      type: [participantSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'meetings',
  },
)

module.exports = mongoose.models.Meeting || mongoose.model('Meeting', meetingSchema)
