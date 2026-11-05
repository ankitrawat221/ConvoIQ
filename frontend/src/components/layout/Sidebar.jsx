import {
  AudioLines,
  BarChart3,
  Bot,
  CheckSquare2,
  ChevronRight,
  CircleHelp,
  Gavel,
  FolderKanban,
  House,
  Layers3,
  Menu,
  Settings,
  Video,
  Wifi,
  X,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import puckImage from '../../assets/esp32-puck-clean.png'

const links = [
  { label: 'Dashboard', to: '/', icon: House, end: true },
  { label: 'Meetings', to: '/meetings', icon: Video },
  { label: 'Workspaces', to: '/workspaces', icon: FolderKanban },
  { label: 'Tasks', to: '/tasks', icon: CheckSquare2 },
  { label: 'Decisions', to: '/decisions', icon: Gavel },
  { label: 'Memory', to: '/memory', icon: Layers3 },
  { label: 'AI Chat', to: '/chat', icon: Bot },
  { label: 'Analytics', to: '/analytics', icon: BarChart3 },
  { label: 'Settings', to: '/settings', icon: Settings },
]

export function Sidebar({ open, onClose }) {
  return (
    <>
      {open && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <span className="brand-mark"><AudioLines size={28} strokeWidth={2.6} /></span>
          <span className="brand-name">ConvoIQ<span>AI Meeting Assistant</span></span>
          <button className="icon-button sidebar-close" aria-label="Close navigation" onClick={onClose}><X size={19} /></button>
        </div>
        <nav className="side-nav" aria-label="Main navigation">
          {links.map(({ label, to, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={onClose} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={20} strokeWidth={2} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="device-mini glass-card">
            <div className="device-mini-image"><img src={puckImage} alt="ESP32-S3 meeting device" /></div>
            <div className="device-mini-copy">
              <strong>Meeting Device</strong>
              <span>ESP32-S3</span>
              <span className="connection"><i /> Demo mode</span>
            </div>
            <Wifi size={16} className="device-wifi" />
          </div>
          <button className="help-link"><CircleHelp size={17} /> Help center <ChevronRight size={15} /></button>
        </div>
        <button className="mobile-menu-handle" onClick={onClose} aria-label="Toggle navigation"><Menu size={18} /></button>
      </aside>
    </>
  )
}
