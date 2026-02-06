import { db } from '../../database.js'

export async function analyzeFindings(targetId, jobId) {
  const findings = []
  
  // Analyze subdomains for potential takeovers
  const subdomains = db.prepare(`
    SELECT subdomain, status FROM subdomains 
    WHERE target_id = ? AND status = 'DEAD'
  `).all(targetId)
  
  subdomains.forEach(sub => {
    findings.push({
      severity: 'HIGH',
      type: 'takeover',
      title: `Potential subdomain takeover: ${sub.subdomain}`,
      host: sub.subdomain,
      description: 'Subdomain appears to be dead and may be vulnerable to takeover',
      jobId
    })
  })
  
  // Analyze services for exposed admin panels
  const services = db.prepare(`
    SELECT host, port FROM services 
    WHERE target_id = ? AND (
      host LIKE '%admin%' OR 
      host LIKE '%panel%' OR 
      host LIKE '%dashboard%' OR
      port IN (8080, 8443, 9090)
    )
  `).all(targetId)
  
  services.forEach(service => {
    findings.push({
      severity: 'MEDIUM',
      type: 'exposed-panel',
      title: `Potential admin panel: ${service.host}:${service.port}`,
      host: service.host,
      description: 'Possible administrative interface exposed',
      jobId
    })
  })
  
  // Analyze HTTP services for common issues
  const httpServices = db.prepare(`
    SELECT DISTINCT host FROM services 
    WHERE target_id = ? AND (port = 80 OR port = 443)
  `).all(targetId)
  
  // Save findings to database
  const stmt = db.prepare(`
    INSERT INTO findings (target_id, job_id, severity, type, title, host, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  
  findings.forEach(finding => {
    stmt.run(
      targetId,
      jobId,
      finding.severity,
      finding.type,
      finding.title,
      finding.host || '',
      finding.description
    )
  })
  
  return findings
}
