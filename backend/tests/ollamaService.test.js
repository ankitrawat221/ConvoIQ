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

test('analyzes the exact meeting transcript into validated structured results', async () => {
  const { analyzeMeetingTranscript, OLLAMA_MODEL } = require('../services/ollamaService')
  const transcript = 'Customer: The washer is making noise. Customer: I choose Friday for the appointment. Agent: I will schedule a technician for Friday.'
  const expected = {
    summary: 'A customer requested warranty service for a washing machine.',
    discussionPoints: ['A technician visit was discussed.'],
    customerInsights: {
      concerns: ['The washer needs repair.'],
      responses: ['Concern: The washer needs repair. Response: The agent will schedule a technician for Friday.'],
      outcomes: ['The customer chose the Friday appointment.'],
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
  const generated = {
    ...expected,
    discussionPoints: [{
      text: expected.discussionPoints[0],
      evidence: 'Customer: I choose Friday for the appointment.',
    }],
    customerInsights: {
      concerns: [{ text: 'The washer needs repair.', evidence: 'Customer: The washer is making noise.' }],
      responses: [{
        text: 'The agent will schedule a technician for Friday.',
        evidence: 'Agent: I will schedule a technician for Friday.',
        concernEvidence: 'Customer: The washer is making noise.',
      }],
      outcomes: [],
    },
    tasks: [{ ...expected.tasks[0] }],
    decisions: [{ ...expected.decisions[0] }],
  }
  const requests = []
  global.fetch = async (url, options) => {
    requests.push({ url, options })
    return new Response(JSON.stringify({ response: JSON.stringify(generated) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const result = await analyzeMeetingTranscript(transcript)

  assert.equal(requests.length, 3)
  assert.ok(requests.every(({ url }) => url === 'http://127.0.0.1:11434/api/generate'))
  const analysisRequest = JSON.parse(requests[0].options.body)
  const actionsRequest = JSON.parse(requests[1].options.body)
  const insightsRequest = JSON.parse(requests[2].options.body)
  assert.equal(analysisRequest.model, OLLAMA_MODEL)
  assert.ok(analysisRequest.prompt.includes(transcript))
  assert.equal(analysisRequest.format.type, 'object')
  assert.ok(analysisRequest.format.required.includes('tasks'))
  assert.deepEqual(analysisRequest.options, { temperature: 0, num_predict: 2400 })
  assert.ok(analysisRequest.prompt.includes('concrete follow-up actions'))
  assert.ok(analysisRequest.prompt.includes('concernEvidence'))
  assert.ok(analysisRequest.prompt.includes('Simple acknowledgements'))
  assert.ok(actionsRequest.prompt.includes('include the required documents as separate preparation tasks'))
  assert.ok(actionsRequest.prompt.includes('exact unanswered question'))
  assert.equal(actionsRequest.format.type, 'object')
  assert.deepEqual(actionsRequest.format.required, ['tasks', 'decisions', 'unresolvedQuestions'])
  assert.deepEqual(actionsRequest.options, { temperature: 0, num_predict: 1500 })
  assert.ok(insightsRequest.prompt.includes("customer's explicitly stated problem"))
  assert.ok(insightsRequest.prompt.includes('Transcript line breaks may split a single speech turn'))
  assert.equal(insightsRequest.format.type, 'object')
  assert.deepEqual(insightsRequest.format.required, ['discussionPoints', 'concernResponses', 'outcomes'])
  assert.deepEqual(insightsRequest.options, { temperature: 0, num_predict: 1500 })
  assert.deepEqual(result, expected)
})

test('discards ungrounded tasks and questions answered later in the transcript', async () => {
  const { analyzeMeetingTranscript } = require('../services/ollamaService')
  const transcript = [
    'The technician is scheduled for Friday.',
    'Friday works great.',
    'What is the reference number?',
    'Your reference number is ABC123.',
    'Please remove the laundry before the technician arrives.',
    'When can I expect the service report?',
  ].join('\n')
  const generated = {
    summary: 'A service visit was scheduled.',
    discussionPoints: [{ text: 'A technician visit was scheduled.', evidence: 'The technician is scheduled for Friday.' }],
    customerInsights: { concerns: [], responses: [], outcomes: [] },
    tasks: [
      {
        description: 'Schedule a technician visit',
        owner: null,
        deadline: 'Friday',
        evidence: 'The technician is scheduled for Friday.',
      },
      {
        description: 'Remove the laundry before the technician arrives',
        owner: null,
        deadline: null,
        evidence: 'Please remove the laundry before the technician arrives.',
      },
    ],
    decisions: [
      { description: 'Technician appointment accepted.', decisionMaker: 'customer', evidence: 'Friday works great.' },
      { description: 'The technician appointment is confirmed.', decisionMaker: 'agent', evidence: 'The technician is scheduled for Friday.' },
    ],
    unresolvedQuestions: [
      {
        question: 'What is the reference number?',
        evidence: 'What is the reference number?',
        answerEvidence: null,
      },
      {
        question: 'When can I expect the service report?',
        evidence: 'When can I expect the service report?',
        answerEvidence: null,
      },
    ],
  }
  global.fetch = async () => new Response(JSON.stringify({ response: JSON.stringify(generated) }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

  const result = await analyzeMeetingTranscript(transcript)

  assert.deepEqual(result.tasks, [{
    description: 'Remove the laundry before the technician arrives',
    owner: null,
    deadline: null,
    evidence: 'Please remove the laundry before the technician arrives.',
  }])
  assert.deepEqual(result.decisions, [{
    description: 'Technician appointment accepted.',
    decisionMaker: 'customer',
    evidence: 'Friday works great.',
  }])
  assert.deepEqual(result.unresolvedQuestions, [{
    question: 'When can I expect the service report?',
    evidence: 'When can I expect the service report?',
  }])
})

test('does not turn eligibility statements into tasks by combining nearby action words', async () => {
  const { analyzeMeetingTranscript } = require('../services/ollamaService')
  const transcript = [
    'In terms of eligibility to apply, you will need to be the owner or lease holder.',
    'There is a deadline for the application this round.',
  ].join('\n')
  const generated = {
    summary: 'The caller asked about eligibility.',
    discussionPoints: [],
    customerInsights: { concerns: [], responses: [], outcomes: [] },
    tasks: [{
      description: 'Apply for the program.',
      owner: 'customer',
      deadline: null,
      evidence: 'In terms of eligibility to apply, you will need to be the owner or lease holder.',
    }],
    decisions: [],
    unresolvedQuestions: [],
  }
  global.fetch = async () => new Response(JSON.stringify({ response: JSON.stringify(generated) }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

  const result = await analyzeMeetingTranscript(transcript)
  assert.deepEqual(result.tasks, [])
  assert.deepEqual(result.decisions, [])
  assert.deepEqual(result.unresolvedQuestions, [])
})

test('recognizes a direct choice and filters advice while retaining the selected follow-up', async () => {
  const { analyzeMeetingTranscript } = require('../services/ollamaService')
  const transcript = [
    'Agent: You can submit your application through the portal if you prefer.',
    'Agent: Would you prefer online or in person?',
    'Customer: It would',
    'have to be online.',
    'Agent: That is our preferred option.',
    'Agent: I would suggest gathering equipment costs.',
  ].join('\n')
  const generated = {
    summary: 'The customer discussed how to apply.',
    discussionPoints: [],
    customerInsights: { concerns: [], responses: [], outcomes: [] },
    tasks: [{
      description: 'Submit the application online.',
      owner: 'customer',
      deadline: null,
      evidence: 'Agent: You can submit your application through the portal if you prefer.',
    }, {
      description: 'Gather equipment costs.',
      owner: 'customer',
      deadline: null,
      evidence: 'Agent: I would suggest gathering equipment costs.',
    }],
    decisions: [],
    unresolvedQuestions: [],
  }
  global.fetch = async () => new Response(JSON.stringify({ response: JSON.stringify(generated) }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

  const result = await analyzeMeetingTranscript(transcript)

  assert.deepEqual(result.tasks, [{
    description: 'Submit the application online through the portal',
    owner: 'customer',
    deadline: null,
    evidence: 'You can submit your application through the portal if you prefer.',
  }])
  assert.deepEqual(result.decisions, [{
    description: 'It would have to be online.',
    decisionMaker: 'customer',
    evidence: 'Customer: It would\nhave to be online.',
  }])
})

test('turns required application materials and a selected submission method into grounded tasks', async () => {
  const { analyzeMeetingTranscript } = require('../services/ollamaService')
  const transcript = [
    'Agent: You can submit your application through the portal if you prefer.',
    'Agent: Would you prefer online or in person for your application?',
    'Customer: It would have to be online.',
    'For the application paperwork, you will need proof of ownership, a supplier plan, and recent water records.',
    'Applications close at the end of October.',
  ].join('\n')
  const generated = {
    summary: 'The customer discussed applying for a program.',
    discussionPoints: [],
    customerInsights: { concerns: [], responses: [], outcomes: [] },
    tasks: [],
    decisions: [],
    unresolvedQuestions: [],
  }
  global.fetch = async () => new Response(JSON.stringify({ response: JSON.stringify(generated) }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

  const result = await analyzeMeetingTranscript(transcript)

  assert.equal(result.tasks.length, 4)
  assert.deepEqual(result.tasks.map((task) => task.owner), ['customer', 'customer', 'customer', 'customer'])
  assert.deepEqual(result.tasks.map((task) => task.deadline), [null, null, null, 'the end of October'])
  assert.ok(result.tasks.every((task) => task.evidence && transcript.includes(task.evidence)))
  assert.match(result.tasks[3].description, /submit the application online/i)
  assert.deepEqual(result.decisions, [{
    description: 'It would have to be online.',
    decisionMaker: 'customer',
    evidence: 'Customer: It would have to be online.',
  }])
})

test('preserves canonical evidence, contextual confirmations, unanswered questions, and transcript timestamps', async () => {
  const { analyzeMeetingTranscript } = require('../services/ollamaService')
  const transcript = [
    'Agent: Please confirm the appointment for Friday?',
    'Customer: Yes, I confirm.',
    'Agent: An adult must be present for the technician visit.',
    'Customer: How long until the report is ready?',
    'Agent: Reports are usually ready within two weeks.',
    'Customer: Will you notify me by email?',
    'Agent: You will receive email notifications.',
    'Customer: Who will contact me if the report is delayed?',
  ].join('\n')
  const generated = {
    summary: 'A service appointment was confirmed.',
    discussionPoints: [],
    customerInsights: { concerns: [], responses: [], outcomes: [] },
    tasks: [{
      description: 'Have an adult present for the technician visit.',
      owner: null,
      deadline: null,
      evidence: 'agent: an adult must be present for the technician visit',
    }],
    decisions: [{
      description: 'The customer confirmed the Friday appointment.',
      decisionMaker: 'customer',
      evidence: 'customer: yes, i confirm.',
    }],
    unresolvedQuestions: [{
      question: 'Who will contact me if the report is delayed?',
      evidence: 'Who will contact me if the report is delayed?',
      answerEvidence: null,
    }],
  }
  global.fetch = async () => new Response(JSON.stringify({ response: JSON.stringify(generated) }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

  const result = await analyzeMeetingTranscript(transcript, [
    { text: 'Agent: Please confirm the appointment for Friday?', start: 0, end: 2 },
    { text: 'Customer: Yes, I confirm.', start: 2.1, end: 3 },
    { text: 'Agent: An adult must be present for the technician visit.', start: 3.2, end: 5 },
    { text: 'Customer: How long until the report is ready?', start: 5.1, end: 6 },
    { text: 'Agent: Reports are usually ready within two weeks.', start: 6.1, end: 8 },
    { text: 'Customer: Will you notify me by email?', start: 8.1, end: 9 },
    { text: 'Agent: You will receive email notifications.', start: 9.1, end: 10 },
    { text: 'Customer: Who will contact me if the report is delayed?', start: 10.1, end: 12 },
  ])

  assert.deepEqual(result.tasks, [{
    description: 'Have an adult present for the technician visit.',
    owner: null,
    deadline: null,
    evidence: 'Agent: An adult must be present for the technician visit.',
    evidenceStart: 3.2,
    evidenceEnd: 5,
  }])
  assert.deepEqual(result.decisions, [{
    description: 'The customer confirmed the Friday appointment.',
    decisionMaker: 'customer',
    evidence: 'Customer: Yes, I confirm.',
    evidenceStart: 2.1,
    evidenceEnd: 3,
  }])
  assert.deepEqual(result.unresolvedQuestions, [{
    question: 'Who will contact me if the report is delayed?',
    evidence: 'Who will contact me if the report is delayed?',
    evidenceStart: 10.1,
    evidenceEnd: 12,
  }])
})

test('recovers explicit presence requirements and direct confirmations omitted by Ollama', async () => {
  const { analyzeMeetingTranscript } = require('../services/ollamaService')
  const transcript = [
    'An adult must be present if the technician needs access to relight appliances or inspect the service.',
    'Please confirm that you want service started on the first of next month with a technician window from 8 a.m. to noon.',
    'Yes, I confirm.',
    'The appointment is scheduled.',
  ].join('\n')
  const generated = {
    summary: 'A service visit was confirmed.',
    discussionPoints: [],
    customerInsights: { concerns: [], responses: [], outcomes: [] },
    tasks: [],
    decisions: [],
    unresolvedQuestions: [],
  }
  global.fetch = async () => new Response(JSON.stringify({ response: JSON.stringify(generated) }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

  const result = await analyzeMeetingTranscript(transcript, [
    { text: 'An adult must be present if the technician needs access to relight appliances or inspect the service.', start: 0, end: 3 },
    { text: 'Please confirm that you want service started on the first of next month with a technician window from 8 a.m. to noon.', start: 3.1, end: 8 },
    { text: 'Yes, I confirm.', start: 8.1, end: 9 },
  ])

  assert.deepEqual(result.tasks, [{
    description: 'An adult must be present if the technician needs access to relight appliances or inspect the service',
    owner: null,
    deadline: null,
    evidence: 'An adult must be present if the technician needs access to relight appliances or inspect the service.',
    evidenceStart: 0,
    evidenceEnd: 3,
  }])
  assert.equal(result.decisions.length, 1)
  assert.equal(result.decisions[0].description, 'Confirmed you want service started on the first of next month with a technician window from 8 am to noon')
  assert.equal(result.decisions[0].decisionMaker, null)
  assert.equal(result.decisions[0].evidence, 'Yes, I confirm.')
  assert.equal(result.decisions[0].evidenceStart, 8.1)
  assert.equal(result.decisions[0].evidenceEnd, 9)
})

test('keeps specific booking choices and genuine follow-up actions', async () => {
  const { analyzeMeetingTranscript } = require('../services/ollamaService')
  const transcript = [
    'Customer: I will choose flight QF426 at 5:45 PM on Monday, 16 December.',
    'Customer: I accept the additional $35 payment.',
    'Customer: I will take seat G24.',
    'Agent: Please check the new booking confirmation email.',
    'Customer: I will ask my colleague to contact the airline about the adjacent seat.',
    'Agent: You need to complete online check-in 24 hours before departure.',
    'Agent: You need to be at the conference on Monday.',
  ].join('\n')
  const responses = [
    {
      summary: 'The customer selected a flight, paid the additional fee, and chose a seat.',
      discussionPoints: [],
      customerInsights: { concerns: [], responses: [], outcomes: [] },
      tasks: [], decisions: [], unresolvedQuestions: [],
    },
    {
      tasks: [
        { description: 'Check the new booking confirmation email', owner: 'customer', evidence: 'Please check the new booking confirmation email.' },
        { description: 'Ask my colleague to contact the airline about the adjacent seat', owner: 'customer', evidence: 'I will ask my colleague to contact the airline about the adjacent seat.' },
        { description: 'Complete online check-in 24 hours before departure', owner: 'customer', evidence: 'You need to complete online check-in 24 hours before departure.' },
        { description: 'Be at the conference on Monday', owner: 'customer', evidence: 'You need to be at the conference on Monday.' },
      ],
      decisions: [], unresolvedQuestions: [],
    },
    { discussionPoints: [], concernResponses: [], outcomes: [] },
  ]
  let requestIndex = 0
  global.fetch = async () => new Response(JSON.stringify({ response: JSON.stringify(responses[requestIndex++]) }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

  const result = await analyzeMeetingTranscript(transcript)
  assert.equal(result.tasks.length, 3)
  assert.ok(result.tasks.some((task) => /check.*booking confirmation/i.test(task.description)))
  assert.ok(result.tasks.some((task) => /ask.*colleague.*contact.*airline.*adjacent seat/i.test(task.description)))
  assert.ok(result.tasks.some((task) => /complete online check-in/i.test(task.description)))
  assert.ok(result.tasks.every((task) => !/conference on monday/i.test(task.description)))
  assert.ok(result.decisions.some((decision) => /QF426.*5:45 PM.*Monday.*16 December/i.test(decision.description)))
  assert.ok(result.decisions.some((decision) => /additional \$35 payment/i.test(decision.description)))
  assert.ok(result.decisions.some((decision) => /seat G24/i.test(decision.description)))
  assert.ok(result.tasks.every((task) => task.evidence && transcript.includes(task.evidence)))
  assert.ok(result.decisions.every((decision) => decision.evidence && transcript.includes(decision.evidence)))
})

test('requires grounded evidence and keeps concern, response, and outcome categories distinct', async () => {
  const { analyzeMeetingTranscript } = require('../services/ollamaService')
  const transcript = [
    'Customer: My irrigation water costs are rising.',
    'Agent: The subsidy helps fund drip irrigation equipment.',
    'Customer: I will apply online.',
  ].join('\n')
  const generated = {
    summary: 'The customer asked about irrigation subsidies.',
    discussionPoints: [
      { text: 'Water costs are rising.', evidence: 'My irrigation water costs are rising.' },
      { text: 'The customer needs help.', evidence: 'not in the transcript' },
    ],
    customerInsights: {
      concerns: [
        { text: 'Water costs are rising.', evidence: 'My irrigation water costs are rising.' },
        { text: 'The customer needs help.', evidence: 'not in the transcript' },
      ],
      responses: [{
        text: 'The subsidy can help fund irrigation equipment.',
        evidence: 'The subsidy helps fund drip irrigation equipment.',
        concernEvidence: 'My irrigation water costs are rising.',
      }],
      outcomes: [
        { text: 'The customer chose to apply online.', evidence: 'I will apply online.' },
        { text: 'Water costs are rising.', evidence: 'My irrigation water costs are rising.' },
      ],
    },
    tasks: [
      { description: 'Submit the application', owner: null, deadline: null },
    ],
    decisions: [
      { description: 'The customer will apply online.', decisionMaker: 'customer', evidence: 'I will apply online.' },
      { description: 'A deadline was agreed.', decisionMaker: 'mutual', evidence: 'No matching evidence.' },
    ],
    unresolvedQuestions: [],
  }
  global.fetch = async () => new Response(JSON.stringify({ response: JSON.stringify(generated) }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

  const result = await analyzeMeetingTranscript(transcript)

  assert.deepEqual(result.discussionPoints, [])
  assert.deepEqual(result.customerInsights.concerns, ['Water costs are rising.'])
  assert.deepEqual(result.customerInsights.responses, [
    'Concern: Water costs are rising. Response: The subsidy can help fund irrigation equipment.',
  ])
  assert.deepEqual(result.customerInsights.outcomes, ['The customer chose to apply online.'])
  assert.deepEqual(result.tasks, [])
  assert.deepEqual(result.decisions, [{
    description: 'The customer will apply online.',
    decisionMaker: 'customer',
    evidence: 'I will apply online.',
  }])
})

test('removes discussion topics that repeat a response in different words', async () => {
  const { analyzeMeetingTranscript } = require('../services/ollamaService')
  const transcript = [
    'Customer: I need help with equipment costs.',
    'Agent: Low-interest loans are available to cover equipment costs.',
  ].join('\n')
  const generated = {
    summary: 'The caller asked about help with equipment costs.',
    discussionPoints: [{
      text: 'Loan availability was discussed.',
      evidence: 'Low-interest loans are available to cover equipment costs.',
    }],
    customerInsights: {
      concerns: [{ text: 'The caller needs help with equipment costs.', evidence: 'I need help with equipment costs.' }],
      responses: [{
        text: 'Low-interest loans are available to cover equipment costs.',
        evidence: 'Low-interest loans are available to cover equipment costs.',
        concernEvidence: 'I need help with equipment costs.',
      }],
      outcomes: [],
    },
    tasks: [],
    decisions: [],
    unresolvedQuestions: [],
  }
  global.fetch = async () => new Response(JSON.stringify({ response: JSON.stringify(generated) }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

  const result = await analyzeMeetingTranscript(transcript)

  assert.deepEqual(result.discussionPoints, [])
  assert.deepEqual(result.customerInsights.concerns, ['The caller needs help with equipment costs.'])
  assert.deepEqual(result.customerInsights.responses, [
    'Concern: The caller needs help with equipment costs. Response: Low-interest loans are available to cover equipment costs.',
  ])
})

test('does not accept malformed analysis or hide Ollama service failures', async () => {
  const { analyzeMeetingTranscript } = require('../services/ollamaService')
  global.fetch = async () => new Response(JSON.stringify({ response: '{"summary":"Only a summary"}' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
  await assert.rejects(
    analyzeMeetingTranscript('A real transcript.'),
    (error) => error.code === 'INVALID_MODEL_RESPONSE',
  )

  global.fetch = async () => new Response(JSON.stringify({ error: 'model not found' }), { status: 404 })
  await assert.rejects(
    analyzeMeetingTranscript('A real transcript.'),
    (error) => error.code === 'MODEL_NOT_INSTALLED',
  )

  global.fetch = async () => { throw new TypeError('connection refused') }
  await assert.rejects(
    analyzeMeetingTranscript('A real transcript.'),
    (error) => error.code === 'OLLAMA_UNAVAILABLE' && !/connection refused/.test(error.message),
  )
})

test('rejects empty or oversized transcripts without contacting Ollama', async () => {
  const { analyzeMeetingTranscript, MAX_PROMPT_LENGTH } = require('../services/ollamaService')
  let requestCount = 0
  global.fetch = async () => {
    requestCount += 1
    throw new Error('Unexpected Ollama request')
  }

  await assert.rejects(
    analyzeMeetingTranscript(' \n '),
    (error) => error.code === 'TRANSCRIPT_REQUIRED',
  )
  await assert.rejects(
    analyzeMeetingTranscript('x'.repeat(MAX_PROMPT_LENGTH)),
    (error) => error.code === 'TRANSCRIPT_TOO_LONG',
  )
  assert.equal(requestCount, 0)
})
