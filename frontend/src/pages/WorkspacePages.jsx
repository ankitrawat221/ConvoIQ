import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileAudio2,
  Filter,
  Gavel,
  ListChecks,
  MessageCircleMore,
  Plus,
  Search,
  Send,
  Settings2,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import useAppData from '../components/layout/useAppData.js'
import { getAudioUrl, getMeeting } from '../services/api.js'

function PageIntro({ eyebrow, title, description, action }) {
  return <div className="workspace-intro"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>{action}</div>
}

function BlankSlate({ icon: Icon, title, description }) {
  return <div className="empty-state"><span><Icon size={23} /></span><strong>{title}</strong><p>{description}</p></div>
}

function MeetingStatus({ status }) {
  return <span className={`status-pill status-${status.toLowerCase().replaceAll(' ', '-')}`}>{status}</span>
}

function dateTimeInput(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function MeetingForm({ meeting, onSave, onCancel, error, submitting }) {
  const [title, setTitle] = useState(meeting?.title || '')
  const [description, setDescription] = useState(meeting?.description || '')
  const [meetingDate, setMeetingDate] = useState(dateTimeInput(meeting?.meetingDate))
  const [participants, setParticipants] = useState((meeting?.participantNames || []).join(', '))

  const submit = (event) => {
    event.preventDefault()
    onSave({
      title: title.trim(),
      description: description.trim(),
      meetingDate: new Date(meetingDate).toISOString(),
      participants: participants.split(',').map((name) => name.trim()).filter(Boolean).map((name) => ({ name })),
      ...(meeting ? { duration: meeting.durationMinutes } : {}),
    })
  }

  return <form className="inline-form meeting-form" onSubmit={submit}>
    <div className="form-heading"><strong>{meeting ? 'Edit meeting' : 'Create a meeting'}</strong><span>Meeting data is saved to the backend.</span></div>
    <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={150} /></label>
    <label>Description<input value={description} onChange={(event) => setDescription(event.target.value)} /></label>
    <div className="form-two-col">
      <label>Date and time<input type="datetime-local" value={meetingDate} onChange={(event) => setMeetingDate(event.target.value)} required /></label>
      <label>Participants<input value={participants} onChange={(event) => setParticipants(event.target.value)} placeholder="Names separated by commas" /></label>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="button-secondary" onClick={onCancel} disabled={submitting}>Cancel</button><button className="button-primary" disabled={submitting}>{submitting ? 'Saving…' : 'Save meeting'}</button></div>
  </form>
}

export function Meetings() {
  const { meetings, meetingsLoading, meetingsError, refreshMeetings, addMeeting, openUpload } = useAppData()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All status')
  const [sortOrder, setSortOrder] = useState('newest')
  const [createOpen, setCreateOpen] = useState(false)
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const filtered = [...meetings].filter((meeting) => (
    meeting.title.toLowerCase().includes(query.toLowerCase())
    && (status === 'All status' || meeting.status === status)
  ))
  filtered.sort((a, b) => {
    const difference = new Date(a.meetingDate).getTime() - new Date(b.meetingDate).getTime()
    return sortOrder === 'newest' ? -difference : difference
  })

  const submitMeeting = async (meeting) => {
    setCreating(true)
    setCreateError('')
    try {
      await addMeeting(meeting)
      setCreateOpen(false)
    } catch (error) {
      setCreateError(error.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="workspace-page">
      <PageIntro eyebrow="Your library" title="All meetings" description="Browse recordings and meeting details saved in your workspace." action={<div className="page-actions"><button className="button-secondary" onClick={() => refreshMeetings()}><ArrowRight size={15} /> Refresh</button><button className="button-secondary" onClick={() => setCreateOpen((open) => !open)}><Plus size={16} /> New meeting</button><button className="button-primary" onClick={openUpload}><Plus size={16} /> Upload audio</button></div>} />
      <section className="content-card glass-panel">
        <div className="filter-toolbar">
          <label className="inline-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a meeting..." /></label>
          <label className="filter-select"><Filter size={15} /><select value={status} onChange={(event) => setStatus(event.target.value)}><option>All status</option>{['Scheduled', 'Recording', 'Processing', 'Completed', 'Failed'].map((value) => <option key={value}>{value}</option>)}</select><ChevronDown size={14} /></label>
          <label className="filter-select"><select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} aria-label="Sort meetings by date"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select><ChevronDown size={14} /></label>
        </div>
        {createOpen && <MeetingForm onSave={submitMeeting} onCancel={() => { setCreateOpen(false); setCreateError('') }} error={createError} submitting={creating} />}
        {meetingsError && <p className="form-error" role="alert">Could not load meetings: {meetingsError}</p>}
        {meetingsLoading ? <p className="muted-copy">Loading meetings…</p> : filtered.length ? <>
          <div className="table-heading meeting-table-heading"><span>Meeting</span><span>Recording</span><span>Date & duration</span><span>Participants</span><span>Status</span><span /></div>
          {filtered.map((meeting) => (
          <Link to={`/meetings/${meeting.id}`} className="table-row meeting-table-row" key={meeting.id}>
            <span className="table-meeting-name"><i className="table-icon"><AudioLines size={17} /></i><span><strong>{meeting.title}</strong><small>{meeting.description || 'Meeting details'}</small></span></span>
            <span className="table-category">{meeting.audioUrl ? 'Audio available' : 'No recording'}</span>
            <span className="table-date"><strong>{meeting.date}</strong><small>{meeting.duration}</small></span>
            <span className="table-participants"><UsersRound size={15} />{meeting.participantCount}</span>
            <MeetingStatus status={meeting.status} />
            <ArrowRight size={16} className="table-arrow" />
          </Link>
          ))}
        </> : <BlankSlate icon={Search} title={meetings.length ? 'No meetings found' : 'No meetings yet'} description={meetings.length ? 'Try changing your search or filters.' : 'Create a meeting or upload audio to get started.'} />}
      </section>
    </div>
  )
}

export function MeetingDetails() {
  const { meetingId } = useParams()
  const { saveMeeting, removeMeeting } = useAppData()
  const navigate = useNavigate()
  const [meetingState, setMeetingState] = useState({ id: null, meeting: null, loading: true, error: '' })
  const currentState = meetingState.id === meetingId
  const meeting = currentState ? meetingState.meeting : null
  const loading = !currentState || meetingState.loading
  const error = currentState ? meetingState.error : ''
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let active = true
    getMeeting(meetingId).then((result) => {
      if (active) setMeetingState({ id: meetingId, meeting: result, loading: false, error: '' })
    }).catch((requestError) => {
      if (active) setMeetingState({ id: meetingId, meeting: null, loading: false, error: requestError.message })
    })
    return () => { active = false }
  }, [meetingId])

  const submitEdit = async (updated) => {
    setSaving(true)
    try {
      const savedMeeting = await saveMeeting(meetingId, updated)
      setMeetingState({ id: meetingId, meeting: savedMeeting, loading: false, error: '' })
      setEditing(false)
    } catch (requestError) {
      setMeetingState((current) => ({ ...current, error: requestError.message }))
    } finally {
      setSaving(false)
    }
  }

  const deleteCurrentMeeting = async () => {
    if (!window.confirm(`Delete "${meeting.title}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await removeMeeting(meetingId)
      navigate('/meetings')
    } catch (requestError) {
      setMeetingState((current) => ({ ...current, error: requestError.message }))
      setDeleting(false)
    }
  }

  if (loading) return <div className="workspace-page"><Link to="/meetings" className="back-link"><ArrowLeft size={16} /> Back to meetings</Link><section className="content-card glass-panel"><p className="muted-copy">Loading meeting…</p></section></div>
  if (error && !meeting) return <div className="workspace-page"><Link to="/meetings" className="back-link"><ArrowLeft size={16} /> Back to meetings</Link><section className="content-card glass-panel"><BlankSlate icon={FileAudio2} title="Could not load meeting" description={error} /></section></div>
  if (!meeting) return <div className="workspace-page"><Link to="/meetings" className="back-link"><ArrowLeft size={16} /> Back to meetings</Link><section className="content-card glass-panel"><BlankSlate icon={FileAudio2} title="Meeting not found" description="This meeting may have been removed or its link may be incorrect." /></section></div>

  return (
    <div className="workspace-page">
      <Link to="/meetings" className="back-link"><ArrowLeft size={16} /> All meetings</Link>
      <div className="meeting-detail-header glass-panel">
        <div className="detail-title-line"><span className="detail-icon"><AudioLines size={22} /></span><div><span className="eyebrow">Meeting</span><h2>{meeting.title}</h2></div><MeetingStatus status={meeting.status} /><div className="detail-actions"><button className="button-secondary" onClick={() => setEditing((current) => !current)}><Settings2 size={14} /> Edit</button><button className="button-secondary" onClick={deleteCurrentMeeting} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</button></div></div>
        <div className="detail-meta"><span><CalendarDays size={16} />{meeting.date}</span><span><Clock3 size={16} />{meeting.duration}</span><span><UsersRound size={16} />{meeting.participantCount} participants</span>{meeting.participantNames.length > 0 && <span>{meeting.participantNames.join(', ')}</span>}</div>
        {meeting.description && <p className="meeting-description">{meeting.description}</p>}
      </div>
      {editing && <MeetingForm meeting={meeting} onSave={submitEdit} onCancel={() => setEditing(false)} error={error} submitting={saving} />}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="detail-grid">
        <section className="content-card glass-panel detail-summary"><div className="section-heading"><span className="section-icon"><Sparkles size={18} /></span><h3>AI summary</h3></div>{meeting.summary ? <p>{meeting.summary}</p> : <p className="muted-copy">No summary is available. AI processing is not connected.</p>}</section>
        <section className="content-card glass-panel"><div className="section-heading"><span className="section-icon blue-section-icon"><ListChecks size={18} /></span><h3>Follow-up tasks</h3></div>
          <p className="muted-copy">Task extraction and meeting-linked tasks are not available from the backend yet.</p>
        </section>
        <section className="content-card glass-panel"><div className="section-heading"><span className="section-icon peach-section-icon"><Gavel size={18} /></span><h3>Decisions</h3></div>
          <p className="muted-copy">Decision extraction is not available from the backend yet.</p>
        </section>
        <section className="content-card glass-panel audio-card"><div className="section-heading"><span className="section-icon"><FileAudio2 size={18} /></span><h3>Audio recording</h3></div>
          {meeting.audioUrl ? <><p className="muted-copy">Uploaded recording</p><audio src={getAudioUrl(meeting.audioUrl)} controls /></> : <div className="audio-unavailable"><span><FileAudio2 size={20} /></span><p>No recording is attached to this meeting.</p><small>Use Upload Audio to add an MP3 or WAV recording.</small></div>}
        </section>
        <section className="content-card glass-panel"><div className="section-heading"><span className="section-icon blue-section-icon"><FileAudio2 size={18} /></span><h3>Transcript</h3></div>{meeting.transcript ? <p className="meeting-transcript">{meeting.transcript}</p> : <p className="muted-copy">No transcript is available. Uploading audio does not automatically transcribe it.</p>}</section>
      </div>
    </div>
  )
}

function TaskForm({ task, onSave, onCancel }) {
  const [title, setTitle] = useState(task?.title || '')
  const [owner, setOwner] = useState(task?.owner || '')
  const [due, setDue] = useState(task?.due || '')
  const [meeting, setMeeting] = useState(task?.meeting || '')
  const [priority, setPriority] = useState(task?.priority || 'Medium')
  const submit = (event) => {
    event.preventDefault()
    if (title.trim()) onSave({ ...task, title: title.trim(), owner: owner.trim() || 'Unassigned', due: due.trim() || 'No date', meeting: meeting.trim() || 'General', priority })
  }
  return <form className="inline-form task-form" onSubmit={submit}>
    <div className="form-heading"><strong>{task ? 'Edit task' : 'Create a task'}</strong><span>Keep ownership and next steps clear.</span></div>
    <label>Task name<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What needs to be done?" required /></label>
    <div className="form-two-col"><label>Owner<input value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Name" /></label><label>Due date<input value={due} onChange={(event) => setDue(event.target.value)} placeholder="e.g. Nov 24" /></label></div>
    <div className="form-two-col"><label>Meeting<input value={meeting} onChange={(event) => setMeeting(event.target.value)} placeholder="Meeting name" /></label><label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value)}><option>Low</option><option>Medium</option><option>High</option></select></label></div>
    <div className="form-actions"><button type="button" className="button-secondary" onClick={onCancel}>Cancel</button><button className="button-primary"><Check size={15} /> Save task</button></div>
  </form>
}

export function Tasks() {
  const { tasks, setTasks } = useAppData()
  const [formTask, setFormTask] = useState(undefined)
  const [filter, setFilter] = useState('All tasks')
  const filtered = tasks.filter((task) => filter === 'All tasks' || task.status === filter)
  const save = (next) => {
    setTasks((current) => next.id ? current.map((task) => task.id === next.id ? next : task) : [{ ...next, id: `task-${Date.now()}`, status: 'To do' }, ...current])
    setFormTask(undefined)
  }
  return (
    <div className="workspace-page">
      <PageIntro eyebrow="Follow through" title="Tasks" description="Demo tasks are stored in this browser; no task API is connected." action={<button className="button-primary" onClick={() => setFormTask(null)}><Plus size={16} /> New task</button>} />
      <section className="content-card glass-panel task-board">
        <div className="board-toolbar"><span className="board-count"><strong>{tasks.length}</strong> tasks</span><label className="filter-select"><Settings2 size={15} /><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All tasks</option><option>To do</option><option>In progress</option><option>Done</option></select><ChevronDown size={14} /></label></div>
        {formTask !== undefined && <TaskForm task={formTask || undefined} onSave={save} onCancel={() => setFormTask(undefined)} />}
        <div className="task-list">
          {filtered.map((task) => <article className="task-row" key={task.id}>
            <button className={`task-check ${task.status === 'Done' ? 'task-checked' : ''}`} onClick={() => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: item.status === 'Done' ? 'To do' : 'Done' } : item))} aria-label={`Mark ${task.title} ${task.status === 'Done' ? 'not done' : 'done'}`}>{task.status === 'Done' && <Check size={14} />}</button>
            <div className="task-copy"><strong className={task.status === 'Done' ? 'task-title-done' : ''}>{task.title}</strong><span>{task.meeting} <i>·</i> {task.owner}</span></div>
            <span className={`priority-pill priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
            <span className="task-due"><CalendarDays size={14} />{task.due}</span>
            <select className={`task-status-select task-state-${task.status.toLowerCase().replaceAll(' ', '-')}`} value={task.status} onChange={(event) => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: event.target.value } : item))} aria-label={`Status for ${task.title}`}><option>To do</option><option>In progress</option><option>Done</option></select>
            <button className="edit-task-button" onClick={() => setFormTask(task)}>Edit</button>
          </article>)}
          {!filtered.length && <BlankSlate icon={ListChecks} title="No tasks in this view" description="Choose another status or add a new task." />}
        </div>
      </section>
    </div>
  )
}

