const assert = require('node:assert/strict')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { after, test } = require('node:test')

const Meeting = require('../models/Meeting')
const localTranscriptionService = require('../services/localTranscriptionService')
const originalFetch = global.fetch
const originalApiKey = process.env.OPENAI_API_KEY
const originalFindById = Meeting.findById
const originalFindOneAndUpdate = Meeting.findOneAndUpdate
const originalTranscribeAudio = localTranscriptionService.transcribeAudio

after(() => {
  global.fetch = originalFetch
  Meeting.findById = originalFindById
  Meeting.findOneAndUpdate = originalFindOneAndUpdate
  localTranscriptionService.transcribeAudio = originalTranscribeAudio
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY
  else process.env.OPENAI_API_KEY = originalApiKey
})

test('rejects unsupported recording formats before starting local transcription', async () => {
  const { transcribeAudio } = require('../services/localTranscriptionService')
  await assert.rejects(transcribeAudio('recording.mp4'), (error) => (
    error.code === 'UNSUPPORTED_AUDIO_FORMAT' &&
    error.message === 'Only MP3 and WAV recordings are supported.'
  ))
})

test('reports missing recordings before starting local transcription', async () => {
  const { transcribeAudio } = require('../services/localTranscriptionService')
  const missingPath = path.join(require('node:os').tmpdir(), `${randomUUID()}.wav`)
  await assert.rejects(transcribeAudio(missingPath), (error) => (
    error.code === 'AUDIO_NOT_FOUND' &&
    error.message === 'The audio recording was not found. Upload it again.'
  ))
})

