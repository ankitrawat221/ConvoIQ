const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '')

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, options)
  } catch {
    throw new Error('Could not reach the ConvoIQ backend. Check that it is running and accessible.')
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new Error(`The backend returned an invalid response (${response.status}).`)
  }

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `Request failed with status ${response.status}.`)
  }

  return payload.data
}

function formatMeetingDate(value) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function normalizeMeeting(meeting) {
  const participants = Array.isArray(meeting.participants) ? meeting.participants : []
  const duration = Number(meeting.duration)
  return {
    ...meeting,
    id: meeting._id || meeting.id,
    workspaceId: meeting.workspaceId ? String(meeting.workspaceId) : null,
    date: formatMeetingDate(meeting.meetingDate),
    duration: Number.isFinite(duration) && duration > 0 ? `${duration} min` : '—',
    durationMinutes: Number.isFinite(duration) ? duration : 0,
    participantCount: participants.length,
    participantNames: participants.map((participant) => participant.name || participant.speakerLabel).filter(Boolean),
    status: meeting.status ? meeting.status[0].toUpperCase() + meeting.status.slice(1) : 'Unknown',
  }
}

function normalizeWorkspace(workspace) {
  return {
    ...workspace,
    id: workspace._id || workspace.id,
  }
}

export async function getMeetings() {
  const meetings = await request('/api/meetings')
  return meetings.map(normalizeMeeting)
}

export async function getMeeting(id) {
  return normalizeMeeting(await request(`/api/meetings/${encodeURIComponent(id)}`))
}

export async function startMeetingProcessing(id) {
  return normalizeMeeting(await request(`/api/meetings/${encodeURIComponent(id)}/process`, {
    method: 'POST',
  }))
}

export async function createMeeting(meeting) {
  return normalizeMeeting(await request('/api/meetings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meeting),
  }))
}

export async function updateMeeting(id, meeting) {
  return normalizeMeeting(await request(`/api/meetings/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meeting),
  }))
}

export async function deleteMeeting(id) {
  return request(`/api/meetings/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function getWorkspaces() {
  return (await request('/api/workspaces')).map(normalizeWorkspace)
}

export async function getWorkspace(id) {
  return normalizeWorkspace(await request(`/api/workspaces/${encodeURIComponent(id)}`))
}

export async function getWorkspaceMeetings(id) {
  return (await request(`/api/workspaces/${encodeURIComponent(id)}/meetings`)).map(normalizeMeeting)
}

export async function createWorkspace(workspace) {
  return normalizeWorkspace(await request('/api/workspaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workspace),
  }))
}

export async function updateWorkspace(id, workspace) {
  return normalizeWorkspace(await request(`/api/workspaces/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workspace),
  }))
}

export async function deleteWorkspace(id) {
  return request(`/api/workspaces/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function updateMeetingWorkspace(meetingId, workspaceId) {
  return normalizeMeeting(await request(`/api/meetings/${encodeURIComponent(meetingId)}/workspace`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId }),
  }))
}

export async function askWorkspaceQuestion(workspaceId, question) {
  return request(`/api/workspaces/${encodeURIComponent(workspaceId)}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })
}

export function uploadMeetingAudio(meetingId, file, onProgress) {
  return new Promise((resolve, reject) => {
    if (typeof meetingId !== 'string' || !meetingId.trim()) {
      reject(new Error('Select a meeting before uploading audio.'))
      return
    }
    if (typeof File === 'undefined' || !(file instanceof File)) {
      reject(new Error('Choose an audio file before uploading.'))
      return
    }

    const formData = new FormData()
    formData.append('audio', file)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE_URL}/api/audio/${encodeURIComponent(meetingId)}`)
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && typeof onProgress === 'function') {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    })
    xhr.addEventListener('load', () => {
      let payload
      try {
        payload = JSON.parse(xhr.responseText)
      } catch {
        reject(new Error(`The backend returned an invalid response (${xhr.status}).`))
        return
      }

      if (xhr.status < 200 || xhr.status >= 300 || payload.success === false) {
        reject(new Error(payload.message || `Upload failed with status ${xhr.status}.`))
        return
      }
      resolve(payload.data)
    })
    xhr.addEventListener('error', () => reject(new Error('Could not reach the backend during audio upload.')))
    xhr.addEventListener('timeout', () => reject(new Error('Audio upload timed out.')))
    xhr.timeout = 0
    xhr.send(formData)
  })
}

export function getAudioUrl(path) {
  if (!path) return ''
  return /^https?:\/\//i.test(path) ? path : `${API_BASE_URL}/${path.replace(/^\/+/, '')}`
}
