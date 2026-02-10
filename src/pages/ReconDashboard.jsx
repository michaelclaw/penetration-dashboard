import React from 'react'
import TargetScopePanel from '../components/recon/TargetScopePanel'
import ReconStatusOverview from '../components/recon/ReconStatusOverview'
import AssetDiscoverySummary from '../components/recon/AssetDiscoverySummary'
import FindingsAlerts from '../components/recon/FindingsAlerts'
import ActivityLogs from '../components/recon/ActivityLogs'
import ControlsConfig from '../components/recon/ControlsConfig'
import './ReconDashboard.css'

function ReconDashboard() {
  return (
    <div className="recon-dashboard">
      <div className="dashboard-header">
        <h2>Reconnaissance Management Panel</h2>
        <p className="dashboard-subtitle">Target intake, scanning, and OSINT workflows</p>
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-section">
          <TargetScopePanel />
        </section>

        <section className="dashboard-section">
          <ReconStatusOverview />
        </section>

        <section className="dashboard-section">
          <AssetDiscoverySummary />
        </section>

        <section className="dashboard-section">
          <FindingsAlerts />
        </section>

        <section className="dashboard-section">
          <ActivityLogs />
        </section>

        <section className="dashboard-section">
          <ControlsConfig />
        </section>
      </div>
    </div>
  )
}

export default ReconDashboard
