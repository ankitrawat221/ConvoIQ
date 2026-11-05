const OLLAMA_URL = 'http://127.0.0.1:11434/api/generate'
const OLLAMA_MODEL = 'qwen2.5:3b'
const MAX_PROMPT_LENGTH = 10_000
const REQUEST_TIMEOUT_MS = 120_000

async function generateResponse(prompt) {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw new TypeError('Prompt must be a non-empty string.')
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new RangeError(`Prompt must be ${MAX_PROMPT_LENGTH} characters or fewer.`)
  }

  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: prompt.trim(),
      stream: false,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`Ollama request failed with status ${response.status}.`)
  }

  const result = await response.json()
  if (typeof result.response !== 'string' || !result.response.trim()) {
    throw new Error('Ollama returned an invalid response.')
  }

  return {
    model: OLLAMA_MODEL,
    response: result.response.trim(),
  }
}

module.exports = { generateResponse, MAX_PROMPT_LENGTH }
