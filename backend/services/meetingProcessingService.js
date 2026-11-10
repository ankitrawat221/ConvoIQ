const path = require('path')
const Meeting = require('../models/Meeting')
const { uploadDirectory } = require('../config/multer')
const { analyzeMeetingTranscript } = require('./ollamaService')
const localTranscriptionService = require('./localTranscriptionService')
const { sanitizeAnalysisDiagnostics } = require('../utils/diagnostics')

function getAnalysisErrorMessage(error) {
  switch (error.code) {
    case 'MODEL_NOT_INSTALLED':
      return 'The local AI model qwen2.5:3b is not installed. Install the model and retry.'
    case 'OLLAMA_UNAVAILABLE':
      return 'The local Ollama service is unavailable. Start Ollama and retry.'
    case 'OLLAMA_TIMEOUT':
      return 'Local AI analysis timed out. Retry processing.'
    case 'TRANSCRIPT_TOO_LONG':
      return error.message
    case 'DATABASE_SAVE_FAILED':
      return 'Meeting analysis could not be saved. Retry processing.'
    case 'INVALID_MODEL_RESPONSE':
      return error.message
    default:
      return 'Meeting analysis failed. Retry processing.'
  }
}

const ANALYSIS_STAGE_NAMES = ['summary', 'tasks', 'decisions', 'unresolvedQuestions']
const TASK_STATUSES = new Set(['pending', 'in_progress', 'completed', 'cancelled'])
const ANALYSIS_PROGRESS = {
  summary: [60, 'AI summary generated'],
  tasks: [70, 'Follow-up tasks extracted'],
  decisions: [78, 'Decisions extracted'],
  unresolvedQuestions: [85, 'Unresolved questions extracted'],
}

function describeProcessingError(error) {
  const details = {
    name: error?.name || 'Error',
    message: error?.message || String(error),
    code: error?.code || null,
  }
  if (error?.name === 'ValidationError' && error.errors) {
    details.validation = Object.fromEntries(Object.entries(error.errors).map(([pathName, item]) => [pathName, {
      kind: item.kind || null,
      message: item.message || null,
    }]))
  }
  if (error?.code && typeof error.code === 'number') {
    details.mongo = {
      code: error.code,
      keyPattern: error.keyPattern || null,
    }
  }
  if (process.env.NODE_ENV !== 'production' && error?.stack) details.stack = error.stack
  if (error?.cause) details.cause = describeProcessingError(error.cause)
  return details
}

function logProcessingError(meetingId, stage, error) {
  console.error(JSON.stringify({
    event: 'meeting_processing_error',
    meetingId: String(meetingId),
    stage,
    error: describeProcessingError(error),
  }))
}

function pendingAnalysisStages() {
  return Object.fromEntries(ANALYSIS_STAGE_NAMES.map((stage) => [stage, {
    status: 'processing',
    error: null,
    completedAt: null,
  }]))
}

async function updateProcessingProgress(processingQuery, progress, stage, lastCompletedStage = stage) {
  if (!Number.isFinite(progress)) return null
  return Meeting.findOneAndUpdate(
    {
      ...processingQuery,
      processingStatus: { $in: ['transcribing', 'transcription_completed', 'analyzing'] },
      $or: [
        { processingProgress: { $lte: progress } },
        { processingProgress: null },
      ],
    },
    {
      $set: {
        processingProgress: progress,
        processingStage: stage,
        processingLastCompletedStage: lastCompletedStage,
        processingProgressUpdatedAt: new Date(),
      },
    },
    { returnDocument: 'after' },
  )
}

function analysisStageUpdater(processingQuery, stage, value, error = null) {
  const data = {
    [`analysisStages.${stage}`]: {
      status: error ? 'failed' : (Array.isArray(value) && value.length === 0 ? 'empty' : 'completed'),
      error: error || null,
      completedAt: error ? null : new Date(),
    },
  }
  if (stage === 'summary' && value?.summary !== undefined) data.summary = value.summary
  if (stage === 'tasks' && value?.tasks) data.tasks = value.tasks
  if (stage === 'decisions' && value?.decisions) data.decisions = value.decisions
  if (stage === 'unresolvedQuestions' && value?.unresolvedQuestions) data.unresolvedQuestions = value.unresolvedQuestions
  const progress = ANALYSIS_PROGRESS[stage]
  if (progress && !error) {
    data.processingProgress = progress[0]
    data.processingStage = progress[1]
    data.processingLastCompletedStage = progress[1]
    data.processingProgressUpdatedAt = new Date()
  }
  return data
}

