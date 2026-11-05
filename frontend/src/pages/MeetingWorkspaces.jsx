import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  CalendarDays,
  Clock3,
  FolderKanban,
  MessageCircleMore,
  MoveRight,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Unlink,
  Upload,
  UsersRound,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import useAppData from '../components/layout/useAppData.js'
import {
  askWorkspaceQuestion,
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  getWorkspaceMeetings,
  getWorkspaces,
  updateMeetingWorkspace,
  updateWorkspace,
} from '../services/api.js'

function localDateTimeInput() {
  const date = new Date()
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function formatWorkspaceDate(value) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function WorkspaceForm({ workspace, onSave, onCancel, error, saving }) {
  const [name, setName] = useState(workspace?.name || '')
  const [description, setDescription] = useState(workspace?.description || '')

  const submit = (event) => {
    event.preventDefault()
    onSave({ name: name.trim(), description: description.trim() })
  }

  return (
    <form className="inline-form workspace-form" onSubmit={submit}>
      <div className="form-heading">
        <strong>{workspace ? 'Rename workspace' : 'Create a workspace'}</strong>
        <span>Keep related meetings together.</span>
      </div>
      <label>Workspace name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} /></label>
      <label>Description<input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="What is this workspace for?" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="button-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save workspace'}</button>
      </div>
    </form>
  )
}

