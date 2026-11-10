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
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
    },
    owner: { type: String, trim: true, default: null },
    deadline: { type: String, trim: true, default: null },
    evidence: { type: String, trim: true, default: null },
    evidenceStart: { type: Number, min: 0, default: null },
    evidenceEnd: { type: Number, min: 0, default: null },
    supportingEvidence: {
      type: [{
        text: { type: String, trim: true },
        start: { type: Number, min: 0, default: null },
        end: { type: Number, min: 0, default: null },
      }],
      default: [],
    },
  },
  { timestamps: true },
)

const decisionSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    decisionMaker: {
      type: String,
      enum: ['customer', 'agent', 'mutual', null],
      default: null,
    },
    evidence: { type: String, trim: true, default: null },
    evidenceStart: { type: Number, min: 0, default: null },
    evidenceEnd: { type: Number, min: 0, default: null },
  },
  { timestamps: true },
)

const analysisStageSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'empty', 'failed'],
      default: 'pending',
    },
    error: { type: String, default: null },
    completedAt: { type: Date, default: null },
  },
  { _id: false },
)

const analysisDiagnosticSchema = new mongoose.Schema(
  {
    stage: { type: String, required: true },
    model: { type: String, required: true },
    endpoint: { type: String, required: true },
    promptLength: { type: Number, required: true },
    transcriptHash: { type: String, required: true },
    options: { type: mongoose.Schema.Types.Mixed, default: {} },
    responseStatus: { type: Number, default: null },
    rawResponse: { type: String, default: null, maxlength: 12000 },
    rawResponseLength: { type: Number, min: 0, default: null },
    rawResponseTruncated: { type: Boolean, default: false },
    error: { type: String, default: null, maxlength: 500 },
    validationRejections: { type: [mongoose.Schema.Types.Mixed], default: [] },
    createdAt: { type: Date, default: Date.now },
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
    processingStatus: {
      type: String,
      enum: ['uploaded', 'transcribing', 'transcription_completed', 'analyzing', 'completed', 'failed', 'cancelled'],
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
    processingProgress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    processingStage: {
      type: String,
      default: null,
    },
    processingLastCompletedStage: {
      type: String,
      default: null,
    },
    processingProgressUpdatedAt: {
      type: Date,
      default: null,
    },
    processingAudioUrl: {
      type: String,
      default: null,
    },
    processingTranscript: {
      type: String,
      default: null,
    },
    processingTranscriptSegments: {
      type: [transcriptSegmentSchema],
      default: [],
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
    unresolvedQuestions: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    analysisStages: {
      summary: { type: analysisStageSchema, default: () => ({}) },
      tasks: { type: analysisStageSchema, default: () => ({}) },
      decisions: { type: analysisStageSchema, default: () => ({}) },
      unresolvedQuestions: { type: analysisStageSchema, default: () => ({}) },
    },
    analysisDiagnostics: {
      type: [analysisDiagnosticSchema],
      default: [],
      validate: (items) => items.length <= 12,
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
