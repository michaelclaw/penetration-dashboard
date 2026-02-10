import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../../services/api'
import { useNotifications } from '../../contexts/NotificationContext'
import { useAuth } from '../../contexts/AuthContext'
import './ControlsConfig.css'

function ControlsConfig() {
  const { showNotification } = useNotifications()
  const { user } = useAuth()
  const PROFILE_STORAGE_KEY = 'recon_dashboard_profile'
  const profileStorageKey = useMemo(() => {
    const userKey = user?.profile?.sub || user?.profile?.preferred_username || user?.profile?.email
    return `${PROFILE_STORAGE_KEY}:${userKey || 'local'}`
  }, [user])
  const [toolStatus, setToolStatus] = useState([])
  const [toolsLoading, setToolsLoading] = useState(true)
  const [installing, setInstalling] = useState({})
  const [selectedProfile, setSelectedProfile] = useState(() => {
    return localStorage.getItem(profileStorageKey) || 'Standard external'
  })

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === profileStorageKey) {
        setSelectedProfile(event.newValue || 'Standard external')
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [profileStorageKey])

  const profiles = [
    { name: 'Standard external', description: 'subdomains + DNS + HTTP + basic OSINT links' },
    { name: 'OSINT-heavy', description: 'manual OSINT links; minimal active probing' },
    { name: 'Stealth', description: 'low-rate DNS/HTTP, no port sweeps' },
    { name: 'Custom profile...', description: 'edit modules, rate limits, wordlists' }
  ]


  const fetchToolStatus = async () => {
    setToolsLoading(true)
    try {
      const data = await api.getToolStatus()
      setToolStatus(data.tools || [])
    } catch (error) {
      showNotification(error.message || 'Failed to load tool status', 'error')
    } finally {
      setToolsLoading(false)
    }
  }

  useEffect(() => {
    fetchToolStatus()
  }, [])

  useEffect(() => {
    localStorage.setItem(profileStorageKey, selectedProfile)
  }, [selectedProfile, profileStorageKey])

  useEffect(() => {
    const stored = localStorage.getItem(profileStorageKey) || 'Standard external'
    setSelectedProfile(stored)
  }, [profileStorageKey])

  const handleInstall = async (toolId) => {
    setInstalling(prev => ({ ...prev, [toolId]: true }))
    try {
      const result = await api.installTool(toolId)
      showNotification(result.message || 'Installation complete', result.installed ? 'success' : 'warning')
      setToolStatus(result.tools || [])
    } catch (error) {
      showNotification(error.message || 'Tool installation failed', 'error')
    } finally {
      setInstalling(prev => ({ ...prev, [toolId]: false }))
    }
  }

  return (
    <div className="controls-config">
      <h3 className="section-title">Controls & Config Shortcuts</h3>
      
      <div className="recon-profiles">
        <h4 className="subsection-title">Recon profiles:</h4>
        <div className="profiles-list">
          {profiles.map((profile, idx) => (
            <div
              key={idx}
              className={`profile-card ${selectedProfile === profile.name ? 'active' : ''}`}
              onClick={() => {
                setSelectedProfile(profile.name)
                localStorage.setItem(profileStorageKey, profile.name)
                window.dispatchEvent(new CustomEvent('recon_profile_changed', { detail: profile.name }))
                showNotification(`Selected profile: ${profile.name}`, 'info')
              }}
            >
              <div className="profile-name">
                <strong>{profile.name}</strong>
              </div>
              <div className="profile-description">{profile.description}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="tools-status">
        <h4 className="subsection-title">Tool status (Kali):</h4>
        <p className="tools-hint">Red buttons mean missing tools. Click to install on the backend.</p>
        <div className="tools-grid">
          {toolsLoading && (
            <div className="tools-loading">Checking tool availability...</div>
          )}
          {!toolsLoading && toolStatus.length === 0 && (
            <div className="tools-loading">No tool status available.</div>
          )}
          {!toolsLoading && toolStatus.map(tool => {
            const isInstalling = Boolean(installing[tool.id])
            const isDisabled = tool.installed || isInstalling || !tool.installable
            return (
              <button
                key={tool.id}
                className={`tool-btn ${tool.installed ? 'tool-ok' : 'tool-missing'}`}
                onClick={() => handleInstall(tool.id)}
                disabled={isDisabled}
                title={tool.installed ? 'Installed' : (tool.installable ? 'Click to install' : 'Not installable')}
              >
                <span className="tool-label">{tool.label}</span>
                <span className="tool-status-text">
                  {isInstalling ? 'Installing...' : (tool.installed ? 'Installed' : 'Missing')}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default ControlsConfig
