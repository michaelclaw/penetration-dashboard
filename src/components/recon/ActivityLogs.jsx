import React, { useState, useEffect } from 'react'
import { useWebSocket } from '../../hooks/useWebSocket'
import { api } from '../../services/api'
import { useNotifications } from '../../contexts/NotificationContext'
import './ActivityLogs.css'

function ActivityLogs() {
  const { showNotification } = useNotifications()
  const [activities, setActivities] = useState([])
  const [fullLogs, setFullLogs] = useState([])
  const [showFullLogs, setShowFullLogs] = useState(false)
  const [loadingFullLogs, setLoadingFullLogs] = useState(false)

  const handleWebSocketMessage = (data) => {
    if (data.type === 'activity') {
      setActivities(prev => [
        {
          time: new Date(data.timestamp).toLocaleTimeString(),
          message: data.message,
          level: data.level
        },
        ...prev
      ].slice(0, 50)) // Keep last 50 activities
    }
  }

  useWebSocket(handleWebSocketMessage)

  const loadFullLogs = async () => {
    setLoadingFullLogs(true)
    try {
      const data = await api.getActivityLogs({ limit: 300 })
      setFullLogs(data.logs || [])
    } catch (error) {
      showNotification(error.message || 'Failed to load full logs', 'error')
    } finally {
      setLoadingFullLogs(false)
    }
  }

  const handleToggleFullLogs = async () => {
    const next = !showFullLogs
    setShowFullLogs(next)
    if (next) {
      await loadFullLogs()
    }
  }

  const handleDownloadLogs = async () => {
    try {
      const text = await api.exportActivityLogs({ limit: 1000 })
      const blob = new Blob([text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `recon-activity-${Date.now()}.log`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      showNotification('Log downloaded', 'success')
    } catch (error) {
      showNotification(error.message || 'Failed to download logs', 'error')
    }
  }

  const handleDiagnostics = async () => {
    try {
      const [tools, integrations] = await Promise.all([
        api.getToolStatus(),
        api.getIntegrationsStatus()
      ])
      const missingTools = (tools.tools || []).filter(tool => !tool.installed).length
      const integrationsOk = (integrations.integrations || []).filter(item => item.status === 'ok').length
      showNotification(
        `Diagnostics: ${missingTools} tools missing, ${integrationsOk} integrations OK`,
        missingTools === 0 ? 'success' : 'warning'
      )
    } catch (error) {
      showNotification(error.message || 'Diagnostics failed', 'error')
    }
  }

  return (
    <div className="activity-logs">
      <h3 className="section-title">Activity & Logs</h3>
      
      <div className="recent-activity">
        <h4 className="subsection-title">Recent activity:</h4>
        <div className="activity-list">
          {activities.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
              No activity yet. Activity logs will appear here when you start reconnaissance jobs.
            </div>
          ) : (
            activities.map((activity, idx) => (
              <div key={idx} className="activity-item">
                <span className="activity-time">{activity.time}</span>
                <span className="activity-message">{activity.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="activity-links">
        <button className="link-btn" onClick={handleToggleFullLogs}>
          {showFullLogs ? 'Hide full logs' : 'View full logs'}
        </button>
        <button className="link-btn" onClick={handleDownloadLogs}>Download job log</button>
        <button className="link-btn" onClick={handleDiagnostics}>Module diagnostics</button>
      </div>

      {showFullLogs && (
        <div className="full-logs">
          <h4 className="subsection-title">Full logs (latest 300):</h4>
          <div className="full-logs-list">
            {loadingFullLogs ? (
              <div className="full-logs-empty">Loading full logs...</div>
            ) : fullLogs.length === 0 ? (
              <div className="full-logs-empty">No logs available yet.</div>
            ) : (
              fullLogs.map(log => (
                <div key={log.id} className="activity-item">
                  <span className="activity-time">
                    {log.created_at ? new Date(log.created_at).toLocaleTimeString() : '-'}
                  </span>
                  <span className="activity-message">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ActivityLogs
