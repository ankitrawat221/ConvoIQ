import { useEffect, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileAudio2,
  FileText,
  MessageCircleMore,
  MoreVertical,
  Pause,
  Play,
  Radio,
  Square,
  Sparkles,
  UsersRound,
  Volume2,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import puckImage from '../assets/esp32-puck-clean.png'
import useAppData from '../components/layout/useAppData.js'

const waveform = [10, 14, 8, 18, 12, 24, 16, 11, 28, 17, 38, 20, 13, 30, 18, 26, 12, 35, 18, 11, 25, 16, 32, 13, 21, 10, 16, 28, 12, 20, 9]
const dashboardNow = Date.now()

function StatCard({ item }) {
  const Icon = item.icon
  return (
    <article className={`stat-card stat-${item.tone} glass-card`}>
      <div className="stat-icon"><Icon size={28} strokeWidth={2.2} /></div>
      <div className="stat-copy"><strong>{item.value}</strong><span>{item.label}</span></div>
      {item.delta && <span className="stat-delta"><ArrowUpRight size={14} /> {item.delta}</span>}
    </article>
  )
}

function DevicePanel() {
  const [recordState, setRecordState] = useState('idle')
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (recordState !== 'recording') return undefined
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [recordState])
  const time = [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
    .map((part) => String(part).padStart(2, '0')).join(':')
  const start = () => setRecordState('recording')

  return (
    <section className="device-panel glass-panel">
      <div className="panel-title-row">
        <div className="panel-title"><span className="device-status-dot" /><div><h2>Live Meeting Device</h2><p>ESP32-S3 <span className="dot-separator">·</span> <b>Simulation only</b></p></div></div>
        <span className="simulation-tag"><Radio size={13} /> Demo</span>
      </div>
      <div className="device-workspace">
        <div className="device-visual">
          <img src={puckImage} alt="ESP32-S3 puck-style recording device" />
          <span>Device preview</span>
        </div>
        <div className="recorder">
          <div className={`timer ${recordState === 'recording' ? 'timer-live' : ''}`}>{time}</div>
          <div className={`waveform ${recordState === 'recording' ? 'waveform-live' : ''}`} aria-label={recordState === 'recording' ? 'Recording waveform simulation' : 'Audio waveform preview'}>
            {waveform.map((height, index) => <i key={index} style={{ height: `${height}px`, animationDelay: `${index * 27}ms` }} />)}
          </div>
          <div className="record-controls">
            <button className={`record-button ${recordState === 'recording' ? 'is-recording' : ''}`} onClick={start} disabled={recordState === 'recording'}>
              <span /> {recordState === 'recording' ? 'Recording' : 'Record'}
            </button>
            <button className="control-button" onClick={() => setRecordState(recordState === 'paused' ? 'recording' : 'paused')} disabled={recordState === 'idle' || recordState === 'stopped'}>
              {recordState === 'paused' ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />} {recordState === 'paused' ? 'Resume' : 'Pause'}
            </button>
            <button className="control-button" onClick={() => { setRecordState('stopped'); setSeconds(0) }} disabled={recordState === 'idle' || recordState === 'stopped'}>
              <Square size={12} fill="currentColor" /> Stop
            </button>
          </div>
        </div>
      </div>
      <p className="simulation-note"><Radio size={13} /> Controls are simulated; no ESP32 device is connected.</p>
    </section>
  )
}

function QuickActions({ openUpload, onGenerateSummary }) {
  const navigate = useNavigate()
  const actions = [
    { title: <>Upload<br />Audio</>, icon: FileAudio2, tone: 'purple', click: openUpload },
    { title: <>Generate<br />Summary</>, icon: FileText, tone: 'violet', click: onGenerateSummary },
    { title: <>Extract<br />Tasks</>, icon: CheckCircle2, tone: 'blue', click: () => navigate('/tasks') },
    { title: <>Ask AI</>, caption: '(Past Meetings)', icon: MessageCircleMore, tone: 'pink', click: () => navigate('/chat') },
  ]
  return (
    <section className="quick-panel glass-panel">
      <div className="section-heading"><Sparkles size={22} className="heading-icon" /><h2>AI Quick Actions</h2></div>
      <div className="quick-actions">
        {actions.map(({ title, caption, icon: Icon, tone, click }, index) => (
          <button key={index} className={`quick-action quick-${tone}`} onClick={click}>
            <span className="quick-icon"><Icon size={27} strokeWidth={2.2} /></span>
            <span className="quick-title">{title}</span>
            {caption && <small>{caption}</small>}
          </button>
        ))}
      </div>
    </section>
  )
}

function RecentMeetings({ meetings, loading }) {
  const recent = [...meetings]
    .sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime())
    .slice(0, 3)
  return (
    <section className="recent-panel glass-panel" id="recent-meetings">
      <div className="section-heading with-action"><h2>Recent Meetings</h2><Link to="/meetings" className="text-link">View All <ArrowRight size={16} /></Link></div>
      {loading ? <p className="muted-copy">Loading recent meetings…</p> : recent.length ? <div className="recent-list">
        {recent.map((meeting) => (
          <article className="recent-meeting glass-inner-card" key={meeting.id}>
            <Link to={`/meetings/${meeting.id}`} className="play-meeting" aria-label={`Open ${meeting.title}`}><Play size={16} fill="currentColor" /></Link>
            <Link to={`/meetings/${meeting.id}`} className="meeting-main">
              <strong>{meeting.title}</strong>
              <span className="meeting-meta"><span><CalendarDays size={14} />{meeting.date}</span><span><Clock3 size={14} />{meeting.duration}</span><span><UsersRound size={15} />{meeting.participantCount} participants</span></span>
            </Link>
            <span className={`status-pill status-${meeting.status.toLowerCase().replaceAll(' ', '-')}`}>{meeting.status}</span>
            <button className="subtle-icon" aria-label={`More options for ${meeting.title}`}><MoreVertical size={18} /></button>
          </article>
        ))}
      </div> : <p className="muted-copy">No meetings have been added yet.</p>}
    </section>
  )
}

