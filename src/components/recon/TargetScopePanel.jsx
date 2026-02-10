import React, { useState, useEffect, useCallback } from 'react'
import { useNotifications } from '../../contexts/NotificationContext'
import { useWebSocket } from '../../hooks/useWebSocket'
import { api } from '../../services/api'
import IcannLookupModal from '../IcannLookupModal'
import './TargetScopePanel.css'

function TargetScopePanel() {
  const { showNotification } = useNotifications()
  const [targetType, setTargetType] = useState('Domain')
  const [targetValue, setTargetValue] = useState('')
  const [notes, setNotes] = useState('')
  const [savedTargets, setSavedTargets] = useState([])
  const [loading, setLoading] = useState(false)
  const [icannDomain, setIcannDomain] = useState('')
  const [showIcann, setShowIcann] = useState(false)
  const [whitepagesName, setWhitepagesName] = useState('')
  const [whitepagesCity, setWhitepagesCity] = useState('')
  const [whitepagesState, setWhitepagesState] = useState('')
  const [whitepagesZip, setWhitepagesZip] = useState('')
  const [osintCompany, setOsintCompany] = useState('')
  const [osintPickerOpen, setOsintPickerOpen] = useState(false)
  const [osintPendingCompany, setOsintPendingCompany] = useState('')

  const loadTargets = useCallback(async () => {
    try {
      const targets = await api.getTargets()
      setSavedTargets(targets)
    } catch (error) {
      console.error('Failed to load targets:', error)
      showNotification('Failed to load targets. Is the backend server running?', 'error')
    }
  }, [showNotification])

  useEffect(() => {
    loadTargets()
  }, [loadTargets])

  const handleWebSocketMessage = useCallback((data) => {
    if (data?.type === 'job_complete' || data?.type === 'job_error' || data?.type === 'job_stopped') {
      loadTargets()
    }
  }, [loadTargets])

  useWebSocket(handleWebSocketMessage)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!targetValue.trim()) {
      showNotification('Please enter a target value', 'warning')
      return
    }

    setLoading(true)
    try {
      const newTarget = {
        name: targetValue,
        type: targetType,
        target: targetValue,
        tags: notes ? notes.split(',').map(t => t.trim()).join(',') : '',
        notes: notes
      }

      await api.createTarget(newTarget)
      setTargetValue('')
      setNotes('')
      showNotification(`Target "${targetValue}" added successfully`, 'success')
      loadTargets()
    } catch (error) {
      showNotification(`Failed to add target: ${error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const openIcann = (target) => {
    let value = (target?.target || '').toString().trim()
    if (!value) return
    if ((target?.type || '').toLowerCase() !== 'domain') {
      showNotification('ICANN/RDAP lookup is currently available for Domain targets only.', 'info')
      return
    }

    // Allow a full URL to be stored as a Domain target (e.g. https://example.com).
    // Normalize to hostname before lookup.
    try {
      if (value.includes('://')) {
        value = new URL(value).hostname
      }
    } catch {
      // ignore parse errors and fall through
    }
    value = value
      .replace(/^[a-z]+:\/\//i, '')
      .split('/')[0]
      .split('?')[0]
      .split('#')[0]
      .replace(/\.$/, '')

    setIcannDomain(value)
    setShowIcann(true)
  }

  const openWhitepages = (e) => {
    e.preventDefault()

    const name = whitepagesName.trim()
    const city = whitepagesCity.trim()
    const state = whitepagesState.trim()
    const zip = whitepagesZip.trim()

    if (!name) {
      showNotification('Please enter a full name for Whitepages lookup', 'warning')
      return
    }

    if (!city && !state && !zip) {
      showNotification('Please provide City, State, or Zip for Whitepages lookup', 'warning')
      return
    }

    const slugName = name.trim().split(/\s+/).map(part => {
      return part.charAt(0).toUpperCase() + part.slice(1)
    }).join('-')
    const slugLocation = [city, state, zip]
      .filter(Boolean)
      .map(part => part.trim())
      .join('-')
    const searchedLocation = [city, state, zip].filter(Boolean).join(', ').replace(', ,', ',')
    const url = `https://www.whitepages.com/name/${encodeURIComponent(slugName)}/${encodeURIComponent(slugLocation)}?fs=1&searchedName=${encodeURIComponent(name)}&searchedLocation=${encodeURIComponent(searchedLocation)}`

    window.open(url, '_blank', 'noopener,noreferrer')
    setWhitepagesName('')
    setWhitepagesCity('')
    setWhitepagesState('')
    setWhitepagesZip('')
  }


  const openOpenCorporates = (company) => {
    const url = `https://opencorporates.com/companies?q=${encodeURIComponent(company)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const openWayback = (company) => {
    const url = `https://web.archive.org/web/*/${encodeURIComponent(company)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleOsintSubmit = (e) => {
    e.preventDefault()
    const company = osintCompany.trim()
    if (!company) {
      showNotification('Please enter a company name for OSINT lookup', 'warning')
      return
    }
    setOsintPendingCompany(company)
    setOsintPickerOpen(true)
  }

  const handleOsintPick = (action) => {
    if (!osintPendingCompany) return
    if (action === 'opencorporates') {
      openOpenCorporates(osintPendingCompany)
    }
    if (action === 'wayback') {
      openWayback(osintPendingCompany)
    }
    setOsintPickerOpen(false)
  }

  return (
    <div className="target-scope-panel">
      <h3 className="section-title">Target & Scope</h3>
      
      <form className="target-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Target type:</label>
          <select 
            value={targetType} 
            onChange={(e) => setTargetType(e.target.value)}
            className="form-select"
          >
            <option>Domain</option>
            <option>IP</option>
            <option>CIDR</option>
            <option>Org name</option>
          </select>
        </div>

        <div className="form-group">
          <label>Target value:</label>
          <input
            type="text"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            placeholder="example.com"
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label>Notes:</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="In-scope assets, exclusions, rules of engagement"
            className="form-textarea"
            rows="3"
          />
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Adding...' : 'Add Target'}
        </button>
      </form>

      <div className="saved-targets">
        <h4 className="subsection-title">Saved targets:</h4>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Target</th>
                <th>Tags</th>
                <th>Last Run</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {savedTargets.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                    No targets saved yet. Add a target using the form above.
                  </td>
                </tr>
              ) : (
                savedTargets.map((target) => (
                  <tr key={target.id}>
                  <td>{target.name || target.target}</td>
                  <td>{target.type}</td>
                  <td>{target.target}</td>
                  <td>
                    {target.tags ? <span className="tags">{target.tags}</span> : '-'}
                  </td>
                  <td>{target.last_run ? new Date(target.last_run).toLocaleDateString() : '-'}</td>
                  <td>
                    <span className={`status-badge status-${(target.status || 'Pending').toLowerCase()}`}>
                      {target.status || 'Pending'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-mini"
                      onClick={() => openIcann(target)}
                      disabled={(target.type || '').toLowerCase() !== 'domain'}
                      title={(target.type || '').toLowerCase() !== 'domain' ? 'ICANN lookup is for Domain targets' : 'Open ICANN/RDAP lookup'}
                    >
                      ICANN
                    </button>
                  </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="whitepages-lookup">
        <h4 className="subsection-title">Whitepages lookup:</h4>
        <form className="whitepages-form" onSubmit={openWhitepages}>
          <div className="form-group">
            <label>Full name:</label>
            <input
              type="text"
              value={whitepagesName}
              onChange={(e) => setWhitepagesName(e.target.value)}
              placeholder="Jane Doe"
              className="form-input"
            />
          </div>
          <div className="whitepages-grid">
            <div className="form-group">
              <label>City:</label>
              <input
                type="text"
                value={whitepagesCity}
                onChange={(e) => setWhitepagesCity(e.target.value)}
                placeholder="San Bernardino"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>State:</label>
              <input
                type="text"
                value={whitepagesState}
                onChange={(e) => setWhitepagesState(e.target.value)}
                placeholder="CA"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Zip:</label>
              <input
                type="text"
                value={whitepagesZip}
                onChange={(e) => setWhitepagesZip(e.target.value)}
                placeholder="92407"
                className="form-input"
              />
            </div>
          </div>
          <button type="submit" className="btn-primary">
            Open Whitepages
          </button>
        </form>
      </div>

      <div className="osint-quick-links">
        <h4 className="subsection-title">Company OSINT quick links:</h4>
        <form className="osint-form" onSubmit={handleOsintSubmit}>
          <div className="form-group">
            <label>Company name:</label>
            <input
              type="text"
              value={osintCompany}
              onChange={(e) => setOsintCompany(e.target.value)}
              placeholder="Google"
              className="form-input"
            />
            <p className="form-help">
              This input will power additional OSINT links as they are added.
            </p>
          </div>
          <button type="submit" className="btn-primary">
            Choose OSINT Source
          </button>
        </form>
      </div>

      {osintPickerOpen && (
        <div className="osint-picker-backdrop" role="dialog" aria-modal="true">
          <div className="osint-picker">
            <h5 className="osint-picker-title">Open OSINT source</h5>
            <p className="osint-picker-note">
              Select a source for: <strong>{osintPendingCompany}</strong>
            </p>
            <div className="osint-picker-actions">
              <button type="button" className="btn-primary" onClick={() => handleOsintPick('opencorporates')}>
                Open OpenCorporates
              </button>
              <button type="button" className="btn-primary" onClick={() => handleOsintPick('wayback')}>
                Open Wayback Machine
              </button>
            </div>
            <button type="button" className="btn-secondary" onClick={() => setOsintPickerOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <IcannLookupModal
        isOpen={showIcann}
        domain={icannDomain}
        onClose={() => setShowIcann(false)}
      />
    </div>
  )
}

export default TargetScopePanel
