const assert = require('node:assert/strict')
const { after, test } = require('node:test')

const originalFetch = global.fetch

after(() => {
  global.fetch = originalFetch
})

test('sends prompts to the configured local Ollama model', async () => {
  const { generateResponse } = require('../services/ollamaService')
  let request
  global.fetch = async (url, options) => {
    request = { url, options }
    return new Response(JSON.stringify({ response: 'Meeting summary.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const result = await generateResponse('  Summarize the meeting.  ')

  assert.equal(request.url, 'http://127.0.0.1:11434/api/generate')
  assert.equal(request.options.method, 'POST')
  assert.equal(request.options.headers['Content-Type'], 'application/json')
  assert.deepEqual(JSON.parse(request.options.body), {
    model: 'qwen2.5:3b',
    prompt: 'Summarize the meeting.',
    stream: false,
  })
  assert.equal(result.model, 'qwen2.5:3b')
  assert.equal(result.response, 'Meeting summary.')
})

test('rejects invalid prompts and does not send them to Ollama', async () => {
  const { generateResponse, MAX_PROMPT_LENGTH } = require('../services/ollamaService')
  let requestCount = 0
  global.fetch = async () => {
    requestCount += 1
    throw new Error('Unexpected Ollama request')
  }

  await assert.rejects(generateResponse('  '), TypeError)
  await assert.rejects(generateResponse('x'.repeat(MAX_PROMPT_LENGTH + 1)), RangeError)
  assert.equal(requestCount, 0)
})

test('rejects unsuccessful or malformed Ollama responses', async () => {
  const { generateResponse } = require('../services/ollamaService')
  global.fetch = async () => new Response('provider detail', { status: 500 })
  await assert.rejects(generateResponse('Summarize this meeting.'), /status 500/)

  global.fetch = async () => new Response(JSON.stringify({ response: '' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
  await assert.rejects(generateResponse('Summarize this meeting.'), /invalid response/)
})