function DecisionForm({ onSave, onCancel }) {
  const [title, setTitle] = useState('')
  const [owner, setOwner] = useState('')
  const [meeting, setMeeting] = useState('')
  return <form className="inline-form decision-form" onSubmit={(event) => { event.preventDefault(); if (title.trim()) onSave({ id: `decision-${Date.now()}`, title: title.trim(), owner: owner.trim() || 'Unassigned', meeting: meeting.trim() || 'General', date: 'Today', status: 'Under review' }) }}>
    <div className="form-heading"><strong>Record a decision</strong><span>Add the outcome and who owns it.</span></div>
    <label>Decision<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What was decided?" required /></label>
    <div className="form-two-col"><label>Owner<input value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Name or team" /></label><label>Meeting<input value={meeting} onChange={(event) => setMeeting(event.target.value)} placeholder="Meeting name" /></label></div>
    <div className="form-actions"><button type="button" className="button-secondary" onClick={onCancel}>Cancel</button><button className="button-primary"><Check size={15} /> Save decision</button></div>
  </form>
}

export function Decisions() {
  const { decisions, setDecisions } = useAppData()
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState('All decisions')
  const filtered = decisions.filter((decision) => filter === 'All decisions' || decision.status === filter)
  return (
    <div className="workspace-page">
      <PageIntro eyebrow="Team alignment" title="Decisions" description="Demo decisions are stored in this browser; no decisions API is connected." action={<button className="button-primary" onClick={() => setAdding((value) => !value)}><Plus size={16} /> Add decision</button>} />
      <section className="content-card glass-panel">
        <div className="board-toolbar"><span className="board-count"><strong>{decisions.length}</strong> recorded decisions</span><label className="filter-select"><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All decisions</option><option>Confirmed</option><option>Under review</option></select><ChevronDown size={14} /></label></div>
        {adding && <DecisionForm onCancel={() => setAdding(false)} onSave={(decision) => { setDecisions((current) => [decision, ...current]); setAdding(false) }} />}
        <div className="decision-list">
          {filtered.map((decision) => <article className="decision-row" key={decision.id}>
            <span className="decision-mark"><Gavel size={18} /></span><div className="decision-copy"><strong>{decision.title}</strong><span>{decision.meeting} <i>·</i> {decision.date} <i>·</i> Owner: {decision.owner}</span></div>
            <select className={`decision-status decision-${decision.status.toLowerCase().replaceAll(' ', '-')}`} value={decision.status} onChange={(event) => setDecisions((current) => current.map((item) => item.id === decision.id ? { ...item, status: event.target.value } : item))} aria-label={`Status for ${decision.title}`}><option>Confirmed</option><option>Under review</option></select>
          </article>)}
          {!filtered.length && <BlankSlate icon={Gavel} title="No decisions here" description="Try a different status filter or add a decision." />}
        </div>
      </section>
    </div>
  )
}

