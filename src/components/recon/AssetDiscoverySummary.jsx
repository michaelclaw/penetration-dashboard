import React, { useState, useEffect } from 'react'
import { api } from '../../services/api'
import './AssetDiscoverySummary.css'

function AssetDiscoverySummary() {
  const [rootDomains, setRootDomains] = useState([])
  const [subdomains, setSubdomains] = useState([])
  const [loading, setLoading] = useState(true)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    loadData()

    const handleVisibility = () => {
      setIsVisible(document.visibilityState === 'visible')
    }
    handleVisibility()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  useEffect(() => {
    if (!isVisible) return
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [isVisible])

  const loadData = async () => {
    try {
      const targets = await api.getTargets()
      const domains = [...new Set(targets.map(t => {
        if (t.type === 'Domain') {
          const parts = t.target.split('.')
          return parts.slice(-2).join('.')
        }
        return null
      }).filter(Boolean))]
      setRootDomains(domains)

      // Get subdomains from all targets
      if (targets.length > 0) {
        const allSubdomains = []
        for (const target of targets) {
          try {
            const subs = await api.getSubdomains({ targetId: target.id })
            allSubdomains.push(...subs)
          } catch (error) {
            console.error(`Failed to load subdomains for target ${target.id}:`, error)
          }
        }
        setSubdomains(allSubdomains)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusClass = (status) => {
    return status === 'LIVE' ? 'status-live' : 'status-dead'
  }

  const totalSubdomains = subdomains.length
  const newSubdomains = 0
  const sensitiveSubdomains = subdomains.filter(s => 
    s.subdomain && (s.subdomain.includes('dev') || s.subdomain.includes('staging') || s.subdomain.includes('test'))
  ).length
  const totalIPs = new Set(subdomains.map(s => s.ip).filter(Boolean)).size

  return (
    <div className="asset-discovery-summary">
      <h3 className="section-title">Asset Discovery Summary</h3>
      
      <div className="root-domains">
        <h4 className="subsection-title">Root domains:</h4>
        <div className="domain-tags">
          {rootDomains.length === 0 ? (
            <span style={{ color: 'var(--text-secondary)' }}>No root domains discovered yet</span>
          ) : (
            rootDomains.map((domain, idx) => (
              <span key={idx} className="domain-tag">{domain}</span>
            ))
          )}
        </div>
      </div>

      <div className="subdomain-summary">
        <h4 className="subsection-title">Subdomain summary:</h4>
        <div className="summary-cards">
          <div className="summary-card">
            <div className="card-label">Total subdomains</div>
            <div className="card-value">{totalSubdomains}</div>
          </div>
          <div className="summary-card">
            <div className="card-label">New since last run</div>
            <div className="card-value">{newSubdomains}</div>
          </div>
          <div className="summary-card">
            <div className="card-label">Potentially sensitive</div>
            <div className="card-value warning">{sensitiveSubdomains}</div>
          </div>
        </div>
      </div>

      <div className="subdomains-table">
        <h4 className="subsection-title">Subdomains table:</h4>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Subdomain</th>
                <th>IP</th>
                <th>Status</th>
                <th>First Seen</th>
                <th>Last Seen</th>
                <th>Tags</th>
              </tr>
            </thead>
            <tbody>
              {subdomains.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                    No subdomains discovered yet. Start a reconnaissance job to discover assets.
                  </td>
                </tr>
              ) : (
                subdomains.map((sub, idx) => (
                  <tr key={idx}>
                    <td>{sub.subdomain}</td>
                    <td>{sub.ip || '-'}</td>
                    <td>
                      <span className={`status-badge ${getStatusClass(sub.status || 'UNKNOWN')}`}>
                        {sub.status || 'UNKNOWN'}
                      </span>
                    </td>
                    <td>{sub.first_seen ? new Date(sub.first_seen).toLocaleDateString() : '-'}</td>
                    <td>{sub.last_seen ? new Date(sub.last_seen).toLocaleDateString() : '-'}</td>
                    <td>
                      {sub.tags ? <span className="tags">{sub.tags}</span> : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ip-asn-summary">
        <h4 className="subsection-title">IP / ASN summary:</h4>
        <div className="summary-info">
          <div><strong>Total IPs:</strong> {totalIPs}</div>
          <div><strong>ASNs:</strong> {totalIPs === 0 ? 'None discovered yet' : '-'}</div>
        </div>
      </div>
    </div>
  )
}

export default AssetDiscoverySummary
