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
  const [hibpDomain, setHibpDomain] = useState('')
  const [hibpResults, setHibpResults] = useState([])
  const [hibpLoading, setHibpLoading] = useState(false)

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

    const locationParts = [city, state, zip].filter(Boolean).join(' ')
    const query = new URLSearchParams({
      name: name,
      where: locationParts
    })
    const url = `https://www.whitepages.com/name?${query.toString()}`

    window.open(url, '_blank', 'noopener,noreferrer')
    setWhitepagesName('')
    setWhitepagesCity('')
    setWhitepagesState('')
    setWhitepagesZip('')
  }

  const handleHibpLookup = async (e) => {
    e.preventDefault()
    const domain = hibpDomain.trim()
    if (!domain) {
      showNotification('Please enter a domain or company domain for HIBP lookup', 'warning')
      return
    }
    setHibpLoading(true)
    try {
      const data = await api.getHibpBreaches(domain)
      setHibpResults(data.breaches || [])
      showNotification('HIBP lookup complete', 'success')
    } catch (error) {
      showNotification(error.message || 'HIBP lookup failed', 'error')
    } finally {
      setHibpLoading(false)
    }
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

      <div className="hibp-lookup">
        <h4 className="subsection-title">Have I Been Pwned (domain lookup):</h4>
        <form className="hibp-form" onSubmit={handleHibpLookup}>
          <div className="form-group">
            <label>Domain or company domain:</label>
            <input
              type="text"
              value={hibpDomain}
              onChange={(e) => setHibpDomain(e.target.value)}
              placeholder="example.com"
              className="form-input"
            />
            <p className="form-help">
              HIBP supports domain checks (use the company’s primary domain).
            </p>
          </div>
          <button type="submit" className="btn-primary" disabled={hibpLoading}>
            {hibpLoading ? 'Checking...' : 'Check HIBP'}
          </button>
        </form>
        <div className="hibp-results">
          {hibpResults.length === 0 ? (
            <div className="hibp-empty">No breaches found (or none returned).</div>
          ) : (
            <ul className="hibp-list">
              {hibpResults.map(breach => (
                <li key={breach.Name || breach.Title}>
                  <strong>{breach.Title || breach.Name}</strong>
                  {breach.BreachDate ? ` — ${breach.BreachDate}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <IcannLookupModal
        isOpen={showIcann}
        domain={icannDomain}
        onClose={() => setShowIcann(false)}
      />
    </div>
  )
}

export default TargetScopePanel