export function Memory() {
  const { meetings } = useAppData()
  const [query, setQuery] = useState('')
  const topics = useMemo(() => meetings.flatMap((meeting) => [
    meeting.summary && { meeting, label: 'Summary', text: meeting.summary },
    meeting.transcript && { meeting, label: 'Transcript', text: meeting.transcript },
  ].filter(Boolean)).filter((entry) => `${entry.meeting.title} ${entry.text}`.toLowerCase().includes(query.toLowerCase())), [meetings, query])
  return (
    <div className="workspace-page">
      <PageIntro eyebrow="Meeting memory" title="Find the thread" description="Search text actually stored with meetings. No semantic search or AI memory service is connected." />
      <section className="memory-search-card glass-panel"><div className="memory-search"><Search size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a topic, project, or decision..." /></div><div className="memory-chips"><span>Try</span>{['launch date', 'hardware', 'onboarding'].map((term) => <button key={term} onClick={() => setQuery(term)}>{term}</button>)}</div></section>
      <section className="memory-results">
        <div className="results-caption"><strong>{topics.length} results</strong><span>From saved summaries and transcripts</span></div>
        {topics.map((item, index) => <article className="memory-result glass-panel" key={`${item.meeting.id}-${index}`}><span className="memory-result-icon"><MessageCircleMore size={18} /></span><div><small>{item.meeting.title} <i>·</i> {item.meeting.date}</small><h3>{item.label}</h3><p>{item.text}</p><Link to={`/meetings/${item.meeting.id}`}>Open meeting <ArrowRight size={14} /></Link></div></article>)}
        {!topics.length && <section className="content-card glass-panel"><BlankSlate icon={Search} title={meetings.some((meeting) => meeting.summary || meeting.transcript) ? 'Nothing matched that search' : 'No meeting text to search'} description={meetings.some((meeting) => meeting.summary || meeting.transcript) ? 'Try another phrase or choose a suggested topic above.' : 'Summaries and transcripts are not generated automatically.'} /></section>}
      </section>
    </div>
  )
}

