import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import './ImportResultsModal.css'

function ImportResultsModal({ isOpen, onClose, onImported }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [targets, setTargets] = useState([])
  const [selectedTargetId, setSelectedTargetId] = useState('')

  const [subdomainsText, setSubdomainsText] = useState('')
  const [servicesJson, setServicesJson] = useState('[]')
  const [findingsJson, setFindingsJson] = useState('[]')
  const [activityText, setActivityText] = useState('')

  const title = useMemo(() => 'Import Results (Assignment-safe)', [])

  useEffect(() => {
    if (!isOpen) return
    setError('')
    setLoading(true)
    ;(async () => {
      try {
        const t = await api.getTargets()
        setTargets(t)
        if (t.length && !selectedTargetId) {
          setSelectedTargetId(String(t[0].id))
        }
      } catch (e) {
        setError(e.message || 'Failed to load targets')
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const handleImport = async () => {
    setError('')
    if (!selectedTargetId) {
      setError('Please select a target.')
      return
    }

    setLoading(true)
    try {
      const body = {
        targetId: Number(selectedTargetId),
        subdomains: subdomainsText,
        services: servicesJson,
        findings: findingsJson,
        activity: activityText
      }

      const result = await api.importResults(body)
      if (onImported) onImported(result)
      onClose()
    } catch (e) {
      setError(e.message || 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="import-overlay" onClick={onClose}>
      <div className="import-window" onClick={(e) => e.stopPropagation()}>
        <div className="import-header">
          <h2>{title}</h2>
          <button className="import-close" onClick={onClose} title="Close">×</button>
        </div>

        <div className="import-content">
          {error && <div className="import-error">{error}</div>}

          <div className="import-row">
            <label className="import-label">Target</label>
            <select
              className="import-select"
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              disabled={loading}
            >
              {targets.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name} ({t.type}: {t.target})
                </option>
              ))}
            </select>
          </div>

          <div className="import-grid">
            <div className="import-box">
              <div className="import-box-title">Subdomains (newline list)</div>
              <textarea
                className="import-textarea"
                value={subdomainsText}
                onChange={(e) => setSubdomainsText(e.target.value)}
                placeholder={"api.example.com\nwww.example.com\nmail.example.com"}
                rows={8}
                disabled={loading}
              />
            </div>

            <div className="import-box">
              <div className="import-box-title">Services (JSON array)</div>
              <textarea
                className="import-textarea"
                value={servicesJson}
                onChange={(e) => setServicesJson(e.target.value)}
                placeholder={'[{"host":"api.example.com","ip":"203.0.113.10","port":443,"protocol":"tcp","service_name":"https","http_status":200,"technology":"nginx"}]'}
                rows={8}
                disabled={loading}
              />
              <div className="import-help">Each service row must include: <code>host</code>, <code>ip</code>, <code>port</code>.</div>
            </div>

            <div className="import-box">
              <div className="import-box-title">Findings (JSON array)</div>
              <textarea
                className="import-textarea"
                value={findingsJson}
                onChange={(e) => setFindingsJson(e.target.value)}
                placeholder={'[{"severity":"HIGH","type":"misconfig","title":"Example finding","host":"api.example.com","description":"..."}]'}
                rows={8}
                disabled={loading}
              />
              <div className="import-help">Each finding should include at least: <code>title</code> (severity/type optional).</div>
            </div>

            <div className="import-box">
              <div className="import-box-title">Activity (newline list, optional)</div>
              <textarea
                className="import-textarea"
                value={activityText}
                onChange={(e) => setActivityText(e.target.value)}
                placeholder={"Imported subdomains list\nImported services list\nImported findings list"}
                rows={8}
                disabled={loading}
              />
            </div>
          </div>

          <div className="import-actions">
            <button className="import-btn secondary" onClick={onClose} disabled={loading}>Cancel</button>
            <button className="import-btn primary" onClick={handleImport} disabled={loading}>
              {loading ? 'Importing…' : 'Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImportResultsModal

