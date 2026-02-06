import React, { useState, useEffect } from 'react'
import { api } from '../../services/api'
import { useNotifications } from '../../contexts/NotificationContext'
import './FindingsAlerts.css'

function FindingsAlerts() {
  const { showNotification } = useNotifications()
  const [findings, setFindings] = useState([])
  const [summary, setSummary] = useState({ total: 0, high: 0, medium: 0, low: 0 })
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)

  useEffect(() => {
    loadFindings()
    loadSummary()
    
    // Refresh every 5 seconds so new findings appear after recon
    const interval = setInterval(() => {
      loadFindings()
      loadSummary()
    }, 5000)
    
    return () => clearInterval(interval)
  }, [])

  const loadFindings = async () => {
    try {
      const data = await api.getFindings({ status: 'Open' })
      setFindings(data)
    } catch (error) {
      console.error('Failed to load findings:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSummary = async () => {
    try {
      const data = await api.getFindingsSummary()
      setSummary(data)
    } catch (error) {
      console.error('Failed to load summary:', error)
    }
  }

  const getSeverityClass = (severity) => {
    return `severity-${severity.toLowerCase()}`
  }

  const handleViewDetails = (finding) => {
    const detail = finding.description || 'No description available.'
    showNotification(detail, 'info', 6000)
  }

  const updateFindingStatus = async (finding, status) => {
    if (!finding?.id) return
    setUpdatingId(finding.id)
    try {
      const updated = await api.updateFinding(finding.id, { status })
      setFindings(prev => prev.map(item => (item.id === updated.id ? updated : item)))
      showNotification(`Finding marked as ${status}`, 'success')
    } catch (error) {
      showNotification(error.message || 'Failed to update finding', 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleExportFinding = (finding) => {
    const blob = new Blob([JSON.stringify(finding, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `finding-${finding.id || Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="findings-alerts">
      <h3 className="section-title">Findings & Alerts</h3>
      
      <div className="findings-summary">
        <h4 className="subsection-title">Findings summary:</h4>
        <div className="summary-stats">
          <div className="stat-item">
            <span className="stat-label">Total findings:</span>
            <span className="stat-value">{summary.total || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">High:</span>
            <span className="stat-value high">{summary.high || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Medium:</span>
            <span className="stat-value medium">{summary.medium || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Low:</span>
            <span className="stat-value low">{summary.low || 0}</span>
          </div>
        </div>
      </div>

      <div className="findings-list">
        <h4 className="subsection-title">Findings list:</h4>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Type</th>
                <th>Title</th>
                <th>Host</th>
                <th>First Seen</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                    Loading findings...
                  </td>
                </tr>
              ) : findings.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                    No findings yet. Findings will appear here after running reconnaissance.
                  </td>
                </tr>
              ) : (
                findings.map((finding) => (
                  <tr key={finding.id}>
                    <td>
                      <span className={`severity-badge ${getSeverityClass(finding.severity)}`}>
                        {finding.severity}
                      </span>
                    </td>
                    <td>{finding.type}</td>
                    <td>{finding.title}</td>
                    <td>{finding.host || '-'}</td>
                    <td>{finding.first_seen ? new Date(finding.first_seen).toLocaleDateString() : '-'}</td>
                    <td>
                      <span className={`status-badge status-${(finding.status || 'Open').toLowerCase().replace(/\s+/g, '-')}`}>
                        {finding.status || 'Open'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="action-btn"
                          title="View details"
                          onClick={() => handleViewDetails(finding)}
                        >
                          👁️
                        </button>
                        <button
                          className="action-btn"
                          title="Mark confirmed"
                          onClick={() => updateFindingStatus(finding, 'Confirmed')}
                          disabled={updatingId === finding.id}
                        >
                          ✓
                        </button>
                        <button
                          className="action-btn"
                          title="Mark false positive"
                          onClick={() => updateFindingStatus(finding, 'False Positive')}
                          disabled={updatingId === finding.id}
                        >
                          ✗
                        </button>
                        <button
                          className="action-btn"
                          title="Export to report"
                          onClick={() => handleExportFinding(finding)}
                        >
                          📤
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default FindingsAlerts
