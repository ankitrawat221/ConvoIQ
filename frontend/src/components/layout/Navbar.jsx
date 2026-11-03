import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronDown, Command, Menu, Search, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function Navbar({ title, subtitle, onMenu, meetings, tasks, decisions }) {
  const [search, setSearch] = useState('')
  const [openMenu, setOpenMenu] = useState('')
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const matches = search.trim()
    ? [
      ...meetings.filter((item) => item.title.toLowerCase().includes(search.toLowerCase())).map((item) => ({ label: item.title, meta: 'Meeting', to: `/meetings/${item.id}` })),
      ...tasks.filter((item) => item.title.toLowerCase().includes(search.toLowerCase())).map((item) => ({ label: item.title, meta: 'Task', to: '/tasks' })),
      ...decisions.filter((item) => item.title.toLowerCase().includes(search.toLowerCase())).map((item) => ({ label: item.title, meta: 'Decision', to: '/decisions' })),
    ].slice(0, 5)
    : []

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
      }
      if (event.key === 'Escape') {
        setSearch('')
        setOpenMenu('')
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  return (
    <header className="topbar">
      <button className="icon-button mobile-nav-trigger" onClick={onMenu} aria-label="Open navigation"><Menu size={21} /></button>
      <div className="page-heading">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="topbar-tools">
        <div className="search-wrap">
          <Search size={19} className="search-icon" />
          <input
            ref={inputRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && matches[0]) navigate(matches[0].to)
            }}
            placeholder="Search meetings, tasks, or decisions..."
            aria-label="Search meetings, tasks, or decisions"
          />
          <kbd><Command size={12} /> K</kbd>
          {search && <div className="search-results">
            {matches.length ? matches.map((item) => (
              <button key={`${item.meta}-${item.label}`} onClick={() => { navigate(item.to); setSearch('') }}>
                <span>{item.label}</span><small>{item.meta}</small>
              </button>
            )) : <p>No matching meetings, tasks, or decisions.</p>}
          </div>}
        </div>
        <div className="menu-anchor">
          <button className={`icon-button notification-button ${openMenu === 'notifications' ? 'selected' : ''}`} aria-label="Notifications" onClick={() => setOpenMenu(openMenu === 'notifications' ? '' : 'notifications')}>
            <Bell size={20} /><i />
          </button>
          {openMenu === 'notifications' && <div className="popover notification-popover">
            <strong>Notifications</strong>
            <p><span className="notification-dot" /> Your Project Progress Review summary is ready.</p>
            <p><span className="notification-dot blue-dot" /> 2 tasks are due this week.</p>
          </div>}
        </div>
        <div className="menu-anchor">
          <button className="avatar-button" aria-label="Open profile menu" onClick={() => setOpenMenu(openMenu === 'profile' ? '' : 'profile')}>A</button>
          {openMenu === 'profile' && <div className="popover profile-popover">
            <div className="profile-popover-user"><span className="avatar-small">A</span><div><strong>Alex Morgan</strong><small>Workspace admin</small></div></div>
            <button onClick={() => navigate('/settings')}><UserRound size={15} /> Account settings</button>
            <button onClick={() => navigate('/settings')}><ChevronDown size={15} /> Workspace options</button>
          </div>}
        </div>
      </div>
    </header>
  )
}
