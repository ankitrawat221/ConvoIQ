const fs = require('node:fs/promises')
const path = require('node:path')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')

const execFileAsync = promisify(execFile)
const transcriptionDirectory = path.resolve(__dirname, '..', 'transcription-service')
const scriptPath = path.join(transcriptionDirectory, 'transcribe.py')
const maxBuffer = 50 * 1024 * 1024

function getPythonExecutable() {
  if (process.env.FASTER_WHISPER_PYTHON) return process.env.FASTER_WHISPER_PYTHON
  return process.platform === 'win32'
    ? path.join(transcriptionDirectory, '.venv', 'Scripts', 'python.exe')
    : path.join(transcriptionDirectory, '.venv', 'bin', 'python')
}

function transcriptionError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function getCliError(error) {
  const details = String(error.stderr || '')
  if (/No speech was detected/i.test(details)) {
    return transcriptionError('EMPTY_TRANSCRIPT', 'No speech was detected in this recording.')
  }
  if (/audio recording was not found/i.test(details)) {
    return transcriptionError('AUDIO_NOT_FOUND', 'The audio recording was not found. Upload it again.')
  }
  if (error.killed) {
    return transcriptionError('TRANSCRIPTION_TIMEOUT', 'Local audio transcription timed out. Retry processing.')
  }
  if (error.code === 'ENOENT') {
    return transcriptionError(
      'TRANSCRIBER_NOT_CONFIGURED',
      'The Faster-Whisper Python environment is unavailable. Set it up or configure FASTER_WHISPER_PYTHON.',
    )
  }
  return transcriptionError(
    'TRANSCRIPTION_FAILED',
    'Local audio transcription failed. Verify the Faster-Whisper model is available and retry.',
  )
}

async function transcribeAudio(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw transcriptionError('AUDIO_NOT_FOUND', 'The audio recording was not found. Upload it again.')
  }
  const extension = path.extname(filePath).toLowerCase()
  if (!['.mp3', '.wav'].includes(extension)) {
    throw transcriptionError('UNSUPPORTED_AUDIO_FORMAT', 'Only MP3 and WAV recordings are supported.')
  }

  try {
    await fs.access(filePath)
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw transcriptionError('AUDIO_NOT_FOUND', 'The audio recording was not found. Upload it again.')
    }
    throw transcriptionError('AUDIO_ACCESS_FAILED', 'Unable to access the audio recording.')
  }

  let stdout
  try {
    ({ stdout } = await execFileAsync(
      getPythonExecutable(),
      [scriptPath, filePath],
      { encoding: 'utf8', maxBuffer, timeout: 30 * 60 * 1000, windowsHide: true },
    ))
  } catch (error) {
    throw getCliError(error)
  }

  let result
  try {
    result = JSON.parse(stdout)
  } catch {
    throw transcriptionError('INVALID_TRANSCRIPTION_RESPONSE', 'Local transcription returned an invalid response. Retry processing.')
  }

  const validSegments = Boolean(
    result &&
    typeof result === 'object' &&
    !Array.isArray(result) &&
    Array.isArray(result.segments) &&
    result.segments.every((segment) => (
      segment &&
      typeof segment.text === 'string' &&
      segment.text.trim() &&
      Number.isFinite(segment.start) &&
      Number.isFinite(segment.end)
    )),
  )
  if (
    !result ||
    typeof result !== 'object' ||
    Array.isArray(result) ||
    typeof result.transcript !== 'string' ||
    !result.transcript.trim() ||
    !validSegments ||
    result.speaker_identification_available !== false
  ) {
    throw transcriptionError('INVALID_TRANSCRIPTION_RESPONSE', 'Local transcription returned an invalid response. Retry processing.')
  }

  return {
    transcript: result.transcript.trim(),
    segments: result.segments,
    language: result.language,
    duration: result.duration,
    speakerIdentificationAvailable: false,
  }
}

module.exports = { transcribeAudio }
