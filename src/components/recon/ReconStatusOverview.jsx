import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNotifications } from '../../contexts/NotificationContext'
import { useWebSocket } from '../../hooks/useWebSocket'
import { api } from '../../services/api'
import ScanningWindow from '../ScanningWindow'
import ImportResultsModal from '../ImportResultsModal'
import { useAuth } from '../../contexts/AuthContext'
import './ReconStatusOverview.css'

function ReconStatusOverview() {
  const { showNotification } = useNotifications()
  const { user } = useAuth()
  const STORAGE_KEY = 'recon_dashboard_last_job'
  const PROFILE_STORAGE_KEY = 'recon_dashboard_profile'
  const TARGET_STORAGE_KEY = 'recon_dashboard_target'
  const storageKey = useMemo(() => {
    const userKey = user?.profile?.sub || user?.profile?.preferred_username || user?.profile?.email
    return `${STORAGE_KEY}:${userKey || 'local'}`
  }, [user])
  const profileStorageKey = useMemo(() => {
    const userKey = user?.profile?.sub || user?.profile?.preferred_username || user?.profile?.email
    return `${PROFILE_STORAGE_KEY}:${userKey || 'local'}`
  }, [user])
  const targetStorageKey = useMemo(() => {
    const userKey = user?.profile?.sub || user?.profile?.preferred_username || user?.profile?.email
    return `${TARGET_STORAGE_KEY}:${userKey || 'local'}`
  }, [user])
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [showScanningWindow, setShowScanningWindow] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [currentStage, setCurrentStage] = useState(null)
  const [overallProgress, setOverallProgress] = useState(0)
  const [currentJobId, setCurrentJobId] = useState(null)
  const [jobStartTime, setJobStartTime] = useState(null)
  const [currentProfile, setCurrentProfile] = useState(() => {
    return localStorage.getItem(profileStorageKey) || 'Standard external'
  })
  const hasLoadedState = useRef(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailTitle, setDetailTitle] = useState('')
  const [detailItems, setDetailItems] = useState([])
  const [detailMessage, setDetailMessage] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [targets, setTargets] = useState([])
  const [selectedTargetId, setSelectedTargetId] = useState(() => {
    return localStorage.getItem(targetStorageKey) || ''
  })
  const [targetsLoading, setTargetsLoading] = useState(false)

  const persistState = (overrides = {}) => {
    const payload = {
      isRunning,
      isPaused,
      showScanningWindow,
      currentStage,
      overallProgress,
      currentJobId,
      currentProfile,
      jobStartTime: jobStartTime ? jobStartTime.toISOString() : null,
      pipelineStages,
      ...overrides
    }
    localStorage.setItem(storageKey, JSON.stringify(payload))
  }

  const [pipelineStages, setPipelineStages] = useState([
    { name: 'Subdomains', count: 0, status: 'QUEUED' },
    { name: 'DNS records', count: 0, status: 'QUEUED' },
    { name: 'Live hosts', count: 0, status: 'QUEUED' },
    { name: 'HTTP probing', count: 0, status: 'QUEUED' },
    { name: 'Directories', count: 0, status: 'QUEUED' },
    { name: 'Vulnerability hints', count: 0, status: 'QUEUED' }
  ])

  useEffect(() => {
    hasLoadedState.current = false
    const saved = localStorage.getItem(storageKey)
    if (!saved) {
      hasLoadedState.current = true
      return
    }
    try {
      const parsed = JSON.parse(saved)
      setIsRunning(Boolean(parsed.isRunning))
      setIsPaused(Boolean(parsed.isPaused))
      setShowScanningWindow(Boolean(parsed.showScanningWindow))
      setCurrentStage(parsed.currentStage || null)
      setOverallProgress(typeof parsed.overallProgress === 'number' ? parsed.overallProgress : 0)
      setCurrentJobId(parsed.currentJobId || null)
      setJobStartTime(parsed.jobStartTime ? new Date(parsed.jobStartTime) : null)
      if (parsed.currentProfile) {
        setCurrentProfile(parsed.currentProfile)
      }
      if (Array.isArray(parsed.pipelineStages)) {
        const filtered = parsed.pipelineStages.filter(stage => stage.name !== 'Ports/services')
        setPipelineStages(filtered)
      }
    } catch {
      // ignore bad state
    }
    hasLoadedState.current = true
  }, [storageKey])

  useEffect(() => {
    if (!hasLoadedState.current) {
      hasLoadedState.current = true
      return
    }
    persistState()
  }, [
    isRunning,
    isPaused,
    showScanningWindow,
    currentStage,
    overallProgress,
    currentJobId,
    currentProfile,
    jobStartTime,
    pipelineStages,
    storageKey
  ])

  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        persistState()
      } catch {
        // ignore storage errors on unload
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [
    isRunning,
    isPaused,
    showScanningWindow,
    currentStage,
    overallProgress,
    currentJobId,
    currentProfile,
    jobStartTime,
    pipelineStages,
    storageKey
  ])

  useEffect(() => {
    const storedProfile = localStorage.getItem(profileStorageKey) || 'Standard external'
    setCurrentProfile(storedProfile)
  }, [profileStorageKey])

  useEffect(() => {
    const storedTarget = localStorage.getItem(targetStorageKey) || ''
    setSelectedTargetId(storedTarget)
  }, [targetStorageKey])

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === profileStorageKey) {
        setCurrentProfile(event.newValue || 'Standard external')
      }
      if (event.key === targetStorageKey) {
        setSelectedTargetId(event.newValue || '')
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [profileStorageKey, targetStorageKey])

  useEffect(() => {
    const handleProfileChange = (event) => {
      if (event?.detail) {
        setCurrentProfile(event.detail)
      }
    }
    window.addEventListener('recon_profile_changed', handleProfileChange)
    return () => window.removeEventListener('recon_profile_changed', handleProfileChange)
  }, [])

  useEffect(() => {
    if (selectedTargetId !== null && selectedTargetId !== undefined) {
      localStorage.setItem(targetStorageKey, selectedTargetId)
    }
  }, [selectedTargetId, targetStorageKey])

  const loadTargets = async () => {
    setTargetsLoading(true)
    try {
      const list = await api.getTargets()
      setTargets(list)
      const currentId = String(selectedTargetId || '')
      const hasCurrent = list.some(target => String(target.id) === currentId)
      if (!hasCurrent) {
        setSelectedTargetId(list.length > 0 ? String(list[0].id) : '')
      }
    } catch (error) {
      showNotification('Failed to load targets. Is the backend running?', 'error')
    } finally {
      setTargetsLoading(false)
    }
  }

  useEffect(() => {
    loadTargets()
  }, [])

  // WebSocket handler
  const handleWebSocketMessage = (data) => {
    if (data.type === 'stage_update') {
      setPipelineStages(prev => {
        const stageIndex = prev.findIndex(s => s.name === data.stage)
        const updated = prev.map((stage, idx) => {
          if (idx === stageIndex) {
            return {
              ...stage,
              status: data.status === 'running'
                ? 'RUNNING'
                : data.status === 'done'
                ? 'DONE'
                : data.status === 'skipped'
                ? 'SKIPPED'
                : 'QUEUED',
              count: data.count !== undefined ? data.count : stage.count
            }
          } else if (idx < stageIndex && data.status === 'done') {
            // Mark previous stages as done unless they were skipped
            if (stage.status === 'SKIPPED') {
              return stage
            }
            return { ...stage, status: 'DONE' }
          }
          return stage
        })

        // Calculate overall progress
        const doneStages = updated.filter(s => s.status === 'DONE').length
        const runningStage = updated.find(s => s.status === 'RUNNING')
        const totalStages = updated.length
        const progress = runningStage 
          ? ((doneStages + 0.5) / totalStages) * 100 
          : (doneStages / totalStages) * 100
        setOverallProgress(Math.min(progress, 100))

        return updated
      })

      if (data.status === 'running') {
        setCurrentStage(data.stage)
      } else if (data.status === 'done') {
        // Move to next stage if current stage is done
        const stageNames = pipelineStages.map(s => s.name)
        const currentIndex = stageNames.indexOf(data.stage)
        if (currentIndex < stageNames.length - 1) {
          setCurrentStage(stageNames[currentIndex + 1])
        } else {
          setCurrentStage(null)
        }
      }
    }

    if (data.type === 'job_complete') {
      setIsRunning(false)
      setCurrentStage(null)
      setOverallProgress(100)
      showNotification('Reconnaissance completed successfully!', 'success')
    }

    if (data.type === 'job_stopped') {
      setIsRunning(false)
      setCurrentStage(null)
      setOverallProgress(0)
      setPipelineStages(prev => prev.map(s => ({ ...s, count: 0, status: 'QUEUED' })))
    }

    if (data.type === 'job_paused') {
      setIsPaused(true)
    }

    if (data.type === 'job_resumed') {
      setIsPaused(false)
    }

    if (data.type === 'activity') {
      // Activity logs are handled by ActivityLogs component
    }

    if (data.type === 'job_error') {
      setIsRunning(false)
      setCurrentStage(null)
      showNotification(`Error: ${data.error}`, 'error')
    }
  }

  const { isConnected } = useWebSocket(handleWebSocketMessage)
  const [apiHealth, setApiHealth] = useState(null)

  // Check API health on mount and periodically
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001/api'}/health`)
        if (response.ok) {
          setApiHealth(true)
        } else {
          setApiHealth(false)
        }
      } catch (error) {
        console.error('API health check failed:', error)
        setApiHealth(false)
      }
    }

    checkHealth()
    const interval = setInterval(checkHealth, 5000) // Check every 5 seconds

    return () => clearInterval(interval)
  }, [])

  const getStatusClass = (status) => {
    switch (status) {
      case 'DONE': return 'status-done'
      case 'RUNNING': return 'status-running'
      case 'SKIPPED': return 'status-skipped'
      case 'QUEUED': return 'status-queued'
      default: return ''
    }
  }

  const openStageDetails = async (stageName) => {
    setDetailOpen(true)
    setDetailTitle(stageName)
    setDetailItems([])
    setDetailMessage('')
    setDetailLoading(true)

    const stage = pipelineStages.find(item => item.name === stageName)
    if (stage?.status === 'SKIPPED') {
      setDetailMessage('This stage was skipped based on the selected profile or target type.')
      setDetailLoading(false)
      return
    }

    const unsupported = [
      'HTTP probing',
      'Directories'
    ]

    if (unsupported.includes(stageName)) {
      setDetailMessage('This stage is not stored yet. Check Activity & Logs for command output.')
      setDetailLoading(false)
      return
    }

    try {
      const targets = await api.getTargets()
      if (targets.length === 0) {
        setDetailMessage('No targets found.')
        setDetailLoading(false)
        return
      }

      if (stageName === 'Subdomains' || stageName === 'Live hosts') {
        const results = await Promise.all(
          targets.map(async (target) => {
            const subs = await api.getSubdomains({ targetId: target.id })
            return subs.map(sub => ({
              target: target.target,
              subdomain: sub.subdomain,
              ip: sub.ip,
              status: sub.status || 'UNKNOWN'
            }))
          })
        )
        const flattened = results.flat()
        const filtered = stageName === 'Live hosts'
          ? flattened.filter(item => item.status === 'LIVE')
          : flattened
        setDetailItems(filtered)
        if (filtered.length === 0) {
          setDetailMessage('No results found for this stage yet.')
        }
      } else if (stageName === 'Vulnerability hints') {
        const results = await Promise.all(
          targets.map(async (target) => {
            const findings = await api.getFindings({ targetId: target.id })
            return findings.map(finding => ({
              target: target.target,
              severity: finding.severity,
              title: finding.title,
              host: finding.host || '-',
              status: finding.status || 'Open'
            }))
          })
        )
        const flattened = results.flat()
        setDetailItems(flattened)
        if (flattened.length === 0) {
          setDetailMessage('No findings found yet.')
        }
      } else if (stageName === 'DNS records') {
        const results = await Promise.all(
          targets.map(async (target) => {
            const records = await api.getDnsRecords({ targetId: target.id })
            return records.map(record => ({
              target: target.target,
              record: record.record
            }))
          })
        )
        const flattened = results.flat()
        setDetailItems(flattened)
        if (flattened.length === 0) {
          setDetailMessage('No DNS records found yet.')
        }
      } else {
        setDetailMessage('No details available for this stage yet.')
      }
    } catch (error) {
      setDetailMessage(error.message || 'Failed to load stage data.')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleStart = async () => {
    try {
      await loadTargets()
      if (targets.length === 0) {
        showNotification('Please add a target first before starting reconnaissance', 'warning')
        return
      }

      const targetId = selectedTargetId
      if (!targetId) {
        showNotification('Please select a target before starting reconnaissance', 'warning')
        return
      }
      const matchingTarget = targets.find(target => String(target.id) === String(targetId))
      if (!matchingTarget) {
        showNotification('Selected target no longer exists. Refresh targets and try again.', 'warning')
        return
      }
      const profile = localStorage.getItem(profileStorageKey) || 'Standard external'
      setCurrentProfile(profile)
      const result = await api.startRecon(matchingTarget.id, profile)
      
      setCurrentJobId(result.jobId)
      setIsRunning(true)
      setIsPaused(false)
      setShowScanningWindow(true)
      setOverallProgress(0)
      setJobStartTime(new Date())
      
      // Reset pipeline stages
      setPipelineStages([
        { name: 'Subdomains', count: 0, status: 'QUEUED' },
        { name: 'DNS records', count: 0, status: 'QUEUED' },
        { name: 'Live hosts', count: 0, status: 'QUEUED' },
        { name: 'HTTP probing', count: 0, status: 'QUEUED' },
        { name: 'Directories', count: 0, status: 'QUEUED' },
        { name: 'Vulnerability hints', count: 0, status: 'QUEUED' }
      ])

      showNotification('Reconnaissance started!', 'success')
    } catch (error) {
      showNotification(`Failed to start reconnaissance: ${error.message}`, 'error')
    }
  }

  const handlePause = async () => {
    if (!currentJobId) return
    
    try {
      await api.pauseRecon(currentJobId)
      setIsPaused(true)
      showNotification('Reconnaissance paused', 'info')
    } catch (error) {
      showNotification(`Failed to pause: ${error.message}`, 'error')
    }
  }

  const handleResume = async () => {
    if (!currentJobId) return
    
    try {
      await api.resumeRecon(currentJobId)
      setIsPaused(false)
      showNotification('Reconnaissance resumed', 'info')
    } catch (error) {
      showNotification(`Failed to resume: ${error.message}`, 'error')
    }
  }

  const handleStop = async () => {
    if (!currentJobId) return
    
    try {
      await api.stopRecon(currentJobId)
      setIsRunning(false)
      setIsPaused(false)
      setCurrentStage(null)
      setOverallProgress(0)
      setShowScanningWindow(false)
      setCurrentJobId(null)
      setJobStartTime(null)
      
      setPipelineStages(prev => prev.map(stage => ({ ...stage, count: 0, status: 'QUEUED' })))
      
      showNotification('Reconnaissance stopped', 'warning')
    } catch (error) {
      showNotification(`Failed to stop: ${error.message}`, 'error')
    }
  }

  const handleImported = (result) => {
    // The backend will broadcast stage updates + job_complete; we also provide immediate UX feedback.
    setCurrentJobId(result?.jobId || null)
    setIsRunning(false)
    setIsPaused(false)
    setShowScanningWindow(true)
    setJobStartTime(new Date())
    showNotification(
      `Imported results: ${result?.imported?.subdomains || 0} subdomains, ${result?.imported?.services || 0} services, ${result?.imported?.findings || 0} findings`,
      'success'
    )
  }

  return (
    <>
      <div className="recon-status-overview">
        <h3 className="section-title">Recon Status Overview</h3>
        
        {(!isConnected || apiHealth === false) && (
          <div style={{ 
            padding: '1rem', 
            background: apiHealth === false ? 'var(--error)' : 'var(--warning)', 
            color: 'white', 
            borderRadius: '6px',
            marginBottom: '1rem'
          }}>
            {apiHealth === false 
              ? '⚠️ Backend server is not reachable. Please ensure the server is running on port 3001.'
              : '⚠️ WebSocket not connected. Real-time updates may not work, but API calls should still function.'}
          </div>
        )}
        
        <div className="pipeline-stages">
          <h4 className="subsection-title">Pipeline stages:</h4>
          <div className="stages-grid">
            {pipelineStages.map((stage, idx) => (
              <button
                key={idx}
                className="stage-card stage-card-button"
                onClick={() => openStageDetails(stage.name)}
                type="button"
                title="Click to view results"
              >
                <div className="stage-name">{stage.name}:</div>
                <div className="stage-info">
                  <span className="stage-count">{stage.count} {stage.name.includes('hosts') ? 'hosts' : stage.name.includes('sites') ? 'sites' : 'found'}</span>
                  <span className={`stage-status ${getStatusClass(stage.status)}`}>
                    [{stage.status}]
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="job-controls">
          <h4 className="subsection-title">Job controls:</h4>
          <div className="target-picker">
            <label className="target-picker-label">Target:</label>
            <select
              className="target-picker-select"
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              disabled={targetsLoading || targets.length === 0}
            >
              {targets.length === 0 ? (
                <option value="">No targets available</option>
              ) : (
                targets.map(target => (
                  <option key={target.id} value={target.id}>
                    {target.name || target.target} ({target.type})
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              className="btn-control btn-import"
              onClick={loadTargets}
              disabled={targetsLoading}
              title="Refresh targets"
            >
              {targetsLoading ? 'Refreshing...' : 'Refresh Targets'}
            </button>
          </div>
          <div className="controls-buttons">
            <button 
              className="btn-control btn-start" 
              onClick={handleStart}
              disabled={isRunning && !isPaused || !isConnected}
            >
              Start {currentProfile} Recon
            </button>
            <button
              className="btn-control btn-import"
              onClick={() => setShowImportModal(true)}
              disabled={!isConnected}
              title="Import results (assignment-safe)"
            >
              Import Results
            </button>
            <button 
              className="btn-control btn-pause" 
              onClick={handlePause}
              disabled={!isRunning || isPaused || !isConnected}
            >
              Pause
            </button>
            <button 
              className="btn-control btn-resume" 
              onClick={handleResume}
              disabled={!isRunning || !isPaused || !isConnected}
            >
              Resume
            </button>
            <button 
              className="btn-control btn-stop" 
              onClick={handleStop}
              disabled={!isRunning || !isConnected}
            >
              Stop
            </button>
            {isRunning && (
              <button 
                className="btn-control btn-view-progress" 
                onClick={() => setShowScanningWindow(true)}
              >
                View Progress
              </button>
            )}
          </div>

          {isRunning && (
            <div className="current-job">
              <div className="job-info">
                <strong>Current job:</strong> {currentJobId || 'Starting...'}
              </div>
              <div className="job-details">
                <div>Started: {jobStartTime ? jobStartTime.toLocaleString() : 'Starting...'}</div>
                <div>Status: {isPaused ? 'Paused' : 'Running'}</div>
                <div>Profile: {currentProfile}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ScanningWindow
        isOpen={showScanningWindow}
        onClose={() => setShowScanningWindow(false)}
        currentStage={currentStage}
        progress={overallProgress}
        stages={pipelineStages}
      />

      <ImportResultsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImported={handleImported}
      />

      {detailOpen && (
        <div className="stage-detail-backdrop" onClick={() => setDetailOpen(false)}>
          <div className="stage-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="stage-detail-header">
              <h4>{detailTitle} — Results</h4>
              <button className="stage-detail-close" onClick={() => setDetailOpen(false)}>Close</button>
            </div>
            {detailLoading ? (
              <div className="stage-detail-empty">Loading...</div>
            ) : detailMessage ? (
              <div className="stage-detail-empty">{detailMessage}</div>
            ) : (
              <div className="stage-detail-list">
                {detailTitle === 'Subdomains' && detailItems.map((item, idx) => (
                  <div key={idx} className="stage-detail-row">
                    <span>{item.subdomain}</span>
                    <span>{item.ip || '-'}</span>
                    <span>{item.status}</span>
                    <span>{item.target}</span>
                  </div>
                ))}
                {detailTitle === 'Live hosts' && detailItems.map((item, idx) => (
                  <div key={idx} className="stage-detail-row">
                    <span>{item.subdomain}</span>
                    <span>{item.ip || '-'}</span>
                    <span>{item.target}</span>
                  </div>
                ))}
                {detailTitle === 'Vulnerability hints' && detailItems.map((item, idx) => (
                  <div key={idx} className="stage-detail-row">
                    <span>{item.severity}</span>
                    <span>{item.title}</span>
                    <span>{item.host}</span>
                    <span>{item.status}</span>
                    <span>{item.target}</span>
                  </div>
                ))}
                {detailTitle === 'DNS records' && detailItems.map((item, idx) => (
                  <div key={idx} className="stage-detail-row">
                    <span>{item.record}</span>
                    <span>{item.target}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default ReconStatusOverview