function MeetingInsights({ meetings }) {
  const [range, setRange] = useState('Last 30 Days')
  const rangeMilliseconds = range === 'Last 7 Days' ? 7 * 86400000 : range === 'Last 30 Days' ? 30 * 86400000 : Infinity
  const rangeMeetings = meetings.filter((meeting) => {
    const meetingTime = new Date(meeting.meetingDate).getTime()
    if (range === 'This Year') return Number.isFinite(meetingTime) && new Date(meetingTime).getFullYear() === new Date(dashboardNow).getFullYear()
    return Number.isFinite(meetingTime) && dashboardNow - meetingTime <= rangeMilliseconds && meetingTime <= dashboardNow
  })
  const count = rangeMeetings.length
  const completed = rangeMeetings.filter((meeting) => meeting.status === 'Completed').length
  const processing = rangeMeetings.filter((meeting) => ['Recording', 'Processing'].includes(meeting.status)).length
  const pending = rangeMeetings.filter((meeting) => ['Scheduled', 'Failed'].includes(meeting.status)).length
  const completedPercent = count ? completed / count * 100 : 0
  const processingPercent = count ? processing / count * 100 : 0
  return (
    <section className="insights-panel glass-panel">
      <div className="section-heading with-action"><div className="heading-with-icon"><BarChartSymbol /><h2>Meeting Insights</h2></div>
        <select className="select-compact" value={range} onChange={(event) => setRange(event.target.value)} aria-label="Meeting insights date range">
          <option>Last 7 Days</option><option>Last 30 Days</option><option>This Year</option>
        </select>
      </div>
      <div className="insight-content">
        <div className="donut-chart" style={{ background: `conic-gradient(from -14deg, #a855f7 0 ${completedPercent}%, #3b82f6 ${completedPercent}% ${completedPercent + processingPercent}%, #dfe3f1 ${completedPercent + processingPercent}% 100%)` }}><div className="donut-center"><strong>{count}</strong><span>Meetings</span></div></div>
        <div className="insight-legend">
          <div><i className="legend-purple" /><span>Completed</span><strong>{completed}</strong></div>
          <div><i className="legend-blue" /><span>Recording / Processing</span><strong>{processing}</strong></div>
          <div><i className="legend-muted" /><span>Scheduled / Failed</span><strong>{pending}</strong></div>
        </div>
      </div>
    </section>
  )
}

function BarChartSymbol() {
  return <span className="bar-symbol"><i /><i /><i /><i /></span>
}

export default function Dashboard() {
  const { meetings, meetingsLoading, meetingsError, openUpload } = useAppData()
  const [summaryPreview, setSummaryPreview] = useState(false)
  const statItems = [
    { label: 'Meetings', value: meetings.length, icon: CalendarDays, tone: 'purple' },
    { label: 'With Audio', value: meetings.filter((meeting) => Boolean(meeting.audioUrl)).length, icon: FileAudio2, tone: 'blue' },
    { label: 'Completed', value: meetings.filter((meeting) => meeting.status === 'Completed').length, icon: CheckCircle2, tone: 'peach' },
    { label: 'Processing', value: meetings.filter((meeting) => ['Recording', 'Processing'].includes(meeting.status)).length, icon: AudioLines, tone: 'purple' },
  ]
  return (
    <div className="dashboard-page">
      {meetingsError && <p className="form-error" role="alert">Could not load meetings: {meetingsError}</p>}
      <section className="stats-grid" aria-label="Meeting statistics">
        {statItems.map((item) => <StatCard item={{ ...item, value: meetingsLoading ? '…' : item.value }} key={item.label} />)}
      </section>
      <div className="dashboard-primary-grid">
        <DevicePanel />
        <QuickActions openUpload={openUpload} onGenerateSummary={() => setSummaryPreview(true)} />
      </div>
      {summaryPreview && <section className="summary-preview glass-panel">
        <span className="summary-preview-icon"><Sparkles size={17} /></span>
        <div><strong>AI processing is not connected</strong><p>Audio uploads are stored with their meeting. Transcription, summaries, tasks, and decisions are not generated yet.</p><small>No AI service was contacted.</small></div>
        <button onClick={() => setSummaryPreview(false)} aria-label="Dismiss sample summary">×</button>
      </section>}
      <div className="dashboard-secondary-grid">
        <RecentMeetings meetings={meetings} loading={meetingsLoading} />
        <MeetingInsights meetings={meetings} />
      </div>
      <div className="dashboard-footnote"><Volume2 size={14} /> Meeting information is loaded from the backend. The live device panel remains a simulation.</div>
    </div>
  )
}