export function AIChat() {
  const { meetings } = useAppData()
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'AI chat is not connected. You can search saved meeting titles, summaries, and transcripts locally; no AI service will be contacted.' }])
  const [draft, setDraft] = useState('')
  const send = (event) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    const searchTerm = text.toLowerCase().split(/\s+/).find((word) => word.length > 4) || text.toLowerCase()
    const found = meetings.filter((meeting) => `${meeting.title} ${meeting.summary || ''} ${meeting.transcript || ''}`.toLowerCase().includes(searchTerm))
    const response = found.length
      ? `Local keyword search found ${found.length} meeting${found.length === 1 ? '' : 's'}: ${found.map((meeting) => meeting.title).join(', ')}. This is not an AI-generated answer.`
      : 'No matching saved meeting text was found. AI chat and semantic search are not connected.'
    setMessages((current) => [...current, { role: 'user', text }, { role: 'assistant', text: response }])
    setDraft('')
  }
  return (
    <div className="workspace-page chat-page">
      <PageIntro eyebrow="Ask your meeting memory" title="AI Chat" description="Explore your meeting history with a conversational interface." />
      <section className="chat-card glass-panel">
        <div className="chat-context"><span className="chat-context-icon"><Sparkles size={17} /></span><div><strong>Meeting assistant</strong><small>Demo mode <i /> Sample data only</small></div><span className="context-count">{meetings.length} meetings</span></div>
        <div className="chat-messages">
          {messages.map((message, index) => <div className={`chat-message message-${message.role}`} key={index}><span className="chat-avatar">{message.role === 'assistant' ? <AudioLines size={16} /> : 'A'}</span><div><small>{message.role === 'assistant' ? 'ConvoIQ assistant' : 'You'}</small><p>{message.text}</p></div></div>)}
          {messages.length === 1 && <div className="chat-suggestions"><span>Try a local keyword search</span>{['launch date', 'hardware', 'onboarding'].map((suggestion) => <button key={suggestion} onClick={() => setDraft(suggestion)}>{suggestion}</button>)}</div>}
        </div>
        <form className="chat-composer" onSubmit={send}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask a question about your meetings..." aria-label="Message the meeting assistant" /><button className="send-button" aria-label="Send message" disabled={!draft.trim()}><Send size={17} /></button></form>
        <p className="chat-disclaimer">Responses are simulated for this frontend demo and may not be accurate.</p>
      </section>
    </div>
  )
}

