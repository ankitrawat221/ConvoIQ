import { useCallback, useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout.jsx'
import { initialDecisions, initialTasks } from './data/mockData.js'
import { createMeeting, deleteMeeting, getMeetings, updateMeeting } from './services/api.js'
import Dashboard from './pages/Dashboard.jsx'
import {
  AIChat,
  Analytics,
  Decisions,
  MeetingDetails,
  Meetings,
  Memory,
  Settings,
  Tasks,
} from './pages/WorkspacePages.jsx'

function readStored(key, fallback) {
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

function App() {
  const [tasks, setTasks] = useState(() => readStored('convoiq-tasks', initialTasks))
  const [decisions, setDecisions] = useState(() => readStored('convoiq-decisions', initialDecisions))
  const [meetings, setMeetings] = useState([])
  const [meetingsLoading, setMeetingsLoading] = useState(true)
  const [meetingsError, setMeetingsError] = useState('')

  const refreshMeetings = useCallback(async () => {
    setMeetingsLoading(true)
    setMeetingsError('')
    try {
      setMeetings(await getMeetings())
    } catch (error) {
      setMeetingsError(error.message)
      return null
    } finally {
      setMeetingsLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    getMeetings().then((items) => {
      if (active) setMeetings(items)
    }).catch((error) => {
      if (active) setMeetingsError(error.message)
    }).finally(() => {
      if (active) setMeetingsLoading(false)
    })
    return () => { active = false }
  }, [])

  const addMeeting = useCallback(async (meeting) => {
    const created = await createMeeting(meeting)
    await refreshMeetings()
    return created
  }, [refreshMeetings])

  const saveMeeting = useCallback(async (id, meeting) => {
    const updated = await updateMeeting(id, meeting)
    await refreshMeetings()
    return updated
  }, [refreshMeetings])

  const removeMeeting = useCallback(async (id) => {
    await deleteMeeting(id)
    await refreshMeetings()
  }, [refreshMeetings])

  useEffect(() => {
    window.localStorage.setItem('convoiq-tasks', JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    window.localStorage.setItem('convoiq-decisions', JSON.stringify(decisions))
  }, [decisions])

  const context = useMemo(() => ({
    meetings,
    meetingsLoading,
    meetingsError,
    refreshMeetings,
    addMeeting,
    saveMeeting,
    removeMeeting,
    tasks,
    setTasks,
    decisions,
    setDecisions,
  }), [meetings, meetingsLoading, meetingsError, refreshMeetings, addMeeting, saveMeeting, removeMeeting, tasks, decisions])

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout context={context} />}>
          <Route index element={<Dashboard />} />
          <Route path="meetings" element={<Meetings />} />
          <Route path="meetings/:meetingId" element={<MeetingDetails />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="decisions" element={<Decisions />} />
          <Route path="memory" element={<Memory />} />
          <Route path="chat" element={<AIChat />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
