import React from 'react'
import './ScanningWindow.css'

function ScanningWindow({ isOpen, onClose, currentStage, progress, stages }) {
  if (!isOpen) return null

  const isRunning = stages.some(s => s.status === 'RUNNING') || (progress > 0 && progress < 100)

  const getStageStatus = (stageName) => {
    const stage = stages.find(s => s.name === stageName)
    if (!stage) return 'queued'
    if (stage.status === 'DONE') return 'done'
    if (stage.status === 'RUNNING') return 'running'
    return 'queued'
  }

  const getStageProgress = (stageName) => {
    if (stageName === currentStage) {
      return progress
    }
    const stage = stages.find(s => s.name === stageName)
    if (stage && stage.status === 'DONE') return 100
    if (stage && stage.status === 'RUNNING') return 50
    return 0
  }

  const stageList = [
    'Subdomains',
    'DNS records',
    'Live hosts',
    'Ports/services',
    'HTTP probing',
    'Directories',
    'OSINT',
    'Vulnerability hints'
  ]

  return (
    <div className="scanning-overlay" onClick={onClose}>
      <div className="scanning-window" onClick={(e) => e.stopPropagation()}>
        <div className="scanning-header">
          <h2>Reconnaissance in Progress</h2>
          <button 
            className="scanning-close" 
            onClick={onClose}
            title="Close (you can reopen with 'View Progress' button)"
          >
            ×
          </button>
        </div>
        
        <div className="scanning-content">
          <div className="overall-progress">
            <div className="progress-label">
              <span>Overall Progress</span>
              <span className="progress-percentage">{Math.round(progress)}%</span>
            </div>
            <div className="progress-bar-container">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>

          <div className="current-stage-info">
            <div className="current-stage-label">Current Stage:</div>
            <div className="current-stage-name">{currentStage || 'Initializing...'}</div>
          </div>

          <div className="stages-list">
            {stageList.map((stageName, idx) => {
              const status = getStageStatus(stageName)
              const stageProgress = getStageProgress(stageName)
              const stage = stages.find(s => s.name === stageName)
              
              return (
                <div key={idx} className={`stage-item stage-${status}`}>
                  <div className="stage-header">
                    <span className="stage-name">{stageName}</span>
                    <span className="stage-status-badge">{status.toUpperCase()}</span>
                  </div>
                  <div className="stage-progress-bar">
                    <div 
                      className="stage-progress-fill" 
                      style={{ width: `${stageProgress}%` }}
                    ></div>
                  </div>
                  {stage && stage.count > 0 && (
                    <div className="stage-count">{stage.count} found</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ScanningWindow