export function Analytics() {
  const { meetings } = useAppData()
  const withAudio = meetings.filter((meeting) => meeting.audioUrl).length
  const completed = meetings.filter((meeting) => meeting.status === 'Completed').length
  const processing = meetings.filter((meeting) => ['Recording', 'Processing'].includes(meeting.status)).length
  const scheduled = meetings.filter((meeting) => meeting.status === 'Scheduled').length
  return (
    <div className="workspace-page">
      <PageIntro eyebrow="Workspace activity" title="Analytics" description="Counts below are calculated from meetings returned by the backend. Trend and task analytics are not available." />
      <div className="analytics-stat-grid">
        {[[meetings.length, 'Meetings', 'Saved in MongoDB'], [withAudio, 'Meetings with audio', 'Recording attached'], [completed, 'Completed', 'Backend meeting status'], [processing, 'Recording or processing', 'Backend meeting status']].map(([value, label, footnote], index) => <article className={`analytics-stat glass-panel analytics-tone-${index}`} key={label}><span>{label}</span><strong>{value}</strong><small>{footnote}</small></article>)}
      </div>
      <section className="content-card glass-panel"><h3>Other analytics unavailable</h3><p className="muted-copy">The backend does not currently provide historical trends, meeting categories, task totals, or transcription accuracy.</p><p className="muted-copy">Scheduled meetings: {scheduled}</p></section>
    </div>
  )
}

