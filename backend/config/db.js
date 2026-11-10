const mongoose = require('mongoose')

function getMongoErrorCategory(error) {
  const pending = [error]
  const seen = new Set()
  const messages = []
  const codes = new Set()
  const names = new Set()

  while (pending.length > 0) {
    const current = pending.pop()
    if (!current || typeof current !== 'object' || seen.has(current)) {
      continue
    }

    seen.add(current)

    if (current.code !== undefined) codes.add(String(current.code).toUpperCase())
    if (current.codeName) names.add(String(current.codeName).toLowerCase())
    if (current.name) names.add(String(current.name).toLowerCase())
    if (current.message) messages.push(String(current.message).toLowerCase())

    pending.push(current.cause, current.reason)

    if (current.errors instanceof Map) {
      pending.push(...current.errors.values())
    } else if (current.errors && typeof current.errors === 'object') {
      pending.push(...Object.values(current.errors))
    }

    const servers = current.servers
    if (servers instanceof Map) {
      for (const server of servers.values()) {
        pending.push(server?.error)
      }
    }
  }

  const combinedMessages = messages.join(' ')

  if (
    codes.has('18') ||
    names.has('authenticationfailed') ||
    /authentication failed|auth failed|bad auth/.test(combinedMessages)
  ) {
    return 'authentication failure'
  }

  if (
    codes.has('ENOTFOUND') ||
    codes.has('EAI_AGAIN') ||
    /getaddrinfo|querysrv.*(?:enotfound|eai_again)/.test(combinedMessages)
  ) {
    return 'DNS failure'
  }

  if (
    codes.has('ERR_INVALID_URL') ||
    names.has('mongoparseerror') ||
    names.has('urierror') ||
    /invalid (?:connection )?uri|invalid url|invalid scheme|must be a string/.test(combinedMessages)
  ) {
    return 'invalid URI'
  }

  if (
    codes.has('ETIMEDOUT') ||
    names.has('mongonetworktimeouterror') ||
    /server selection timed out|connection timed out|operation timed out/.test(combinedMessages)
  ) {
    return 'network timeout'
  }

  if (
    ['ECONNREFUSED', 'ECONNRESET', 'ENETUNREACH', 'EHOSTUNREACH'].some((code) => codes.has(code)) ||
    names.has('mongonetworkerror')
  ) {
    return 'network failure'
  }

  return 'unknown connection error'
}

async function connectDB() {
  const configuredMongoUri = process.env.MONGO_URI

  // Prevent accidental clipboard/file-path suffixes from becoming part of the
  // MongoDB write concern (a malformed value can still allow reads to appear
  // healthy while every write fails).
  const mongoUri = configuredMongoUri?.match(/^(mongodb(?:\+srv)?:\/\/.*?[?&]w=majority)(?:[A-Za-z]:[\\/].*)?$/i)?.[1]
    || configuredMongoUri

  if (!mongoUri) {
    throw new Error('MONGO_URI is not configured in backend/.env.')
  }

  try {
    await mongoose.connect(mongoUri, {
      authSource: 'admin',
      writeConcern: { w: 'majority' },
    })
    console.log('MongoDB connected successfully.')
  } catch (error) {
    const category = getMongoErrorCategory(error)
    throw new Error(`MongoDB connection failed: ${category}.`)
  }
}

module.exports = connectDB