function failedAnalysisStageUpdates(current, message) {
  return Object.fromEntries(ANALYSIS_STAGE_NAMES.map((stage) => {
    const previous = current?.analysisStages?.[stage]
    return [`analysisStages.${stage}`, previous?.status === 'completed' || previous?.status === 'empty'
      ? previous
      : { status: 'failed', error: message, completedAt: null }]
  }))
}

function taskIdentity(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function reconcileTaskRecords(previous, extracted) {
  const oldTasks = Array.isArray(previous) ? previous : []
  return (Array.isArray(extracted) ? extracted : []).map((task) => {
    const currentIdentity = taskIdentity(task.description)
    const currentWords = new Set(currentIdentity.split(' ').filter((word) => word.length > 2))
    const match = oldTasks.find((oldTask) => {
      const oldWords = new Set(taskIdentity(oldTask.description).split(' ').filter((word) => word.length > 2))
      const shared = [...currentWords].filter((word) => oldWords.has(word)).length
      return currentIdentity === taskIdentity(oldTask.description) || (
        currentWords.size > 1 && oldWords.size > 1 && shared / Math.min(currentWords.size, oldWords.size) >= 0.75
      )
    })
    const preserved = match
      ? {
          ...(match._id ? { _id: match._id } : {}),
          ...(TASK_STATUSES.has(match.status) && match.status !== 'pending' ? { status: match.status } : {}),
        }
      : {}
    return { ...task, ...preserved }
  })
}

async function persistAnalysisStage(processingQuery, stage, value, error = null) {
  const currentResult = Meeting.findById(processingQuery._id)
  const currentDocument = await currentResult
  const current = currentDocument && typeof currentDocument.lean === 'function'
    ? await currentDocument.lean()
    : currentDocument
  if (!current) return
  const update = analysisStageUpdater(processingQuery, stage, value, error)
  // A successful re-analysis is authoritative for its stage. Merging here
  // leaves deleted, completed, or renamed candidates from older model runs.
  if (stage === 'tasks' && Array.isArray(value?.tasks)) update.tasks = reconcileTaskRecords(current.tasks, value.tasks)
  if (stage === 'decisions' && Array.isArray(value?.decisions)) update.decisions = value.decisions
  if (stage === 'unresolvedQuestions' && Array.isArray(value?.unresolvedQuestions)) update.unresolvedQuestions = value.unresolvedQuestions
  await Meeting.findOneAndUpdate(
    {
      ...processingQuery,
      processingStatus: 'analyzing',
      ...(ANALYSIS_PROGRESS[stage]
        ? {
            $or: [
              { processingProgress: { $lte: ANALYSIS_PROGRESS[stage][0] } },
              { processingProgress: null },
            ],
          }
        : {}),
    },
    { $set: update },
    { runValidators: true },
  )
}

async function processMeetingTranscript(meetingId, suppliedTranscript) {
  const meeting = await Meeting.findById(meetingId)
  if (!meeting) {
    const error = new Error('Meeting not found.')
    error.code = 'MEETING_NOT_FOUND'
    throw error
  }
  const transcript = suppliedTranscript === undefined ? meeting.transcript : suppliedTranscript
  if (typeof transcript !== 'string' || !transcript.trim()) {
    const error = new Error('A transcript is required. Complete transcription before starting AI analysis.')
    error.code = 'TRANSCRIPT_REQUIRED'
    throw error
  }
  if (['transcribing', 'transcription_completed', 'analyzing'].includes(meeting.processingStatus)) {
    const error = new Error('This meeting is already being processed.')
    error.code = 'DUPLICATE_PROCESSING'
    throw error
  }

  const processingStartedAt = new Date()
  const transcriptText = transcript.trim()
  const originalTranscript = meeting.transcript ?? null
  const transcriptChanged = transcriptText !== (meeting.transcript || '').trim()
  const processingQuery = {
    _id: meetingId,
    transcript: originalTranscript,
    processingStartedAt,
  }
  const initialFields = {
    processingStatus: 'analyzing',
    processingError: null,
    processingStartedAt,
    processingCompletedAt: null,
    processingProgress: 50,
    processingStage: 'AI analysis starting',
    processingLastCompletedStage: 'Transcription completed',
    processingProgressUpdatedAt: processingStartedAt,
    analysisStages: pendingAnalysisStages(),
  }
  const analyzing = await Meeting.findOneAndUpdate(
    {
      _id: meetingId,
      transcript: originalTranscript,
      processingStatus: { $nin: ['transcribing', 'transcription_completed', 'analyzing'] },
    },
    {
      $set: initialFields,
    },
    { returnDocument: 'after' },
  )
  if (!analyzing) {
    const error = new Error('This meeting is already being processed or its transcript changed. Refresh and retry.')
    error.code = 'DUPLICATE_PROCESSING'
    throw error
  }

  const diagnostics = []
  try {
    const analysis = await analyzeMeetingTranscript(
      transcriptText,
      transcriptChanged ? [] : meeting.transcriptSegments || [],
      {
        diagnostics,
        onStage: (stage, value) => persistAnalysisStage(processingQuery, stage, value),
      },
    )
    await updateProcessingProgress(processingQuery, 95, 'Saving results to MongoDB', 'Unresolved questions extracted')
    let savedMeeting
    try {
      const latestDocument = await Meeting.findById(meetingId)
      const latestMeeting = latestDocument && typeof latestDocument.lean === 'function'
        ? await latestDocument.lean()
        : latestDocument
      savedMeeting = await Meeting.findOneAndUpdate(
        {
          ...processingQuery,
          processingStatus: 'analyzing',
        },
        {
          $set: {
            transcript: transcriptText,
            ...(transcriptChanged ? { transcriptSegments: [] } : {}),
            ...analysis,
            tasks: reconcileTaskRecords(latestMeeting?.tasks, analysis.tasks),
            decisions: analysis.decisions,
            unresolvedQuestions: analysis.unresolvedQuestions,
            analysisDiagnostics: sanitizeAnalysisDiagnostics(diagnostics),
            analysisStages: Object.fromEntries(ANALYSIS_STAGE_NAMES.map((stage) => [stage, {
              status: Array.isArray(analysis[stage]) && analysis[stage].length === 0 ? 'empty' : 'completed',
              error: null,
              completedAt: new Date(),
            }])),
            processingStatus: 'completed',
            processingProgress: 100,
            processingStage: 'Processing completed',
            processingLastCompletedStage: 'Processing completed',
            processingProgressUpdatedAt: new Date(),
            processingError: null,
            processingCompletedAt: new Date(),
          },
        },
        { returnDocument: 'after', runValidators: true },
      )
    } catch (saveError) {
      logProcessingError(meetingId, 'analysis_results_save', saveError)
      const error = new Error('Meeting analysis could not be saved. Retry processing.')
      error.code = 'DATABASE_SAVE_FAILED'
      error.cause = saveError
      throw error
    }
    if (!savedMeeting) {
      const error = new Error('Meeting changed before analysis could be saved.')
      error.code = 'DATABASE_SAVE_FAILED'
      throw error
    }
    return savedMeeting
  } catch (error) {
    logProcessingError(meetingId, 'transcript_processing', error)
    const code = error.code === 'DATABASE_SAVE_FAILED'
      ? 'DATABASE_SAVE_FAILED'
      : error.code === 'MODEL_NOT_INSTALLED'
      || error.code === 'OLLAMA_UNAVAILABLE'
      || error.code === 'OLLAMA_TIMEOUT'
      || error.code === 'TRANSCRIPT_TOO_LONG'
      || error.code === 'INVALID_MODEL_RESPONSE'
      ? error.code
      : 'ANALYSIS_FAILED'
    const processingError = code === 'ANALYSIS_FAILED'
      ? 'Meeting analysis could not be saved. Retry processing.'
      : getAnalysisErrorMessage(error)

    try {
      const failureResult = Meeting.findById(processingQuery._id)
      const failureDocument = await failureResult
      const currentAfterFailure = failureDocument && typeof failureDocument.lean === 'function'
        ? await failureDocument.lean()
        : failureDocument
      await Meeting.findOneAndUpdate(
        {
          ...processingQuery,
          processingStatus: 'analyzing',
        },
        {
          $set: {
            processingStatus: 'failed',
            processingError,
            processingCompletedAt: new Date(),
            processingStage: 'Processing failed',
             analysisDiagnostics: sanitizeAnalysisDiagnostics(diagnostics),
            ...failedAnalysisStageUpdates(currentAfterFailure, processingError),
          },
        },
      )
    } catch (saveError) {
      logProcessingError(meetingId, 'analysis_failure_status_save', saveError)
      const wrappedError = new Error('Meeting analysis could not be saved. Retry processing.', { cause: saveError })
      wrappedError.code = 'DATABASE_SAVE_FAILED'
      throw wrappedError
    }

    error.code = code
    error.publicMessage = processingError
    throw error
  }
}

async function clearLegacyOpenAIProcessingErrors() {
  return Meeting.updateMany(
    { processingError: /OpenAI returned (?:insufficient_quota|rate_limit_exceeded)|OpenAI rejected the configured API key/i },
    {
      $set: {
        processingStatus: 'uploaded',
        processingError: null,
        processingStartedAt: null,
        processingCompletedAt: null,
        processingAudioUrl: null,
        processingTranscript: null,
        processingTranscriptSegments: [],
      },
    },
  )
}

function getAudioFilePath(audioUrl) {
  if (typeof audioUrl !== 'string' || !audioUrl.startsWith('/uploads/meetings/')) {
    throw new Error('The meeting audio path is invalid. Upload the recording again.')
  }
  return path.join(uploadDirectory, path.basename(audioUrl))
}

async function processMeetingAudio(meetingId) {
  const meeting = await Meeting.findById(meetingId)
  if (!meeting) {
    const error = new Error('Meeting not found.')
    error.code = 'MEETING_NOT_FOUND'
    throw error
  }
  const audioUrl = meeting.processingAudioUrl || meeting.audioUrl
  if (!audioUrl) {
    const error = new Error('Upload an audio recording before starting processing.')
    error.code = 'AUDIO_REQUIRED'
    throw error
  }
  if (['transcribing', 'transcription_completed', 'analyzing'].includes(meeting.processingStatus)) {
    const error = new Error('This meeting is already being processed.')
    error.code = 'DUPLICATE_PROCESSING'
    throw error
  }

  const committedAudioUrl = meeting.audioUrl ?? null
  const hasSavedTranscript = typeof meeting.processingTranscript === 'string'
    && Boolean(meeting.processingTranscript.trim())
  const processingStartedAt = new Date()
  const processingQuery = {
    _id: meetingId,
    audioUrl: committedAudioUrl,
    processingAudioUrl: audioUrl,
    processingStartedAt,
  }
  const audioPointerQuery = meeting.processingAudioUrl
    ? { processingAudioUrl: audioUrl }
    : { audioUrl }
  const claimed = await Meeting.findOneAndUpdate(
    {
      _id: meetingId,
      ...audioPointerQuery,
      processingStatus: { $nin: ['transcribing', 'transcription_completed', 'analyzing'] },
    },
    {
      $set: {
        processingStatus: hasSavedTranscript ? 'transcription_completed' : 'transcribing',
        processingError: null,
        processingStartedAt,
        processingCompletedAt: null,
        processingProgress: hasSavedTranscript ? 50 : 15,
        processingStage: hasSavedTranscript ? 'Transcription completed' : 'Transcription in progress',
        processingLastCompletedStage: hasSavedTranscript ? 'Transcription completed' : 'Audio uploaded',
        processingProgressUpdatedAt: processingStartedAt,
        processingAudioUrl: audioUrl,
        analysisStages: pendingAnalysisStages(),
      },
    },
    { returnDocument: 'after' },
  )
  if (!claimed) {
    const error = new Error('This meeting is already being processed. Refresh and retry.')
    error.code = 'DUPLICATE_PROCESSING'
    throw error
  }

  const diagnostics = []
  try {
    let transcript = meeting.processingTranscript
    let transcriptSegments = meeting.processingTranscriptSegments || []
    if (!hasSavedTranscript) {
      const filePath = getAudioFilePath(audioUrl)
      const transcription = await localTranscriptionService.transcribeAudio(filePath)
      transcript = transcription.transcript
      transcriptSegments = transcription.segments
      let transcriptSaved
      try {
        transcriptSaved = await Meeting.findOneAndUpdate(
          { ...processingQuery, processingStatus: 'transcribing' },
          {
            $set: {
              processingTranscript: transcript,
              processingTranscriptSegments: transcriptSegments,
              processingStatus: 'transcription_completed',
              processingProgress: 50,
              processingStage: 'Transcription completed',
              processingLastCompletedStage: 'Transcription completed',
              processingProgressUpdatedAt: new Date(),
            },
          },
          { returnDocument: 'after', runValidators: true },
        )
      } catch (saveError) {
        logProcessingError(meetingId, 'transcript_save', saveError)
        const wrappedError = new Error('Meeting transcript could not be saved.', { cause: saveError })
        wrappedError.code = 'DATABASE_SAVE_FAILED'
        throw wrappedError
      }
      if (!transcriptSaved) {
        const error = new Error('Meeting changed before its transcript could be saved.')
        error.code = 'PROCESSING_CONFLICT'
        throw error
      }
    }

    let analyzing
    try {
      analyzing = await Meeting.findOneAndUpdate(
        { ...processingQuery, processingStatus: 'transcription_completed' },
        {
          $set: {
            processingStatus: 'analyzing',
            processingProgress: 50,
            processingStage: 'AI analysis starting',
            processingLastCompletedStage: 'Transcription completed',
            processingProgressUpdatedAt: new Date(),
          },
        },
        { returnDocument: 'after' },
      )
    } catch (saveError) {
      logProcessingError(meetingId, 'analysis_transition_save', saveError)
      const wrappedError = new Error('Meeting transcript could not be saved.', { cause: saveError })
      wrappedError.code = 'DATABASE_SAVE_FAILED'
      throw wrappedError
    }
    if (!analyzing) {
      const error = new Error('Meeting changed before its transcript could be saved.')
      error.code = 'PROCESSING_CONFLICT'
      throw error
    }

    const analysis = await analyzeMeetingTranscript(transcript, transcriptSegments, {
      diagnostics,
      onStage: (stage, value) => persistAnalysisStage(processingQuery, stage, value),
    })
    await updateProcessingProgress(processingQuery, 95, 'Saving results to MongoDB', 'Unresolved questions extracted')
    let savedMeeting
    try {
      const latestDocument = await Meeting.findById(meetingId)
      const latestMeeting = latestDocument && typeof latestDocument.lean === 'function'
        ? await latestDocument.lean()
        : latestDocument
      savedMeeting = await Meeting.findOneAndUpdate(
        { ...processingQuery, processingStatus: 'analyzing' },
        {
          $set: {
            ...analysis,
            tasks: reconcileTaskRecords(latestMeeting?.tasks, analysis.tasks),
            decisions: analysis.decisions,
            unresolvedQuestions: analysis.unresolvedQuestions,
            analysisDiagnostics: sanitizeAnalysisDiagnostics(diagnostics),
            analysisStages: Object.fromEntries(ANALYSIS_STAGE_NAMES.map((stage) => [stage, {
              status: Array.isArray(analysis[stage]) && analysis[stage].length === 0 ? 'empty' : 'completed',
              error: null,
              completedAt: new Date(),
            }])),
            transcript,
            transcriptSegments,
            audioUrl,
            processingStatus: 'completed',
            processingProgress: 100,
            processingStage: 'Processing completed',
            processingLastCompletedStage: 'Processing completed',
            processingProgressUpdatedAt: new Date(),
            processingError: null,
            processingCompletedAt: new Date(),
          },
          $unset: {
            processingAudioUrl: 1,
            processingTranscript: 1,
            processingTranscriptSegments: 1,
          },
        },
        { returnDocument: 'after', runValidators: true },
      )
    } catch (saveError) {
      logProcessingError(meetingId, 'audio_analysis_results_save', saveError)
      const wrappedError = new Error('Meeting analysis could not be saved.', { cause: saveError })
      wrappedError.code = 'DATABASE_SAVE_FAILED'
      throw wrappedError
    }
    if (!savedMeeting) {
      const error = new Error('Meeting changed before its analysis could be saved.')
      error.code = 'PROCESSING_CONFLICT'
      throw error
    }
    return savedMeeting
  } catch (error) {
    logProcessingError(meetingId, 'audio_processing', error)
    console.error('Meeting audio processing failed:', error.code || error.name || 'Error')
    const knownCodes = new Set([
      'AUDIO_ACCESS_FAILED',
      'AUDIO_NOT_FOUND',
      'DATABASE_SAVE_FAILED',
      'EMPTY_TRANSCRIPT',
      'INVALID_MODEL_RESPONSE',
      'INVALID_TRANSCRIPTION_RESPONSE',
      'MODEL_NOT_INSTALLED',
      'OLLAMA_TIMEOUT',
      'OLLAMA_UNAVAILABLE',
      'PROCESSING_CONFLICT',
      'TRANSCRIBER_NOT_CONFIGURED',
      'TRANSCRIPTION_FAILED',
      'TRANSCRIPTION_TIMEOUT',
      'UNSUPPORTED_AUDIO_FORMAT',
    ])
    const code = knownCodes.has(error.code) ? error.code : 'PROCESSING_FAILED'
    const message = getAudioProcessingErrorMessage(error, code)
    let failedMeeting
    try {
      const currentDocument = await Meeting.findById(processingQuery._id)
      const current = currentDocument && typeof currentDocument.lean === 'function'
        ? await currentDocument.lean()
        : currentDocument
      failedMeeting = await Meeting.findOneAndUpdate(
        { ...processingQuery, processingStatus: { $in: ['transcribing', 'transcription_completed', 'analyzing'] } },
        {
          $set: {
            processingStatus: 'failed',
            processingError: message,
            processingCompletedAt: new Date(),
            processingStage: 'Processing failed',
            analysisDiagnostics: sanitizeAnalysisDiagnostics(diagnostics),
            ...failedAnalysisStageUpdates(current, message),
          },
        },
        { returnDocument: 'after' },
      )
    } catch (saveError) {
      logProcessingError(meetingId, 'audio_failure_status_save', saveError)
      const wrappedError = new Error('Meeting processing status could not be saved.', { cause: saveError })
      wrappedError.code = 'DATABASE_SAVE_FAILED'
      wrappedError.publicMessage = 'Meeting processing status could not be saved. Retry processing.'
      throw wrappedError
    }
    if (!failedMeeting && code !== 'PROCESSING_CONFLICT') {
      const saveError = new Error('Meeting processing status could not be saved.')
      saveError.code = 'DATABASE_SAVE_FAILED'
      saveError.publicMessage = 'Meeting processing status could not be saved. Retry processing.'
      throw saveError
    }
    error.code = code
    error.publicMessage = message
    throw error
  }
}

function getAudioProcessingErrorMessage(error, code) {
  switch (code) {
    case 'AUDIO_ACCESS_FAILED':
      return 'Unable to access the audio recording.'
    case 'AUDIO_NOT_FOUND':
      return 'The audio recording was not found. Upload it again.'
    case 'DATABASE_SAVE_FAILED':
      return 'Meeting processing results could not be saved. Retry processing.'
    case 'EMPTY_TRANSCRIPT':
      return 'No speech was detected in the audio recording.'
    case 'INVALID_MODEL_RESPONSE':
    case 'INVALID_TRANSCRIPTION_RESPONSE':
      return error.message
    case 'MODEL_NOT_INSTALLED':
    case 'OLLAMA_TIMEOUT':
    case 'OLLAMA_UNAVAILABLE':
      return getAnalysisErrorMessage(error)
    case 'PROCESSING_CONFLICT':
      return 'Meeting changed while processing. Refresh and retry.'
    case 'TRANSCRIBER_NOT_CONFIGURED':
      return 'The Faster-Whisper Python environment is unavailable. Set it up and retry.'
    case 'TRANSCRIPTION_FAILED':
      return 'Local audio transcription failed. Verify the Faster-Whisper model is available and retry.'
    case 'TRANSCRIPTION_TIMEOUT':
      return 'Local audio transcription timed out. Retry processing.'
    case 'UNSUPPORTED_AUDIO_FORMAT':
      return 'Only MP3 and WAV recordings are supported.'
    default:
      return 'Meeting audio processing failed. Retry processing.'
  }
}

async function markInterruptedProcessingAsFailed() {
  const result = await Meeting.updateMany(
    { processingStatus: { $in: ['transcribing', 'transcription_completed', 'analyzing'] } },
    {
      $set: {
        processingStatus: 'failed',
        processingError: 'The backend restarted during processing. Retry this meeting.',
        processingCompletedAt: new Date(),
        processingStage: 'Processing failed',
      },
    },
  )
  if (result.modifiedCount > 0) {
    console.warn(`Marked ${result.modifiedCount} interrupted meeting processing job(s) as failed.`)
  }
}

module.exports = {
  analyzeTranscript: analyzeMeetingTranscript,
  clearLegacyOpenAIProcessingErrors,
  markInterruptedProcessingAsFailed,
  processMeetingAudio,
  processMeetingTranscript,
  transcribeAudio: localTranscriptionService.transcribeAudio,
}
