const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { after, test } = require('node:test')

const temporaryFiles = []
const originalFetch = global.fetch
const originalApiKey = process.env.OPENAI_API_KEY

function createPcmWave({ seconds, sampleRate = 48000, channels = 2 }) {
  const frames = seconds * sampleRate
  const data = Buffer.alloc(frames * channels * 2)
  const wave = Buffer.alloc(44 + data.length)
  wave.write('RIFF', 0)
  wave.writeUInt32LE(wave.length - 8, 4)
  wave.write('WAVEfmt ', 8)
  wave.writeUInt32LE(16, 16)
  wave.writeUInt16LE(1, 20)
  wave.writeUInt16LE(channels, 22)
  wave.writeUInt32LE(sampleRate, 24)
  wave.writeUInt32LE(sampleRate * channels * 2, 28)
  wave.writeUInt16LE(channels * 2, 32)
  wave.writeUInt16LE(16, 34)
  wave.write('data', 36)
  wave.writeUInt32LE(data.length, 40)
  data.copy(wave, 44)
  return wave
}

async function writeTemporaryWave(buffer) {
  const filePath = path.join(os.tmpdir(), `convoiq-test-${Date.now()}-${Math.random()}.wav`)
  await fs.writeFile(filePath, buffer, { flag: 'wx' })
  temporaryFiles.push(filePath)
  return filePath
}

after(async () => {
  global.fetch = originalFetch
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY
  else process.env.OPENAI_API_KEY = originalApiKey
  await Promise.all(temporaryFiles.map((filePath) => fs.unlink(filePath).catch(() => {})))
})

test('downsamples oversized stereo PCM WAV to mono 16 kHz under the provider limit', async () => {
  const { prepareTranscriptionFile } = require('../services/meetingProcessingService')
  const sourcePath = await writeTemporaryWave(createPcmWave({ seconds: 140 }))
  const prepared = await prepareTranscriptionFile(sourcePath)

  try {
    const output = await fs.readFile(prepared.filePath)
    assert.equal(prepared.temporary, true)
    assert.equal(output.toString('ascii', 0, 4), 'RIFF')
    assert.equal(output.readUInt16LE(22), 1)
    assert.equal(output.readUInt32LE(24), 16000)
    assert.equal(output.readUInt16LE(34), 16)
    assert.ok(output.length < 24_000_000)
  } finally {
    await fs.unlink(prepared.filePath)
  }
})

test('transcribes with diarized JSON without manually setting multipart Content-Type', async () => {
  process.env.OPENAI_API_KEY = 'test-key'
  const { transcribeAudio } = require('../services/meetingProcessingService')
  const sourcePath = await writeTemporaryWave(createPcmWave({ seconds: 1, sampleRate: 16000, channels: 1 }))
  let request
  global.fetch = async (url, options) => {
    request = { url, options }
    return new Response(JSON.stringify({
      text: 'Hello. Yes.',
      segments: [
        { text: 'Hello.', start: 0, end: 0.4, speaker_id: 'speaker_0' },
        { text: 'Yes.', start: 0.5, end: 0.8, speaker_id: 'speaker_1' },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  const transcription = await transcribeAudio(sourcePath)
  assert.equal(request.url, 'https://api.openai.com/v1/audio/transcriptions')
  assert.equal(request.options.headers.Authorization, 'Bearer test-key')
  assert.equal(request.options.headers['Content-Type'], undefined)
  assert.ok(request.options.body instanceof FormData)
  assert.equal(request.options.body.get('model'), 'gpt-4o-transcribe-diarize')
  assert.equal(request.options.body.get('response_format'), 'diarized_json')
  assert.equal(request.options.body.get('chunking_strategy'), 'auto')
  assert.equal(transcription.transcript, 'Speaker 1: Hello.\nSpeaker 2: Yes.')
  assert.equal(transcription.segments[0].speakerLabel, 'Speaker 1')
  assert.equal(transcription.segments[1].speakerLabel, 'Speaker 2')
})

test('distinguishes quota exhaustion from a rate limit without exposing provider messages', async () => {
  process.env.OPENAI_API_KEY = 'test-key'
  const { transcribeAudio } = require('../services/meetingProcessingService')
  const sourcePath = await writeTemporaryWave(createPcmWave({ seconds: 1, sampleRate: 16000, channels: 1 }))
  const failures = [
    {
      error: { code: 'insufficient_quota', type: 'insufficient_quota', message: 'private provider detail' },
      expectedCode: 'insufficient_quota',
      expectedMessage: /no remaining credits or billing may not be active/,
    },
    {
      error: { code: 'rate_limit_exceeded', type: 'requests', message: 'private provider detail' },
      expectedCode: 'rate_limit_exceeded',
      expectedType: 'requests',
      expectedMessage: /request or token rate limit was reached/,
    },
    {
      error: { type: 'insufficient_quota', message: 'private provider detail' },
      expectedCode: null,
      expectedType: 'insufficient_quota',
      expectedMessage: /no remaining credits or billing may not be active/,
    },
  ]

  for (const failure of failures) {
    let requestCount = 0
    global.fetch = async () => {
      requestCount += 1
      return new Response(JSON.stringify({ error: failure.error }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    await assert.rejects(transcribeAudio(sourcePath), (error) => {
      assert.equal(error.status, 429)
      assert.equal(error.providerCode, failure.expectedCode)
      assert.equal(error.providerType, failure.expectedType || failure.expectedCode)
      assert.match(error.message, failure.expectedMessage)
      assert.doesNotMatch(error.message, /private provider detail|test-key/)
      return true
    })
    assert.equal(requestCount, 1)
  }
})

test('extracts structured meeting analysis using the backend API key', async () => {
  process.env.OPENAI_API_KEY = 'test-key'
  const { analyzeTranscript } = require('../services/meetingProcessingService')
  let request
  global.fetch = async (url, options) => {
    request = { url, options }
    return new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            summary: 'The team agreed to review the draft.',
            discussionPoints: ['Draft review'],
            customerInsights: { concerns: [], responses: [], outcomes: [] },
            tasks: [{ description: 'Review the draft', owner: null, deadline: null }],
            decisions: [{ description: 'Review the draft before sending.' }],
          }),
        },
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  const result = await analyzeTranscript('We will review the draft.')
  assert.equal(request.url, 'https://api.openai.com/v1/chat/completions')
  assert.equal(request.options.headers.Authorization, 'Bearer test-key')
  assert.equal(request.options.headers['Content-Type'], 'application/json')
  const requestBody = JSON.parse(request.options.body)
  assert.equal(requestBody.model, 'gpt-4o-mini')
  assert.equal(requestBody.response_format.type, 'json_object')
  assert.equal(result.tasks[0].owner, null)
  assert.equal(result.tasks[0].deadline, null)
  assert.equal(result.decisions[0].description, 'Review the draft before sending.')
})
