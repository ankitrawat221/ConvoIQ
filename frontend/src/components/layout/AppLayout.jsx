import { useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
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

export default function AppLayout({ context }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const location = useLocation()
  const page = useMemo(() => {
    const detailRoute = /^\/meetings\/[^/]+$/.test(location.pathname)
    return detailRoute ? ['Meeting Details', 'A closer look at this conversation and its follow-ups.'] : (pageDetailsMap[location.pathname] || pageDetailsMap['/'])
  }, [location.pathname])

  const handleUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('audio/')) {
      setUploadError('Choose an audio file to preview it in your browser.')
      return
    }
    context.setAudio({ name: file.name, url: URL.createObjectURL(file) })
    setUploadError('')
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
          <Outlet context={{ ...context, openUpload: () => { setUploadOpen(true); setUploadError('') } }} />
        </div>
      </main>
      {uploadOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setUploadOpen(false) }}>
        <section className="upload-modal glass-panel" role="dialog" aria-modal="true" aria-labelledby="upload-title">
          <button className="modal-close" onClick={() => setUploadOpen(false)} aria-label="Close upload dialog">×</button>
          <div className="modal-icon"><span className="audio-glyph"><span /><span /><span /><span /><span /></span></div>
          <h2 id="upload-title">Upload meeting audio</h2>
          <p>Choose an audio file stored on your device. Playback stays in this browser; no file is sent to a service.</p>
          <label className="file-drop">
            <input type="file" accept="audio/*" onChange={handleUpload} />
            <strong>{context.audio?.name || 'Choose an audio file'}</strong>
            <span>MP3, WAV, M4A and other browser-supported audio</span>
            <em>Browse files</em>
          </label>
          {uploadError && <p className="form-error">{uploadError}</p>}
          {context.audio?.url && <audio className="audio-preview" src={context.audio.url} controls />}
          <div className="modal-actions"><button className="button-secondary" onClick={() => setUploadOpen(false)}>Done</button></div>
        </section>
      </div>}
    </div>
  )
}
