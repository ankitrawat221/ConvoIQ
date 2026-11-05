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

const transcriptSegmentSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    start: { type: Number, min: 0 },
    end: { type: Number, min: 0 },
    speakerLabel: { type: String, trim: true },
  },
  { _id: false },
)

const taskSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    owner: { type: String, trim: true, default: null },
    deadline: { type: String, trim: true, default: null },
  },
  { timestamps: true },
)

const decisionSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
  },
  { timestamps: true },
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
    processingStatus: {
      type: String,
      enum: ['uploaded', 'transcribing', 'analyzing', 'completed', 'failed'],
      default: null,
    },
    processingError: {
      type: String,
      default: null,
    },
    processingStartedAt: {
      type: Date,
      default: null,
    },
    processingCompletedAt: {
      type: Date,
      default: null,
    },
    processingAudioUrl: {
      type: String,
      default: null,
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
    transcriptSegments: {
      type: [transcriptSegmentSchema],
      default: [],
    },
    discussionPoints: {
      type: [String],
      default: [],
    },
    customerInsights: {
      concerns: { type: [String], default: [] },
      responses: { type: [String], default: [] },
      outcomes: { type: [String], default: [] },
    },
    tasks: {
      type: [taskSchema],
      default: [],
    },
    decisions: {
      type: [decisionSchema],
      default: [],
    },
    participants: {
      type: [participantSchema],
      default: [],
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'meetings',
  },
)

module.exports = mongoose.models.Meeting || mongoose.model('Meeting', meetingSchema)
