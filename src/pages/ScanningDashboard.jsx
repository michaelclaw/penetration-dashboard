import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import { useNotifications } from '../contexts/NotificationContext'
import { useAuth } from '../contexts/AuthContext'
import ToolStatusPanel from '../components/ToolStatusPanel'
import './ScanningDashboard.css'

const TOOL_KEYS = ['nmap', 'nuclei', 'nikto']

function ScanningDashboard() {
  const { showNotification } = useNotifications()
  const { user } = useAuth()

  const storageKey = useMemo(() => {
    const userKey = user?.profile?.sub || user?.profile?.preferred_username || user?.profile?.email
    return `scanning_dashboard_state:${userKey || 'local'}`
  }, [user])

  const [targets, setTargets] = useState([])
  const [targetsLoading, setTargetsLoading] = useState(false)

  const [selectedTargetId, setSelectedTargetId] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}')
      return saved.selectedTargetId || ''
    } catch {
      return ''
    }
  })

  const [selectedRuns, setSelectedRuns] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}')
      return saved.selectedRuns || { nmap: '', nuclei: '', nikto: '' }
    } catch {
      return { nmap: '', nuclei: '', nikto: '' }
    }
  })

  const [scanRuns, setScanRuns] = useState({ nmap: [], nuclei: [], nikto: [] })
  const [scanDetails, setScanDetails] = useState({ nmap: null, nuclei: null, nikto: null })
  const [nmapServices, setNmapServices] = useState([])
  const [nucleiFindings, setNucleiFindings] = useState([])
  const [niktoFindings, setNiktoFindings] = useState([])
  const [validationFindings, setValidationFindings] = useState([])
  const [validationFilter, setValidationFilter] = useState('All')

  const [rawOpen, setRawOpen] = useState({ nmap: false, nuclei: false, nikto: false })
  const [isVisible, setIsVisible] = useState(true)

  const parseSummary = useCallback((raw) => {
    if (!raw) return {}
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }, [])

  const persistState = useCallback((overrides = {}) => {
    const payload = {
      selectedTargetId,
      selectedRuns,
      rawOpen,
      ...overrides
    }
    localStorage.setItem(storageKey, JSON.stringify(payload))
  }, [selectedTargetId, selectedRuns, rawOpen, storageKey])

  useEffect(() => {
    persistState()
  }, [persistState])

  useEffect(() => {
    const handleVisibility = () => {
      setIsVisible(document.visibilityState === 'visible')
    }
    handleVisibility()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const loadTargets = useCallback(async () => {
    setTargetsLoading(true)
    try {
      const list = await api.getTargets()
      setTargets(list)
      if (list.length > 0) {
        const firstId = String(list[0].id)
        setSelectedTargetId(prev => prev || firstId)
      }
    } catch (error) {
      showNotification(error.message || 'Failed to load targets', 'error')
    } finally {
      setTargetsLoading(false)
    }
  }, [showNotification])

  const loadScanRuns = useCallback(async (tool) => {
    if (!selectedTargetId) return
    try {
      const runs = await api.getScans({ targetId: selectedTargetId, tool, limit: 25 })
      setScanRuns(prev => ({ ...prev, [tool]: runs }))
      if (runs.length > 0) {
        setSelectedRuns(prev => (prev[tool] ? prev : { ...prev, [tool]: runs[0].scan_id }))
      }
    } catch (error) {
      showNotification(error.message || `Failed to load ${tool} scan history`, 'error')
    }
  }, [selectedTargetId, showNotification])

  const loadScanDetail = useCallback(async (tool, scanId, includeRaw = false) => {
    if (!scanId) return null
    try {
      const detail = await api.getScan(scanId, includeRaw ? { includeRaw: '1' } : {})
      setScanDetails(prev => ({ ...prev, [tool]: detail }))
      return detail
    } catch (error) {
      showNotification(error.message || `Failed to load ${tool} scan details`, 'error')
      return null
    }
  }, [showNotification])

  const loadNmapResults = useCallback(async (scanId) => {
    if (!scanId || !selectedTargetId) return
    try {
      const services = await api.getServices({ targetId: selectedTargetId, jobId: scanId, limit: 500 })
      setNmapServices(services)
    } catch (error) {
      showNotification(error.message || 'Failed to load Nmap results', 'error')
    }
  }, [selectedTargetId, showNotification])

  const loadFindings = useCallback(async (tool, scanId) => {
    if (!scanId || !selectedTargetId) return
    try {
      const data = await api.getFindings({ targetId: selectedTargetId, jobId: scanId, type: tool, limit: 500 })
      if (tool === 'nuclei') setNucleiFindings(data)
      if (tool === 'nikto') setNiktoFindings(data)
    } catch (error) {
      showNotification(error.message || `Failed to load ${tool} findings`, 'error')
    }
  }, [selectedTargetId, showNotification])

  const loadValidationFindings = useCallback(async () => {
    if (!selectedTargetId) return
    try {
      const data = await api.getFindings({ targetId: selectedTargetId, limit: 500 })
      setValidationFindings(data)
    } catch (error) {
      showNotification(error.message || 'Failed to load validation findings', 'error')
    }
  }, [selectedTargetId, showNotification])

  useEffect(() => {
    loadTargets()
  }, [loadTargets])

  useEffect(() => {
    if (!selectedTargetId) return
    setSelectedRuns({ nmap: '', nuclei: '', nikto: '' })
    setScanDetails({ nmap: null, nuclei: null, nikto: null })
    setNmapServices([])
    setNucleiFindings([])
    setNiktoFindings([])
    TOOL_KEYS.forEach(tool => loadScanRuns(tool))
    loadValidationFindings()
  }, [selectedTargetId, loadScanRuns, loadValidationFindings])

  useEffect(() => {
    if (selectedRuns.nmap) {
      loadNmapResults(selectedRuns.nmap)
    }
    if (selectedRuns.nuclei) {
      loadFindings('nuclei', selectedRuns.nuclei)
    }
    if (selectedRuns.nikto) {
      loadFindings('nikto', selectedRuns.nikto)
    }
  }, [selectedRuns, loadNmapResults, loadFindings])

  const anyRunning = useMemo(() => {
    return TOOL_KEYS.some(tool => scanRuns[tool]?.some(run => run.status === 'running'))
  }, [scanRuns])

  useEffect(() => {
    if (!selectedTargetId || !isVisible || !anyRunning) return
    const interval = setInterval(() => {
      TOOL_KEYS.forEach(tool => loadScanRuns(tool))
      if (selectedRuns.nmap) {
        loadNmapResults(selectedRuns.nmap)
      }
      if (selectedRuns.nuclei) {
        loadFindings('nuclei', selectedRuns.nuclei)
      }
      if (selectedRuns.nikto) {
        loadFindings('nikto', selectedRuns.nikto)
      }
      loadValidationFindings()
    }, 5000)
    return () => clearInterval(interval)
  }, [
    selectedTargetId,
    selectedRuns,
    loadScanRuns,
    loadNmapResults,
    loadFindings,
    loadValidationFindings,
    isVisible,
    anyRunning
  ])

  const handleStartScan = async (tool) => {
    if (!selectedTargetId) {
      showNotification('Select a target before starting a scan', 'warning')
      return
    }
    const selectedTarget = targets.find(target => String(target.id) === String(selectedTargetId))
    if (!selectedTarget) {
      showNotification('Selected target not found. Refresh targets and try again.', 'warning')
      return
    }
    try {
      let options = {}
      if (tool === 'nuclei') {
        const trimmed = (selectedTarget.target || '').trim()
        if (!/^https?:\/\//i.test(trimmed)) {
          const httpsHit = await api.getServices({ targetId: selectedTarget.id, port: 443, limit: 1 })
          const scheme = httpsHit && httpsHit.length > 0 ? 'https' : 'http'
          options = { urlOverride: `${scheme}://${trimmed}` }
        }
      }

      const result = await api.startScan(Number(selectedTargetId), tool, options)
      showNotification(`${tool} scan started`, 'success')
      setSelectedRuns(prev => ({ ...prev, [tool]: result.scanId }))
      await loadScanRuns(tool)
    } catch (error) {
      showNotification(error.message || `Failed to start ${tool} scan`, 'error')
    }
  }

  const renderTargetSelect = () => (
    <select
      className="form-select"
      value={selectedTargetId}
      onChange={(e) => setSelectedTargetId(e.target.value)}
      disabled={targetsLoading}
    >
      <option value="">Select target...</option>
      {targets.map(target => (
        <option key={target.id} value={String(target.id)}>
          {target.name || target.target} ({target.type})
        </option>
      ))}
    </select>
  )

  const renderProgressBar = (tool) => {
    const run = getSelectedRun(tool)
    if (!run) return null
    const status = run.status || 'running'
    const className = status === 'running'
      ? 'scan-progress-fill indeterminate'
      : status === 'completed'
      ? 'scan-progress-fill complete'
      : 'scan-progress-fill error'
    return (
      <div className="scan-progress">
        <div className="scan-progress-bar">
          <div className={className}></div>
        </div>
        <div className="scan-progress-label">Status: {status}</div>
      </div>
    )
  }

  const handleToggleRaw = async (tool) => {
    const next = !rawOpen[tool]
    setRawOpen(prev => ({ ...prev, [tool]: next }))
    if (!next) return
    const scanId = selectedRuns[tool]
    if (!scanId) return
    const existing = scanDetails[tool]?.raw_output
    if (!existing) {
      await loadScanDetail(tool, scanId, true)
    }
  }

  const getSelectedRun = (tool) => {
    const id = selectedRuns[tool]
    if (!id) return null
    return scanRuns[tool].find(run => run.scan_id === id) || null
  }

  const updateFindingStatus = async (findingId, status) => {
    try {
      const updated = await api.updateFinding(findingId, { status })
      setNucleiFindings(prev => prev.map(item => (item.id === updated.id ? updated : item)))
      setNiktoFindings(prev => prev.map(item => (item.id === updated.id ? updated : item)))
      setValidationFindings(prev => prev.map(item => (item.id === updated.id ? updated : item)))
      showNotification(`Marked as ${status}`, 'success')
    } catch (error) {
      showNotification(error.message || 'Failed to update finding', 'error')
    }
  }

  const filteredValidation = validationFindings.filter(item => {
    if (validationFilter === 'All') return true
    return (item.status || 'Open') === validationFilter
  })

  return (
    <div className="scanning-dashboard">
      <div className="dashboard-header">
        <h2>Scanning & Vulnerability Analysis</h2>
        <p className="dashboard-subtitle">Run Nmap, Nuclei, and Nikto scans with stored results and validation</p>
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-section">
          <div className="scan-section-header">
            <h3 className="section-title">Host & Service Discovery (Nmap)</h3>
            <div className="scan-actions">
              {renderTargetSelect()}
              <button className="btn-primary" onClick={() => handleStartScan('nmap')}>
                Run Nmap
              </button>
            </div>
          </div>
          {renderProgressBar('nmap')}

          <div className="scan-history">
            <label>Scan history:</label>
            <select
              className="form-select"
              value={selectedRuns.nmap || ''}
              onChange={(e) => setSelectedRuns(prev => ({ ...prev, nmap: e.target.value }))}
            >
              <option value="">No scans yet</option>
              {scanRuns.nmap.map(run => (
                <option key={run.scan_id} value={run.scan_id}>
                  {run.started_at} — {run.status}
                </option>
              ))}
            </select>
          </div>

          <div className="scan-summary">
            <div><strong>Services found:</strong> {parseSummary(getSelectedRun('nmap')?.summary_json).totalServices || 0}</div>
            <div><strong>Hosts scanned:</strong> {parseSummary(getSelectedRun('nmap')?.summary_json).totalHosts || 0}</div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Host</th>
                  <th>IP</th>
                  <th>Port</th>
                  <th>Protocol</th>
                  <th>Service</th>
                  <th>Version</th>
                </tr>
              </thead>
              <tbody>
                {nmapServices.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1.5rem' }}>
                      No Nmap results yet.
                    </td>
                  </tr>
                ) : (
                  nmapServices.map(service => (
                    <tr key={`${service.id}-${service.port}`}>
                      <td>{service.host}</td>
                      <td>{service.ip}</td>
                      <td>{service.port}</td>
                      <td>{service.protocol}</td>
                      <td>{service.service_name || 'unknown'}</td>
                      <td>{service.technology || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <button className="btn-secondary" onClick={() => handleToggleRaw('nmap')}>
            {rawOpen.nmap ? 'Hide raw output' : 'View raw output'}
          </button>
          {rawOpen.nmap && (
            <pre className="scan-raw-output">{scanDetails.nmap?.raw_output || 'No raw output available.'}</pre>
          )}
        </section>

        <section className="dashboard-section">
          <div className="scan-section-header">
            <h3 className="section-title">Vulnerability Scan (Nuclei)</h3>
            <div className="scan-actions">
              {renderTargetSelect()}
              <button className="btn-primary" onClick={() => handleStartScan('nuclei')}>
                Run Nuclei
              </button>
            </div>
          </div>
          {renderProgressBar('nuclei')}

          <div className="scan-history">
            <label>Scan history:</label>
            <select
              className="form-select"
              value={selectedRuns.nuclei || ''}
              onChange={(e) => setSelectedRuns(prev => ({ ...prev, nuclei: e.target.value }))}
            >
              <option value="">No scans yet</option>
              {scanRuns.nuclei.map(run => (
                <option key={run.scan_id} value={run.scan_id}>
                  {run.started_at} — {run.status}
                </option>
              ))}
            </select>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Title</th>
                  <th>Host</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {nucleiFindings.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1.5rem' }}>
                      No Nuclei findings yet.
                    </td>
                  </tr>
                ) : (
                  nucleiFindings.map(finding => (
                    <tr key={finding.id}>
                      <td>{finding.severity}</td>
                      <td>{finding.title}</td>
                      <td>{finding.host || '-'}</td>
                      <td>{finding.status || 'Open'}</td>
                      <td>
                        <div className="action-buttons">
                          <button className="action-btn" onClick={() => updateFindingStatus(finding.id, 'Confirmed')}>✓</button>
                          <button className="action-btn" onClick={() => updateFindingStatus(finding.id, 'False Positive')}>✗</button>
                          <button className="action-btn" onClick={() => updateFindingStatus(finding.id, 'Needs Review')}>…</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <button className="btn-secondary" onClick={() => handleToggleRaw('nuclei')}>
            {rawOpen.nuclei ? 'Hide raw output' : 'View raw output'}
          </button>
          {rawOpen.nuclei && (
            <pre className="scan-raw-output">{scanDetails.nuclei?.raw_output || 'No raw output available.'}</pre>
          )}
        </section>

        <section className="dashboard-section">
          <div className="scan-section-header">
            <h3 className="section-title">Vulnerability Scan (Nikto)</h3>
            <div className="scan-actions">
              {renderTargetSelect()}
              <button className="btn-primary" onClick={() => handleStartScan('nikto')}>
                Run Nikto
              </button>
            </div>
          </div>
          {renderProgressBar('nikto')}

          <div className="scan-history">
            <label>Scan history:</label>
            <select
              className="form-select"
              value={selectedRuns.nikto || ''}
              onChange={(e) => setSelectedRuns(prev => ({ ...prev, nikto: e.target.value }))}
            >
              <option value="">No scans yet</option>
              {scanRuns.nikto.map(run => (
                <option key={run.scan_id} value={run.scan_id}>
                  {run.started_at} — {run.status}
                </option>
              ))}
            </select>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Title</th>
                  <th>Host</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {niktoFindings.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1.5rem' }}>
                      No Nikto findings yet.
                    </td>
                  </tr>
                ) : (
                  niktoFindings.map(finding => (
                    <tr key={finding.id}>
                      <td>{finding.severity}</td>
                      <td>{finding.title}</td>
                      <td>{finding.host || '-'}</td>
                      <td>{finding.status || 'Open'}</td>
                      <td>
                        <div className="action-buttons">
                          <button className="action-btn" onClick={() => updateFindingStatus(finding.id, 'Confirmed')}>✓</button>
                          <button className="action-btn" onClick={() => updateFindingStatus(finding.id, 'False Positive')}>✗</button>
                          <button className="action-btn" onClick={() => updateFindingStatus(finding.id, 'Needs Review')}>…</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <button className="btn-secondary" onClick={() => handleToggleRaw('nikto')}>
            {rawOpen.nikto ? 'Hide raw output' : 'View raw output'}
          </button>
          {rawOpen.nikto && (
            <pre className="scan-raw-output">{scanDetails.nikto?.raw_output || 'No raw output available.'}</pre>
          )}
        </section>

        <section className="dashboard-section">
          <div className="scan-section-header">
            <h3 className="section-title">Validation & Triage</h3>
            <div className="scan-actions">
              {renderTargetSelect()}
              <select
                className="form-select"
                value={validationFilter}
                onChange={(e) => setValidationFilter(e.target.value)}
              >
                <option value="All">All</option>
                <option value="Open">Open</option>
                <option value="Confirmed">Confirmed</option>
                <option value="False Positive">False Positive</option>
                <option value="Needs Review">Needs Review</option>
              </select>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Host</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredValidation.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1.5rem' }}>
                      No findings available for validation.
                    </td>
                  </tr>
                ) : (
                  filteredValidation.map(finding => (
                    <tr key={finding.id}>
                      <td>{finding.severity}</td>
                      <td>{finding.type}</td>
                      <td>{finding.title}</td>
                      <td>{finding.host || '-'}</td>
                      <td>{finding.status || 'Open'}</td>
                      <td>
                        <div className="action-buttons">
                          <button className="action-btn" onClick={() => updateFindingStatus(finding.id, 'Confirmed')}>✓</button>
                          <button className="action-btn" onClick={() => updateFindingStatus(finding.id, 'False Positive')}>✗</button>
                          <button className="action-btn" onClick={() => updateFindingStatus(finding.id, 'Needs Review')}>…</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="dashboard-section">
          <ToolStatusPanel />
        </section>
      </div>
    </div>
  )
}

export default ScanningDashboard
