const MAX_DIAGNOSTIC_RESPONSE_LENGTH = 12_000

function diagnosticString(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  try {
    const serialized = JSON.stringify(value)
    return typeof serialized === 'string' ? serialized : String(value)
  } catch {
    return String(value)
  }
}

function boundDiagnosticRawResponse(value) {
  const text = diagnosticString(value)
  if (text === null) {
    return {
      rawResponse: null,
      rawResponseLength: null,
      rawResponseTruncated: false,
    }
  }

  return {
    rawResponse: text.slice(0, MAX_DIAGNOSTIC_RESPONSE_LENGTH),
    rawResponseLength: text.length,
    rawResponseTruncated: text.length > MAX_DIAGNOSTIC_RESPONSE_LENGTH,
  }
}

function sanitizeDiagnosticEntry(entry = {}) {
  return {
    ...entry,
    ...boundDiagnosticRawResponse(entry.rawResponse),
  }
}

function sanitizeAnalysisDiagnostics(entries, limit = 12) {
  return (Array.isArray(entries) ? entries : [])
    .slice(-limit)
    .map(sanitizeDiagnosticEntry)
}

module.exports = {
  MAX_DIAGNOSTIC_RESPONSE_LENGTH,
  boundDiagnosticRawResponse,
  sanitizeDiagnosticEntry,
  sanitizeAnalysisDiagnostics,
}
