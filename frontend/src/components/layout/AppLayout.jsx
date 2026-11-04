import { useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { uploadMeetingAudio } from '../../services/api.js'
import Navbar from './Navbar.jsx'
import { Sidebar } from './Sidebar.jsx'

const pageDetailsMap = {
  '/': ['Dashboard', 'Turn your meetings into insights with AI ✨'],
  '/meetings': ['Meetings', 'All your conversations, organized in one place.'],
  '/tasks': ['Tasks', 'Turn meeting conversations into clear next steps.'],
  '/decisions': ['Decisions', 'Keep important decisions easy to find and follow.'],
  '/memory': ['Meeting Memory', 'A searchable memory of what your team discussed.'],
  '/chat': ['AI Chat', 'Ask questions across your meeting history.'],
  '/analytics': ['Analytics', 'Understand your team’s meeting patterns.'],
  '/settings': ['Settings', 'Manage your workspace preferences.'],
}

function currentLocalDateTime() {
  const date = new Date()
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

export default function AppLayout({ context }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedMeetingId, setSelectedMeetingId] = useState('')
  const [createNewMeeting, setCreateNewMeeting] = useState(false)
  const [newMeeting, setNewMeeting] = useState({ title: '', meetingDate: '', participants: '' })
  const [selectedFile, setSelectedFile] = useState(null)
  const [createdMeetingId, setCreatedMeetingId] = useState('')
  const location = useLocation()
  const page = useMemo(() => {
    const detailRoute = /^\/meetings\/[^/]+$/.test(location.pathname)
    return detailRoute ? ['Meeting Details', 'A closer look at this conversation and its follow-ups.'] : (pageDetailsMap[location.pathname] || pageDetailsMap['/'])
  }, [location.pathname])

  const handleUpload = (event) => {
    const file = event.target.files?.[0]
    setUploadError('')
    setUploadSuccess('')
    setSelectedFile(null)
    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase()
    const supportedType = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'].includes(file.type)
    if (!['mp3', 'wav'].includes(extension) || !supportedType) {
      setUploadError('Choose an MP3 or WAV audio file.')
      return
    }
    if (file.size > 100 * 1024 * 1024) {
      setUploadError('Audio files must be 100 MB or smaller.')
      return
    }
    setSelectedFile(file)
  }

  const submitUpload = async (event) => {
    event.preventDefault()
    if (uploading) return
    setUploadError('')
    setUploadSuccess('')
    if (!selectedFile) {
      setUploadError('Choose an MP3 or WAV file to upload.')
      return
    }

    setUploading(true)
    try {
      let meetingId = createdMeetingId || selectedMeetingId
      if (createNewMeeting && !meetingId) {
        if (!newMeeting.title.trim()) throw new Error('Enter a title for the new meeting.')
        const participants = newMeeting.participants.split(',').map((name) => name.trim()).filter(Boolean).map((name) => ({ name }))
        const created = await context.addMeeting({
          title: newMeeting.title.trim(),
          meetingDate: new Date(newMeeting.meetingDate).toISOString(),
          participants,
        })
        meetingId = created.id
        setCreatedMeetingId(meetingId)
      }
      if (!meetingId) throw new Error('Select a meeting or create a new one before uploading.')

      await uploadMeetingAudio(meetingId, selectedFile, setUploadProgress)
      await context.refreshMeetings()
      setUploadSuccess(`Uploaded ${selectedFile.name} successfully. Transcription has not been run.`)
    } catch (error) {
      setUploadError(error.message)
    } finally {
      setUploading(false)
    }
  }

  const openUpload = () => {
    setUploadOpen(true)
    setUploadError('')
    setUploadSuccess('')
    setSelectedFile(null)
    setCreatedMeetingId('')
    setUploadProgress(0)
    setSelectedMeetingId(context.meetings[0]?.id || '')
    setCreateNewMeeting(false)
    setNewMeeting({ title: '', meetingDate: currentLocalDateTime(), participants: '' })
  }

  return (
    <div className="app-shell">
      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="main-area">
        <Navbar
          key={location.pathname}
          title={page[0]}
          subtitle={page[1]}
          onMenu={() => setMobileOpen(true)}
          meetings={context.meetings}
          tasks={context.tasks}
          decisions={context.decisions}
        />
        <div className="page-content">
          <Outlet context={{ ...context, openUpload }} />
        </div>
      </main>
      {uploadOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setUploadOpen(false) }}>
        <section className="upload-modal glass-panel" role="dialog" aria-modal="true" aria-labelledby="upload-title">
          <button className="modal-close" onClick={() => setUploadOpen(false)} aria-label="Close upload dialog">×</button>
          <form onSubmit={submitUpload}>
            <div className="modal-icon"><span className="audio-glyph"><span /><span /><span /><span /><span /></span></div>
            <h2 id="upload-title">Upload meeting audio</h2>
            <p>Select a meeting and upload an MP3 or WAV recording. Files are stored by the backend; no transcription is performed.</p>
            <label className="upload-field">Meeting
              <select value={createNewMeeting ? '__new__' : selectedMeetingId} onChange={(event) => {
                const isNew = event.target.value === '__new__'
                setCreateNewMeeting(isNew)
                setCreatedMeetingId('')
                setSelectedMeetingId(isNew ? '' : event.target.value)
                setUploadError('')
              }} disabled={uploading}>
                <option value="">Select a meeting</option>
                {context.meetings.map((meeting) => <option value={meeting.id} key={meeting.id}>{meeting.title}</option>)}
                <option value="__new__">Create a new meeting</option>
              </select>
            </label>
            {createNewMeeting && <div className="upload-meeting-fields">
              <label className="upload-field">Meeting title<input value={newMeeting.title} onChange={(event) => setNewMeeting((current) => ({ ...current, title: event.target.value }))} required disabled={uploading || Boolean(createdMeetingId)} /></label>
              <label className="upload-field">Meeting date<input type="datetime-local" value={newMeeting.meetingDate} onChange={(event) => setNewMeeting((current) => ({ ...current, meetingDate: event.target.value }))} required disabled={uploading || Boolean(createdMeetingId)} /></label>
              <label className="upload-field">Participants<input value={newMeeting.participants} onChange={(event) => setNewMeeting((current) => ({ ...current, participants: event.target.value }))} placeholder="Names separated by commas" disabled={uploading || Boolean(createdMeetingId)} /></label>
            </div>}
            <label className="file-drop">
              <input type="file" accept=".mp3,.wav,audio/mpeg,audio/wav" onChange={handleUpload} disabled={uploading} />
              <strong>{selectedFile?.name || 'Choose an audio file'}</strong>
              <span>{selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB` : 'MP3 or WAV · Maximum 100 MB'}</span>
              <em>Browse files</em>
            </label>
            {uploading && <p className="muted-copy">Uploading… {uploadProgress}%</p>}
            {uploadError && <p className="form-error" role="alert">{uploadError}</p>}
            {uploadSuccess && <p className="upload-success" role="status">{uploadSuccess}</p>}
            <div className="modal-actions">
              <button type="button" className="button-secondary" onClick={() => setUploadOpen(false)} disabled={uploading}>Close</button>
              <button className="button-primary" disabled={uploading || Boolean(uploadSuccess)}>{uploading ? 'Uploading…' : 'Upload audio'}</button>
            </div>
          </form>
        </section>
      </div>}
    </div>
  )
}
