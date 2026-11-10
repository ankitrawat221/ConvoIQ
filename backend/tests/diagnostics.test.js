const assert = require('node:assert/strict')
const { test } = require('node:test')
const {
  MAX_DIAGNOSTIC_RESPONSE_LENGTH,
  boundDiagnosticRawResponse,
  sanitizeAnalysisDiagnostics,
} = require('../utils/diagnostics')

test('bounds oversized diagnostic responses and records their original length', () => {
  const response = 'A'.repeat(16_015)
  const bounded = boundDiagnosticRawResponse(response)

  assert.equal(MAX_DIAGNOSTIC_RESPONSE_LENGTH, 12_000)
  assert.equal(bounded.rawResponse.length, 12_000)
  assert.equal(bounded.rawResponseLength, 16_015)
  assert.equal(bounded.rawResponseTruncated, true)
  assert.equal(bounded.rawResponse, response.slice(0, 12_000))
})

test('sanitizes every diagnostic entry and preserves normal responses', () => {
  const diagnostics = sanitizeAnalysisDiagnostics([
    { stage: 'summary', rawResponse: 'normal response' },
    { stage: 'actions', rawResponse: 'B'.repeat(20_000) },
    { stage: 'validation', rawResponse: null },
    { stage: 'other', rawResponse: { value: true } },
  ])

  assert.equal(diagnostics.length, 4)
  assert.equal(diagnostics[0].rawResponse, 'normal response')
  assert.equal(diagnostics[0].rawResponseTruncated, false)
  assert.equal(diagnostics[1].rawResponse.length, 12_000)
  assert.equal(diagnostics[1].rawResponseTruncated, true)
  assert.equal(diagnostics[2].rawResponse, null)
  assert.equal(diagnostics[2].rawResponseTruncated, false)
  assert.equal(diagnostics[3].rawResponse, '{"value":true}')
  assert.ok(diagnostics.every((entry) => entry.rawResponse === null || entry.rawResponse.length <= 12_000))
})
