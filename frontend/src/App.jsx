import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout.jsx'
import { initialDecisions, initialMeetings, initialTasks } from './data/mockData.js'
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
  const [meetings] = useState(initialMeetings)
  const [audio, setAudio] = useState(null)

  useEffect(() => {
    window.localStorage.setItem('convoiq-tasks', JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    window.localStorage.setItem('convoiq-decisions', JSON.stringify(decisions))
  }, [decisions])

  useEffect(() => () => {
    if (audio?.url) URL.revokeObjectURL(audio.url)
  }, [audio])

  const context = useMemo(() => ({
    meetings,
    tasks,
    setTasks,
    decisions,
    setDecisions,
    audio,
    setAudio,
  }), [meetings, tasks, decisions, audio])

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