export function WorkspacesPage() {
  const { refreshMeetings } = useAppData()
  const [workspaces, setWorkspaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formWorkspace, setFormWorkspace] = useState(undefined)
  const [saving, setSaving] = useState(false)

  const loadWorkspaces = useCallback(async () => {
    try {
      setWorkspaces(await getWorkspaces())
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    getWorkspaces().then((items) => {
      if (active) setWorkspaces(items)
    }).catch((requestError) => {
      if (active) setError(requestError.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  const saveWorkspace = async (data) => {
    setSaving(true)
    setError('')
    try {
      if (formWorkspace) {
        await updateWorkspace(formWorkspace.id, data)
      } else {
        await createWorkspace(data)
      }
      setFormWorkspace(undefined)
      await loadWorkspaces()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const removeWorkspace = async (workspace) => {
    if (!window.confirm(`Delete "${workspace.name}"? Its meetings will remain in All meetings.`)) return
    setError('')
    try {
      await deleteWorkspace(workspace.id)
      await refreshMeetings()
      await loadWorkspaces()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <div className="workspace-page">
      <div className="workspace-intro">
        <div>
          <span className="eyebrow">Organize your conversations</span>
          <h2>Workspaces</h2>
          <p>Group related meetings without duplicating them.</p>
        </div>
        <button className="button-primary" onClick={() => { setError(''); setFormWorkspace(null) }}><Plus size={16} /> Create workspace</button>
      </div>

      {formWorkspace !== undefined && (
        <WorkspaceForm
          key={formWorkspace?.id || 'new'}
          workspace={formWorkspace || undefined}
          onSave={saveWorkspace}
          onCancel={() => { setFormWorkspace(undefined); setError('') }}
          error={error}
          saving={saving}
        />
      )}
      {error && formWorkspace === undefined && <p className="form-error" role="alert">{error}</p>}

      {loading ? <section className="content-card glass-panel"><p className="muted-copy">Loading workspaces…</p></section>
        : workspaces.length ? <section className="workspace-card-grid" aria-label="Workspaces">
          {workspaces.map((workspace) => (
            <article className="workspace-card glass-panel" key={workspace.id}>
              <div className="workspace-card-top">
                <span className="workspace-card-icon"><FolderKanban size={20} /></span>
                <div className="workspace-card-controls">
                  <button className="subtle-icon" aria-label={`Rename ${workspace.name}`} onClick={() => { setFormWorkspace(workspace); setError('') }}><Pencil size={16} /></button>
                  <button className="subtle-icon workspace-delete" aria-label={`Delete ${workspace.name}`} onClick={() => removeWorkspace(workspace)}><Trash2 size={16} /></button>
                </div>
              </div>
              <Link to={`/workspaces/${workspace.id}`} className="workspace-card-link">
                <h3>{workspace.name}</h3>
                <p>{workspace.description || 'No description yet.'}</p>
                <div className="workspace-card-meta">
                  <span><AudioLines size={14} /> {workspace.meetingCount || 0} meetings</span>
                  {workspace.recentMeeting && <small>Recent: {workspace.recentMeeting.title} · {formatWorkspaceDate(workspace.recentMeeting.meetingDate)}</small>}
                </div>
                <span className="workspace-open-link">Open workspace <ArrowRight size={15} /></span>
              </Link>
            </article>
          ))}
        </section> : <section className="content-card glass-panel"><div className="empty-state"><span><FolderKanban size={23} /></span><strong>No workspaces yet</strong><p>Create a workspace to organize related meetings.</p></div></section>}
    </div>
  )
}

function WorkspaceMeetingForm({ workspaceId, onCreated, onCancel, error, saving }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [meetingDate, setMeetingDate] = useState(localDateTimeInput)
  const [participants, setParticipants] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    await onCreated({
      workspaceId,
      title: title.trim(),
      description: description.trim(),
      meetingDate: new Date(meetingDate).toISOString(),
      participants: participants.split(',').map((name) => name.trim()).filter(Boolean).map((name) => ({ name })),
    })
  }

  return (
    <form className="inline-form workspace-meeting-form" onSubmit={submit}>
      <div className="form-heading"><strong>Create meeting in this workspace</strong><span>The meeting will also remain visible in All meetings.</span></div>
      <label>Title<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={150} /></label>
      <label>Description<input value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <div className="form-two-col">
        <label>Date and time<input type="datetime-local" value={meetingDate} onChange={(event) => setMeetingDate(event.target.value)} required /></label>
        <label>Participants<input value={participants} onChange={(event) => setParticipants(event.target.value)} placeholder="Names separated by commas" /></label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="button-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="button-primary" disabled={saving}>{saving ? 'Saving…' : 'Create meeting'}</button>
      </div>
    </form>
  )
}

export function WorkspaceDetailPage() {
  const { workspaceId } = useParams()
  const { meetings, meetingsLoading, meetingsError, refreshMeetings, addMeeting, openUpload } = useAppData()
  const [workspace, setWorkspace] = useState(null)
  const [workspaceMeetings, setWorkspaceMeetings] = useState([])
  const [workspaces, setWorkspaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newMeetingOpen, setNewMeetingOpen] = useState(false)
  const [meetingFormError, setMeetingFormError] = useState('')
  const [creatingMeeting, setCreatingMeeting] = useState(false)
  const [selectedMeetingId, setSelectedMeetingId] = useState('')
  const [savingMeetingId, setSavingMeetingId] = useState('')
  const [question, setQuestion] = useState('')
  const [chatError, setChatError] = useState('')
  const [asking, setAsking] = useState(false)

  const loadWorkspace = useCallback(async () => {
    setError('')
    try {
      const [nextWorkspace, nextMeetings, nextWorkspaces] = await Promise.all([
        getWorkspace(workspaceId),
        getWorkspaceMeetings(workspaceId),
        getWorkspaces(),
      ])
      setWorkspace(nextWorkspace)
      setWorkspaceMeetings(nextMeetings)
      setWorkspaces(nextWorkspaces)
    } catch (requestError) {
      setError(requestError.message)
    }
  }, [workspaceId])

  useEffect(() => {
    let active = true
    Promise.all([
      getWorkspace(workspaceId),
      getWorkspaceMeetings(workspaceId),
      getWorkspaces(),
    ]).then(([nextWorkspace, nextMeetings, nextWorkspaces]) => {
      if (!active) return
      setWorkspace(nextWorkspace)
      setWorkspaceMeetings(nextMeetings)
      setWorkspaces(nextWorkspaces)
    }).catch((requestError) => {
      if (active) setError(requestError.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [workspaceId])

  const refreshData = async () => {
    setError('')
    await Promise.all([loadWorkspace(), refreshMeetings()])
  }

  const createWorkspaceMeeting = async (meeting) => {
    setCreatingMeeting(true)
    setMeetingFormError('')
    try {
      await addMeeting(meeting)
      setNewMeetingOpen(false)
      await refreshData()
    } catch (requestError) {
      setMeetingFormError(requestError.message)
    } finally {
      setCreatingMeeting(false)
    }
  }

  const assignMeeting = async (meetingId, nextWorkspaceId) => {
    setSavingMeetingId(meetingId)
    setError('')
    try {
      await updateMeetingWorkspace(meetingId, nextWorkspaceId)
      await refreshData()
      return true
    } catch (requestError) {
      setError(requestError.message)
      return false
    } finally {
      setSavingMeetingId('')
    }
  }

  const addExistingMeeting = async (event) => {
    event.preventDefault()
    if (!selectedMeetingId) return
    if (await assignMeeting(selectedMeetingId, workspaceId)) setSelectedMeetingId('')
  }

  const askQuestion = async (event) => {
    event.preventDefault()
    if (!question.trim()) return
    setAsking(true)
    setChatError('')
    try {
      await askWorkspaceQuestion(workspaceId, question.trim())
      setQuestion('')
    } catch (requestError) {
      setChatError(requestError.message)
    } finally {
      setAsking(false)
    }
  }

  if (loading) return <div className="workspace-page"><Link to="/workspaces" className="back-link"><ArrowLeft size={16} /> Workspaces</Link><section className="content-card glass-panel"><p className="muted-copy">Loading workspace…</p></section></div>
  if (error && !workspace) return <div className="workspace-page"><Link to="/workspaces" className="back-link"><ArrowLeft size={16} /> Workspaces</Link><section className="content-card glass-panel"><div className="empty-state"><strong>Could not load workspace</strong><p>{error}</p></div></section></div>
  if (!workspace) return <div className="workspace-page"><Link to="/workspaces" className="back-link"><ArrowLeft size={16} /> Workspaces</Link><section className="content-card glass-panel"><div className="empty-state"><strong>Workspace not found</strong></div></section></div>

  const availableMeetings = meetings.filter((meeting) => meeting.workspaceId !== workspaceId)

  return (
    <div className="workspace-page">
      <Link to="/workspaces" className="back-link"><ArrowLeft size={16} /> All workspaces</Link>
      <div className="meeting-detail-header glass-panel">
        <div className="detail-title-line">
          <span className="detail-icon"><FolderKanban size={22} /></span>
          <div><span className="eyebrow">Meeting workspace</span><h2>{workspace.name}</h2></div>
          <span className="workspace-count">{workspaceMeetings.length} meetings</span>
          <div className="detail-actions">
            <button className="button-secondary" onClick={() => openUpload(workspaceId, loadWorkspace)}><Upload size={15} /> Upload audio</button>
            <button className="button-secondary" onClick={() => setNewMeetingOpen((open) => !open)}><Plus size={15} /> New meeting</button>
          </div>
        </div>
        {workspace.description && <p className="meeting-description">{workspace.description}</p>}
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {newMeetingOpen && <WorkspaceMeetingForm workspaceId={workspaceId} onCreated={createWorkspaceMeeting} onCancel={() => { setNewMeetingOpen(false); setMeetingFormError('') }} error={meetingFormError} saving={creatingMeeting} />}

      <section className="content-card glass-panel">
        <div className="workspace-section-heading">
          <div><span className="eyebrow">Workspace library</span><h3>Meetings</h3></div>
          <button className="button-secondary" onClick={() => refreshData()}><ArrowRight size={15} /> Refresh</button>
        </div>
        <form className="workspace-add-meeting" onSubmit={addExistingMeeting}>
          <label htmlFor="workspace-existing-meeting">Add or move an existing meeting</label>
          <select id="workspace-existing-meeting" value={selectedMeetingId} onChange={(event) => setSelectedMeetingId(event.target.value)} disabled={meetingsLoading || availableMeetings.length === 0}>
            <option value="">Select a meeting…</option>
            {availableMeetings.map((meeting) => <option value={meeting.id} key={meeting.id}>{meeting.title}{meeting.workspaceId ? ` · ${workspaces.find((item) => item.id === meeting.workspaceId)?.name || 'Another workspace'}` : ' · Unassigned'}</option>)}
          </select>
          <button className="button-primary" disabled={!selectedMeetingId || Boolean(savingMeetingId)}><MoveRight size={15} /> Add to workspace</button>
        </form>
        {meetingsError && <p className="form-error" role="alert">Could not load all meetings: {meetingsError}</p>}
        {workspaceMeetings.length ? <div className="workspace-meetings">
          {workspaceMeetings.map((meeting) => (
            <article className="workspace-meeting-row glass-inner-card" key={meeting.id}>
              <span className="table-icon"><AudioLines size={17} /></span>
              <Link to={`/meetings/${meeting.id}`} className="workspace-meeting-main">
                <strong>{meeting.title}</strong>
                <small><CalendarDays size={13} /> {formatWorkspaceDate(meeting.meetingDate)} <span>·</span> <Clock3 size={13} /> {meeting.duration} <span>·</span> <UsersRound size={13} /> {meeting.participantCount}</small>
              </Link>
              <label className="workspace-move-control"><span>Move to</span>
                <select value={workspaceId} onChange={(event) => assignMeeting(meeting.id, event.target.value || null)} disabled={savingMeetingId === meeting.id} aria-label={`Move ${meeting.title} to another workspace`}>
                  <option value={workspaceId}>{workspace.name}</option>
                  <option value="">Unassigned</option>
                  {workspaces.filter((item) => item.id !== workspaceId).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                </select>
              </label>
              <button className="subtle-icon workspace-unlink" aria-label={`Remove ${meeting.title} from workspace`} onClick={() => assignMeeting(meeting.id, null)} disabled={savingMeetingId === meeting.id}><Unlink size={16} /></button>
            </article>
          ))}
        </div> : <div className="empty-state"><span><AudioLines size={22} /></span><strong>No meetings in this workspace</strong><p>Add an existing meeting or create a new one here.</p></div>}
      </section>

      <section className="content-card glass-panel workspace-chat-card">
        <div className="workspace-section-heading">
          <div><span className="eyebrow">Isolated meeting context</span><h3><MessageCircleMore size={18} /> Workspace AI chat</h3></div>
          <span className="workspace-ai-status">Not connected</span>
        </div>
        <p className="muted-copy">AI chat and long-term memory are not integrated yet. No answers are generated. When enabled, requests must retrieve only this workspace’s meetings.</p>
        <form className="chat-composer" onSubmit={askQuestion}>
          <input value={question} onChange={(event) => { setQuestion(event.target.value); setChatError('') }} placeholder={`Ask about ${workspace.name}…`} aria-label={`Ask a question about ${workspace.name}`} />
          <button className="send-button" aria-label="Send workspace question" disabled={!question.trim() || asking}>{asking ? <Sparkles size={16} /> : <Send size={17} />}</button>
        </form>
        {chatError && <p className="form-error" role="alert">{chatError}</p>}
        <p className="chat-disclaimer">Your question is sent to the workspace-scoped API, which reports that AI is unavailable rather than returning a simulated answer.</p>
      </section>
    </div>
  )
}
