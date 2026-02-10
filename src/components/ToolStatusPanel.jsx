import React, { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useNotifications } from '../contexts/NotificationContext'
import './recon/ControlsConfig.css'

function ToolStatusPanel() {
  const { showNotification } = useNotifications()
  const [toolStatus, setToolStatus] = useState([])
  const [toolsLoading, setToolsLoading] = useState(true)
  const [installing, setInstalling] = useState({})

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
    <div className="tools-status">
      <h3 className="section-title">Tool status (Kali)</h3>
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
  )
}

export default ToolStatusPanel