test('transcribes meeting audio, saves Ollama results, and returns the saved meeting', async () => {
  const { processMeetingAudio } = require('../services/meetingProcessingService')
  const meetingId = '507f1f77bcf86cd799439015'
  const audioUrl = '/uploads/meetings/test-meeting.wav'
  const transcript = 'Customer: The washer is under warranty. Customer: I choose Friday for the appointment. Agent: I will schedule a technician for Friday.'
  const meeting = { _id: meetingId, audioUrl, processingStatus: 'uploaded' }
  const analysis = {
    summary: 'The customer requested warranty service for a washing machine.',
    discussionPoints: [{
      text: 'A Friday appointment was chosen.',
      evidence: 'Customer: I choose Friday for the appointment.',
    }],
    customerInsights: {
      concerns: [{ text: 'The washer needs service.', evidence: 'Customer: The washer is under warranty.' }],
      responses: [{
        text: 'The agent will schedule a technician.',
        evidence: 'Agent: I will schedule a technician for Friday.',
        concernEvidence: 'Customer: The washer is under warranty.',
      }],
      outcomes: [],
    },
    tasks: [{
      description: 'Schedule a technician visit',
      owner: 'Agent',
      deadline: 'Friday',
      evidence: 'Agent: I will schedule a technician for Friday.',
    }],
    decisions: [{
      description: 'The customer chose the Friday appointment.',
      decisionMaker: 'customer',
      evidence: 'Customer: I choose Friday for the appointment.',
    }],
    unresolvedQuestions: [],
  }
  const updates = []
  let saved = { ...meeting }
  Meeting.findById = async (id) => {
    assert.equal(id, meetingId)
    return meeting
  }
  Meeting.findOneAndUpdate = async (query, update) => {
    updates.push({ query, update })
    saved = { ...saved, ...update.$set }
    return { ...saved }
  }
  localTranscriptionService.transcribeAudio = async (filePath) => {
    assert.ok(filePath.endsWith(path.join('test-meeting.wav')))
    return {
      transcript,
      segments: [{ text: transcript, start: 0, end: 4.5 }],
      speakerIdentificationAvailable: false,
    }
  }
  global.fetch = async (_url, options) => {
    assert.ok(JSON.parse(options.body).prompt.includes(transcript))
    return new Response(JSON.stringify({ response: JSON.stringify(analysis) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const result = await processMeetingAudio(meetingId)
    assert.deepEqual(updates.map(({ update }) => update.$set.processingStatus).filter(Boolean), [
      'transcribing',
      'transcription_completed',
      'analyzing',
      'completed',
    ])
    assert.equal(updates[0].query.audioUrl, audioUrl)
    assert.equal(updates[0].update.$set.processingAudioUrl, audioUrl)
    assert.equal(updates[1].update.$set.processingTranscript, transcript)
    assert.deepEqual(result.tasks, [{
      ...analysis.tasks[0],
      evidenceStart: 0,
      evidenceEnd: 4.5,
    }])
    assert.deepEqual(result.decisions, [{
      ...analysis.decisions[0],
      evidenceStart: 0,
      evidenceEnd: 4.5,
    }])
    assert.equal(result.processingStatus, 'completed')
  } finally {
    localTranscriptionService.transcribeAudio = originalTranscribeAudio
  }
})

test('rejects audio processing without audio and blocks duplicate requests', async () => {
  const { processMeetingAudio } = require('../services/meetingProcessingService')
  const meetingId = '507f1f77bcf86cd799439016'
  Meeting.findById = async () => ({ _id: meetingId, audioUrl: null, processingStatus: null })
  await assert.rejects(processMeetingAudio(meetingId), (error) => error.code === 'AUDIO_REQUIRED')

  Meeting.findById = async () => ({
    _id: meetingId,
    audioUrl: '/uploads/meetings/test-meeting.wav',
    processingStatus: 'transcribing',
  })
  await assert.rejects(processMeetingAudio(meetingId), (error) => error.code === 'DUPLICATE_PROCESSING')
})

test('keeps processing results isolated between two meetings', async () => {
  const { processMeetingAudio } = require('../services/meetingProcessingService')
  const firstId = '507f1f77bcf86cd799439017'
  const secondId = '507f1f77bcf86cd799439018'
  const meetings = new Map([
    [firstId, { _id: firstId, audioUrl: '/uploads/meetings/first.wav', processingStatus: 'uploaded' }],
    [secondId, { _id: secondId, audioUrl: '/uploads/meetings/second.wav', processingStatus: 'uploaded' }],
  ])
  const saved = new Map([[firstId, {}], [secondId, {}]])
  const updates = []
  Meeting.findById = async (id) => meetings.get(String(id))
  Meeting.findOneAndUpdate = async (query, update) => {
    const id = String(query._id)
    updates.push({ id, fields: update.$set })
    saved.set(id, { ...saved.get(id), ...update.$set })
    return { ...saved.get(id) }
  }
  localTranscriptionService.transcribeAudio = async (filePath) => {
    const isFirst = path.basename(filePath) === 'first.wav'
    const transcript = isFirst ? 'First meeting transcript.' : 'Second meeting transcript.'
    return { transcript, segments: [{ text: transcript, start: 0, end: 1 }] }
  }
  global.fetch = async (_url, options) => {
    const prompt = JSON.parse(options.body).prompt
    const first = prompt.includes('First meeting transcript.')
    return new Response(JSON.stringify({
      response: JSON.stringify({
        summary: first ? 'First meeting summary.' : 'Second meeting summary.',
        discussionPoints: [],
        customerInsights: { concerns: [], responses: [], outcomes: [] },
        tasks: [],
        decisions: [],
        unresolvedQuestions: [],
      }),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    await processMeetingAudio(firstId)
    await processMeetingAudio(secondId)

    assert.equal(saved.get(firstId).transcript, 'First meeting transcript.')
    assert.equal(saved.get(firstId).summary, 'First meeting summary.')
    assert.equal(saved.get(secondId).transcript, 'Second meeting transcript.')
    assert.equal(saved.get(secondId).summary, 'Second meeting summary.')
    assert.ok(updates.every(({ id }) => id === firstId || id === secondId))
    assert.deepEqual(
      updates.filter(({ id }) => id === firstId).map(({ fields }) => fields.processingStatus).filter(Boolean),
      ['transcribing', 'transcription_completed', 'analyzing', 'completed'],
    )
    assert.deepEqual(
      updates.filter(({ id }) => id === secondId).map(({ fields }) => fields.processingStatus).filter(Boolean),
      ['transcribing', 'transcription_completed', 'analyzing', 'completed'],
    )
  } finally {
    localTranscriptionService.transcribeAudio = originalTranscribeAudio
  }
})

test('preserves saved results during replacement processing and retries analysis without retranscribing', async () => {
  const { processMeetingAudio } = require('../services/meetingProcessingService')
  const meetingId = '507f1f77bcf86cd799439019'
  const transcript = 'Replacement recording transcript.'
  const original = {
    _id: meetingId,
    audioUrl: '/uploads/meetings/original.wav',
    processingAudioUrl: '/uploads/meetings/replacement.wav',
    processingStatus: 'uploaded',
    transcript: 'Previously saved transcript.',
    transcriptSegments: [{ text: 'Previously saved transcript.', start: 0, end: 1 }],
    summary: 'Previously saved summary.',
    tasks: [{ description: 'Previously saved task.' }],
    decisions: [{ description: 'Previously saved decision.' }],
    unresolvedQuestions: ['Previously saved question?'],
  }
  let saved = { ...original }
  let transcriptionCount = 0
  Meeting.findById = async () => ({ ...saved })
  Meeting.findOneAndUpdate = async (_query, update) => {
    if (update.$set) saved = { ...saved, ...update.$set }
    for (const field of Object.keys(update.$unset || {})) delete saved[field]
    return { ...saved }
  }
  localTranscriptionService.transcribeAudio = async () => {
    transcriptionCount += 1
    return { transcript, segments: [{ text: transcript, start: 0, end: 2 }] }
  }
  global.fetch = async () => { throw new TypeError('local Ollama is unavailable') }

  try {
    await assert.rejects(processMeetingAudio(meetingId), (error) => error.code === 'OLLAMA_UNAVAILABLE')
    assert.equal(saved.transcript, original.transcript)
    assert.equal(saved.summary, original.summary)
    assert.deepEqual(saved.tasks, original.tasks)
    assert.deepEqual(saved.decisions, original.decisions)
    assert.deepEqual(saved.unresolvedQuestions, original.unresolvedQuestions)
    assert.equal(saved.processingTranscript, transcript)
    assert.equal(saved.processingStatus, 'failed')
    assert.equal(transcriptionCount, 1)

    global.fetch = async () => new Response(JSON.stringify({
      response: JSON.stringify({
        summary: 'Replacement recording summary.',
        discussionPoints: [],
        customerInsights: { concerns: [], responses: [], outcomes: [] },
        tasks: [],
        decisions: [],
        unresolvedQuestions: [],
      }),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })

    const result = await processMeetingAudio(meetingId)
    assert.equal(transcriptionCount, 1)
    assert.equal(result.audioUrl, original.processingAudioUrl)
    assert.equal(result.transcript, transcript)
    assert.equal(result.summary, 'Replacement recording summary.')
    assert.equal(result.processingStatus, 'completed')
    assert.equal(saved.processingAudioUrl, undefined)
    assert.equal(saved.processingTranscript, undefined)
  } finally {
    localTranscriptionService.transcribeAudio = originalTranscribeAudio
  }
})

test('saves Ollama analysis for the requested meeting without an OpenAI API key', async () => {
  const { processMeetingTranscript } = require('../services/meetingProcessingService')
  const meetingId = '507f1f77bcf86cd799439011'
  const transcript = 'Customer: The washer is under warranty. Customer: I choose Friday for the appointment. Agent: I will schedule a technician for Friday.'
  const meeting = { _id: meetingId, transcript: '', processingStatus: 'uploaded' }
  const analysis = {
    summary: 'The customer requested warranty service for a washing machine.',
    discussionPoints: [{
      text: 'A Friday appointment was chosen.',
      evidence: 'Customer: I choose Friday for the appointment.',
    }],
    customerInsights: {
      concerns: [{ text: 'The washer needs service.', evidence: 'Customer: The washer is under warranty.' }],
      responses: [{
        text: 'The agent will schedule a technician.',
        evidence: 'Agent: I will schedule a technician for Friday.',
        concernEvidence: 'Customer: The washer is under warranty.',
      }],
      outcomes: [],
    },
    tasks: [{
      description: 'Schedule a technician visit',
      owner: 'Agent',
      deadline: 'Friday',
      evidence: 'Agent: I will schedule a technician for Friday.',
    }],
    decisions: [{
      description: 'The customer chose the Friday appointment.',
      decisionMaker: 'customer',
      evidence: 'Customer: I choose Friday for the appointment.',
    }],
    unresolvedQuestions: [],
  }
  Meeting.findById = async (id) => {
    assert.equal(id, meetingId)
    return meeting
  }
  const updates = []
  Meeting.findOneAndUpdate = async (query, update) => {
    updates.push({ query, update })
    return { ...meeting, ...update.$set }
  }
  const previousApiKey = process.env.OPENAI_API_KEY
  delete process.env.OPENAI_API_KEY
  let request
  global.fetch = async (url, options) => {
    request = { url, options }
    return new Response(JSON.stringify({ response: JSON.stringify(analysis) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const result = await processMeetingTranscript(meetingId, transcript)
    assert.equal(request.url, 'http://127.0.0.1:11434/api/generate')
    assert.ok(JSON.parse(request.options.body).prompt.includes(transcript))
    assert.equal(updates.filter(({ update }) => update.$set.processingStatus).length, 2)
    assert.equal(updates[0].query._id, meetingId)
    assert.equal(updates[0].update.$set.transcript, undefined)
    assert.ok(updates.find(({ update }) => update.$set.transcript === transcript))
    assert.deepEqual(result.tasks, analysis.tasks)
    assert.deepEqual(result.decisions, analysis.decisions)
    assert.deepEqual(result.unresolvedQuestions, [])
    assert.equal(result.processingStatus, 'completed')
  } finally {
    if (previousApiKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previousApiKey
  }
})

test('clears only persisted legacy OpenAI processing errors', async () => {
  const { clearLegacyOpenAIProcessingErrors } = require('../services/meetingProcessingService')
  const originalUpdateMany = Meeting.updateMany
  let request
  Meeting.updateMany = async (...args) => {
    request = args
    return { modifiedCount: 1 }
  }

  try {
    const result = await clearLegacyOpenAIProcessingErrors()
    assert.equal(result.modifiedCount, 1)
    assert.match(String(request[0].processingError), /OpenAI returned/)
    assert.equal(request[1].$set.processingError, null)
    assert.equal(request[1].$set.processingStatus, 'uploaded')
    assert.equal(request[1].$set.processingAudioUrl, null)
  } finally {
    Meeting.updateMany = originalUpdateMany
  }
})

test('requires a transcript and rejects duplicate processing before contacting Ollama', async () => {
  const { processMeetingTranscript } = require('../services/meetingProcessingService')
  const meetingId = '507f1f77bcf86cd799439012'
  let updateCount = 0
  let requestCount = 0
  Meeting.findById = async () => ({ _id: meetingId, transcript: '  ', processingStatus: null })
  Meeting.findOneAndUpdate = async () => {
    updateCount += 1
    return null
  }
  global.fetch = async () => {
    requestCount += 1
    throw new Error('Unexpected Ollama request')
  }
  await assert.rejects(processMeetingTranscript(meetingId), (error) => error.code === 'TRANSCRIPT_REQUIRED')
  assert.equal(updateCount, 0)
  assert.equal(requestCount, 0)

  Meeting.findById = async () => ({ _id: meetingId, transcript: 'Transcript text.', processingStatus: 'analyzing' })
  await assert.rejects(processMeetingTranscript(meetingId), (error) => error.code === 'DUPLICATE_PROCESSING')
  assert.equal(updateCount, 0)
  assert.equal(requestCount, 0)
})

test('records a safe failed processing state when Ollama is unavailable', async () => {
  const { processMeetingTranscript } = require('../services/meetingProcessingService')
  const meetingId = '507f1f77bcf86cd799439013'
  const meeting = { _id: meetingId, transcript: 'A real transcript.', processingStatus: null }
  const updates = []
  Meeting.findById = async () => meeting
  Meeting.findOneAndUpdate = async (_query, update) => {
    updates.push(update.$set)
    return { ...meeting, ...update.$set }
  }
  global.fetch = async () => { throw new TypeError('sensitive connection detail') }

  await assert.rejects(processMeetingTranscript(meetingId), (error) => (
    error.code === 'OLLAMA_UNAVAILABLE' &&
    error.publicMessage === 'The local Ollama service is unavailable. Start Ollama and retry.' &&
    !error.message.includes('sensitive connection detail')
  ))
  assert.equal(updates[0].processingStatus, 'analyzing')
  assert.equal(updates[1].processingStatus, 'failed')
  assert.equal(updates[1].processingError, 'The local Ollama service is unavailable. Start Ollama and retry.')
})

test('keeps the previous transcript and analysis when replacement transcript analysis fails', async () => {
  const { processMeetingTranscript } = require('../services/meetingProcessingService')
  const meetingId = '507f1f77bcf86cd799439020'
  const original = {
    _id: meetingId,
    transcript: 'Previously saved transcript.',
    summary: 'Previously saved summary.',
    tasks: [{ description: 'Previously saved task.' }],
    processingStatus: 'completed',
  }
  let saved = { ...original }
  const updates = []
  Meeting.findById = async () => ({ ...saved })
  Meeting.findOneAndUpdate = async (_query, update) => {
    updates.push(update.$set)
    saved = { ...saved, ...update.$set }
    return { ...saved }
  }
  global.fetch = async () => { throw new TypeError('local Ollama is unavailable') }

  await assert.rejects(
    processMeetingTranscript(meetingId, 'Replacement transcript.'),
    (error) => error.code === 'OLLAMA_UNAVAILABLE',
  )
  assert.equal(updates[0].transcript, undefined)
  assert.equal(saved.transcript, original.transcript)
  assert.equal(saved.summary, original.summary)
  assert.deepEqual(saved.tasks, original.tasks)
  assert.equal(saved.processingStatus, 'failed')
})

test('reports MongoDB analysis-save failures without exposing internal details', async () => {
  const { processMeetingTranscript } = require('../services/meetingProcessingService')
  const meetingId = '507f1f77bcf86cd799439014'
  const meeting = { _id: meetingId, transcript: 'A real transcript.', processingStatus: null }
  const statuses = []
  Meeting.findById = async () => meeting
  Meeting.findOneAndUpdate = async (_query, update) => {
    const status = update.$set.processingStatus
    statuses.push(status)
    if (status === 'completed') throw new Error('private database detail')
    return { ...meeting, ...update.$set }
  }
  global.fetch = async () => new Response(JSON.stringify({
    response: JSON.stringify({
      summary: 'A summary.',
      discussionPoints: [],
      customerInsights: { concerns: [], responses: [], outcomes: [] },
      tasks: [],
      decisions: [],
      unresolvedQuestions: [],
    }),
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })

  await assert.rejects(processMeetingTranscript(meetingId), (error) => (
    error.code === 'DATABASE_SAVE_FAILED' &&
    error.message === 'Meeting analysis could not be saved. Retry processing.' &&
    !error.message.includes('private database detail')
  ))
  assert.deepEqual(statuses.filter(Boolean), ['analyzing', 'completed', 'failed'])
})