export function Settings() {
  const [saved, setSaved] = useState(false)
  const [preferences, setPreferences] = useState({ summaries: true, reminders: true, weekly: false })
  const toggle = (name) => { setPreferences((current) => ({ ...current, [name]: !current[name] })); setSaved(false) }
  return (
    <div className="workspace-page">
      <PageIntro eyebrow="Workspace preferences" title="Settings" description="Manage your profile, notifications, and device preferences." />
      <div className="settings-layout">
        <nav className="settings-nav glass-panel"><a className="settings-nav-active" href="#profile">Profile</a><a href="#notifications">Notifications</a><a href="#device">Device</a><a href="#privacy">Privacy</a></nav>
        <div className="settings-content">
          <section className="content-card glass-panel settings-section" id="profile"><div className="settings-section-head"><div><h3>Profile</h3><p>Your personal workspace information.</p></div><span className="avatar-large">A</span></div><div className="settings-fields"><label>Full name<input defaultValue="Alex Morgan" /></label><label>Email address<input defaultValue="alex@workspace.com" type="email" /></label><label>Workspace name<input defaultValue="ConvoIQ Demo Workspace" /></label></div></section>
          <section className="content-card glass-panel settings-section" id="notifications"><h3>Notifications</h3><p>Choose the updates you’d like to receive.</p>{[['summaries', 'Meeting summaries', 'When a meeting summary is ready'], ['reminders', 'Task reminders', 'Upcoming action item due dates'], ['weekly', 'Weekly digest', 'A weekly overview of workspace activity']].map(([name, title, detail]) => <div className="toggle-row" key={name}><span><strong>{title}</strong><small>{detail}</small></span><button role="switch" aria-checked={preferences[name]} className={`toggle ${preferences[name] ? 'toggle-on' : ''}`} onClick={() => toggle(name)}><i /></button></div>)}</section>
          <section className="content-card glass-panel settings-section" id="device"><h3>Meeting device</h3><p>Hardware controls are not connected in this demo.</p><div className="device-settings-row"><span className="device-settings-icon"><AudioLines size={19} /></span><span><strong>ESP32-S3 recorder</strong><small>Not connected · Simulation preview only</small></span><span className="status-pill status-pending">Demo mode</span></div></section>
          <section className="content-card glass-panel settings-section" id="privacy"><h3>Privacy & data</h3><p>Meetings and uploaded recordings are stored by the backend. Tasks, decisions, and preferences are local demo data.</p><div className="privacy-chip"><CheckCircle2 size={16} /> No external AI or device service is configured.</div></section>
          <div className="settings-save-row"><span>{saved ? 'Preferences saved in this session.' : ''}</span><button className="button-primary" onClick={() => setSaved(true)}><Check size={15} /> Save preferences</button></div>
        </div>
      </div>
    </div>
  )
}
