import { spawn } from 'child_process'
import { db } from '../database.js'
// Import will be handled via dependency injection
let broadcastFn = null
export function setBroadcastFunction(fn) {
  broadcastFn = fn
}

function broadcast(data) {
  if (broadcastFn) {
    broadcastFn(data)
  }
}
import { executeSubdomainEnum } from './tools/subdomainEnum.js'
import { executeDNSEnum } from './tools/dnsEnum.js'
import { executeHTTPProbe } from './tools/httpProbe.js'
import { executeDirectoryFuzz } from './tools/directoryFuzz.js'
import { analyzeFindings } from './tools/vulnAnalysis.js'
import { resolveSubdomainIPs } from './tools/resolveIPs.js'
import { findTool, TOOL_ALIASES } from './tools/toolDetection.js'

const activeJobs = new Map()

export async function startReconJob(targetId, profile = 'Standard external') {
  const target = db.prepare('SELECT * FROM targets WHERE id = ?').get(targetId)
  if (!target) {
    throw new Error('Target not found')
  }

  const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const normalizedProfile = (profile || 'Standard external').toString()
  
  // Create job record
  db.prepare(`
    INSERT INTO recon_jobs (target_id, job_id, status, profile)
    VALUES (?, ?, 'running', ?)
  `).run(targetId, jobId, normalizedProfile)

  // Update target status
  db.prepare('UPDATE targets SET status = ?, last_run = CURRENT_TIMESTAMP WHERE id = ?')
    .run('Running', targetId)

  // Log activity
  logActivity(jobId, `Started reconnaissance for ${target.target}`, 'info')
  await logToolAvailability(jobId)

  // Start reconnaissance process
  const job = {
    id: jobId,
    targetId,
    target: target.target,
    targetType: target.type,
    status: 'running',
    profile: normalizedProfile,
    paused: false,
    currentStage: null,
    stages: {
      subdomains: { status: 'queued', count: 0 },
      dns: { status: 'queued', count: 0 },
      liveHosts: { status: 'queued', count: 0 },
      http: { status: 'queued', count: 0 },
      directories: { status: 'queued', count: 0 },
      vulnHints: { status: 'queued', count: 0 }
    }
  }

  activeJobs.set(jobId, job)
  
  // Start execution
  executeReconPipeline(job)
  
  return jobId
}

async function logToolAvailability(jobId) {
  const toolChecks = [
    { name: 'subfinder', commands: TOOL_ALIASES.subfinder },
    { name: 'assetfinder', commands: TOOL_ALIASES.assetfinder },
    { name: 'findomain', commands: TOOL_ALIASES.findomain },
    { name: 'nmap', commands: TOOL_ALIASES.nmap },
    { name: 'httpx', commands: TOOL_ALIASES.httpx },
    { name: 'gobuster', commands: TOOL_ALIASES.gobuster },
    { name: 'dig', commands: TOOL_ALIASES.dig },
    { name: 'curl', commands: ['curl'] }
  ]

  for (const tool of toolChecks) {
    const resolved = await findTool(tool.commands)
    if (resolved) {
      logActivity(jobId, `Tool check: ${tool.name} -> ${resolved}`, 'info')
    } else {
      logActivity(jobId, `Tool check: ${tool.name} not found on PATH`, 'warning')
    }
  }
}

function normalizeTarget(value) {
  let target = (value || '').toString().trim()
  if (!target) return target
  try {
    if (target.includes('://')) {
      target = new URL(target).hostname
    }
  } catch {
    target = target.replace(/^[a-z]+:\/\//i, '')
  }
  target = target
    .split('/')[0]
    .split('?')[0]
    .split('#')[0]
    .replace(/\.$/, '')
  return target
}

async function executeReconPipeline(job) {
  try {
    const isStealth = job.profile === 'Stealth'
    const isOsintHeavy = job.profile === 'OSINT-heavy'
    const targetType = (job.targetType || '').toString().toLowerCase()
    const isDomain = targetType === 'domain'
    const isIp = targetType === 'ip'
    const isCidr = targetType === 'cidr'
    const isOrg = targetType.includes('org')
    const logger = (message, level = 'info') => logActivity(job.id, message, level)
    const normalizedTarget = normalizeTarget(job.target)

    const skipStage = (stageKey, stageName, message) => {
      job.stages[stageKey].status = 'skipped'
      job.stages[stageKey].count = 0
      broadcast({ type: 'stage_update', jobId: job.id, stage: stageName, status: 'skipped', count: 0 })
      logActivity(job.id, message, 'warning')
    }
    let liveHosts = []

    // Stage 1: Subdomain Enumeration
    if (job.paused || job.status !== 'running') return
    job.currentStage = 'Subdomains'
    if (!isDomain) {
      skipStage('subdomains', 'Subdomains', `Subdomain enumeration skipped for target type (${job.targetType})`)
      if (isIp) {
        db.prepare(`
          INSERT OR IGNORE INTO subdomains (target_id, job_id, subdomain, ip, status)
          VALUES (?, ?, ?, ?, 'UNKNOWN')
        `).run(job.targetId, job.id, job.target, job.target)
      }
    } else {
      job.stages.subdomains.status = 'running'
      broadcast({ type: 'stage_update', jobId: job.id, stage: 'Subdomains', status: 'running' })

      let subdomains = await executeSubdomainEnum(normalizedTarget, logger)
      if (job.status !== 'running') return

      if (subdomains.length === 0) {
        subdomains = [normalizedTarget]
        logActivity(job.id, `No subdomains found. Using target ${normalizedTarget} as seed host`, 'warning')
      }
      
      job.stages.subdomains.count = subdomains.length
      job.stages.subdomains.status = 'done'
      
      // Resolve IPs for subdomains
      const subdomainIPs = await resolveSubdomainIPs(subdomains, logger)
      
      // Save subdomains to database with IPs
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO subdomains (target_id, job_id, subdomain, ip, status)
        VALUES (?, ?, ?, ?, 'UNKNOWN')
      `)
      subdomainIPs.forEach(({ subdomain, ip }) => {
        stmt.run(job.targetId, job.id, subdomain, ip)
      })
      
      broadcast({ 
        type: 'stage_update', 
        jobId: job.id, 
        stage: 'Subdomains', 
        status: 'done', 
        count: subdomains.length 
      })
      logActivity(job.id, `Subdomain enumeration completed: ${subdomains.length} found`, 'info')
    }

    // Stage 2: DNS Records
    if (job.paused || job.status !== 'running') return
    job.currentStage = 'DNS records'
    if (!isDomain) {
      skipStage('dns', 'DNS records', `DNS enumeration skipped for target type (${job.targetType})`)
    } else {
      job.stages.dns.status = 'running'
      broadcast({ type: 'stage_update', jobId: job.id, stage: 'DNS records', status: 'running' })
      
      const dnsRecords = await executeDNSEnum(normalizedTarget, logger)
      if (job.status !== 'running') return
      
      job.stages.dns.count = dnsRecords.length
      job.stages.dns.status = 'done'

      const dnsStmt = db.prepare(`
        INSERT INTO dns_records (target_id, job_id, record)
        VALUES (?, ?, ?)
      `)
      dnsRecords.forEach(record => {
        dnsStmt.run(job.targetId, job.id, record)
      })
      
      broadcast({ 
        type: 'stage_update', 
        jobId: job.id, 
        stage: 'DNS records', 
        status: 'done', 
        count: dnsRecords.length 
      })
      logActivity(job.id, `DNS enumeration completed: ${dnsRecords.length} records found`, 'info')
    }

    // Stage 3: Live Hosts (from subdomains)
    if (job.paused || job.status !== 'running') return
    job.currentStage = 'Live hosts'
    if (isCidr || isOrg) {
      skipStage('liveHosts', 'Live hosts', `Live host detection skipped for target type (${job.targetType})`)
    } else {
      job.stages.liveHosts.status = 'running'
      broadcast({ type: 'stage_update', jobId: job.id, stage: 'Live hosts', status: 'running' })
      
      let subdomainList = []
      if (isDomain) {
        subdomainList = db.prepare('SELECT subdomain FROM subdomains WHERE target_id = ?')
          .all(job.targetId).map(r => r.subdomain)
      } else if (isIp) {
        subdomainList = [normalizedTarget]
        db.prepare(`
          INSERT OR IGNORE INTO subdomains (target_id, job_id, subdomain, ip, status)
          VALUES (?, ?, ?, ?, 'UNKNOWN')
        `).run(job.targetId, job.id, normalizedTarget, normalizedTarget)
      }
      
      liveHosts = await executeHTTPProbe(subdomainList, logger)
      if (job.status !== 'running') return
      
      job.stages.liveHosts.count = liveHosts.length
      job.stages.liveHosts.status = 'done'
      
      // Update subdomain status
      const updateStmt = db.prepare('UPDATE subdomains SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE subdomain = ?')
      liveHosts.forEach(host => {
        updateStmt.run('LIVE', host)
      })

      const liveSet = new Set(liveHosts)
      const markDeadStmt = db.prepare('UPDATE subdomains SET status = ? WHERE target_id = ? AND subdomain = ?')
      subdomainList.forEach(subdomain => {
        if (!liveSet.has(subdomain)) {
          markDeadStmt.run('DEAD', job.targetId, subdomain)
        }
      })
      
      broadcast({ 
        type: 'stage_update', 
        jobId: job.id, 
        stage: 'Live hosts', 
        status: 'done', 
        count: liveHosts.length 
      })
      logActivity(job.id, `Live host detection completed: ${liveHosts.length} hosts`, 'info')
    }

    // Stage 4: HTTP Probing
    if (job.paused || job.status !== 'running') return
    job.currentStage = 'HTTP probing'
    if (isCidr || isOrg) {
      job.stages.http.status = 'skipped'
      job.stages.http.count = 0
      broadcast({ type: 'stage_update', jobId: job.id, stage: 'HTTP probing', status: 'skipped', count: 0 })
      logActivity(job.id, `HTTP probing skipped due to target type (${job.targetType})`, 'warning')
    } else {
      job.stages.http.status = 'running'
      broadcast({ type: 'stage_update', jobId: job.id, stage: 'HTTP probing', status: 'running' })
    
    let httpHosts = db.prepare(`
      SELECT DISTINCT host FROM services 
      WHERE target_id = ? AND (port = 80 OR port = 443 OR port = 8080 OR port = 8443)
    `).all(job.targetId).map(r => r.host)

    if (httpHosts.length === 0) {
      httpHosts = liveHosts
    }
    
      const httpServices = await executeHTTPProbe(httpHosts, logger)
      if (job.status !== 'running') return
      
      job.stages.http.count = httpServices.length
      job.stages.http.status = 'done'
      
      if (httpServices.length > 0) {
        const ipRows = db.prepare('SELECT subdomain, ip FROM subdomains WHERE target_id = ?').all(job.targetId)
        const ipMap = new Map(ipRows.map(row => [row.subdomain, row.ip]))
        const insertStmt = db.prepare(`
          INSERT INTO services (target_id, job_id, host, ip, port, protocol, service_name, http_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        httpServices.forEach(entry => {
          const protocol = entry.protocol || 'http'
          const port = protocol === 'https' ? 443 : 80
          insertStmt.run(
            job.targetId,
            job.id,
            entry.host,
            ipMap.get(entry.host) || entry.host,
            port,
            protocol,
            protocol,
            entry.status || null
          )
        })
      }
      
      broadcast({ 
        type: 'stage_update', 
        jobId: job.id, 
        stage: 'HTTP probing', 
        status: 'done', 
        count: httpServices.length 
      })
      logActivity(job.id, `HTTP probing completed: ${httpServices.length} HTTP services`, 'info')
    }

    // Stage 6: Directory Fuzzing
    if (job.paused || job.status !== 'running') return
    job.currentStage = 'Directories'
    if (isStealth || isOsintHeavy || isCidr || isOrg) {
      job.stages.directories.status = 'skipped'
      job.stages.directories.count = 0
      broadcast({ type: 'stage_update', jobId: job.id, stage: 'Directories', status: 'skipped', count: 0 })
      const reason = isStealth || isOsintHeavy ? `profile (${job.profile})` : `target type (${job.targetType})`
      logActivity(job.id, `Directory fuzzing skipped due to ${reason}`, 'warning')
    } else {
      job.stages.directories.status = 'running'
      broadcast({ type: 'stage_update', jobId: job.id, stage: 'Directories', status: 'running' })
    
    let dirHosts = db.prepare(`
      SELECT DISTINCT host FROM services 
      WHERE target_id = ? AND (port = 80 OR port = 443)
    `).all(job.targetId).slice(0, 5).map(r => r.host)

    if (dirHosts.length === 0) {
      dirHosts = liveHosts.slice(0, 5)
    }
    
      const directories = await executeDirectoryFuzz(dirHosts, logger)
      if (job.status !== 'running') return
      
      job.stages.directories.count = directories.length
      job.stages.directories.status = 'done'
      
      broadcast({ 
        type: 'stage_update', 
        jobId: job.id, 
        stage: 'Directories', 
        status: 'done', 
        count: directories.length 
      })
      logActivity(job.id, `Directory fuzzing completed: ${directories.length} directories found`, 'info')
    }

    // Stage 7: Vulnerability Analysis
    if (job.paused || job.status !== 'running') return
    job.currentStage = 'Vulnerability hints'
    job.stages.vulnHints.status = 'running'
    broadcast({ type: 'stage_update', jobId: job.id, stage: 'Vulnerability hints', status: 'running' })
    
    const findings = await analyzeFindings(job.targetId, job.id)
    if (job.status !== 'running') return
    
    job.stages.vulnHints.count = findings.length
    job.stages.vulnHints.status = 'done'
    
    broadcast({ 
      type: 'stage_update', 
      jobId: job.id, 
      stage: 'Vulnerability hints', 
      status: 'done', 
      count: findings.length 
    })
    logActivity(job.id, `Vulnerability analysis completed: ${findings.length} findings`, 'info')

    // Job complete
    if (job.status === 'running') {
      job.status = 'completed'
      job.currentStage = null
      
      db.prepare('UPDATE recon_jobs SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE job_id = ?')
        .run('completed', job.id)
      
      db.prepare('UPDATE targets SET status = ? WHERE id = ?').run('Completed', job.targetId)
      
      broadcast({ type: 'job_complete', jobId: job.id })
      logActivity(job.id, 'Reconnaissance job completed successfully', 'success')
      
      activeJobs.delete(job.id)
    }

  } catch (error) {
    console.error('Recon pipeline error:', error)
    job.status = 'failed'
    db.prepare('UPDATE recon_jobs SET status = ? WHERE job_id = ?').run('failed', job.id)
    broadcast({ type: 'job_error', jobId: job.id, error: error.message })
    logActivity(job.id, `Error: ${error.message}`, 'error')
    activeJobs.delete(job.id)
  }
}

export function stopReconJob(jobId) {
  const job = activeJobs.get(jobId)
  if (job) {
    job.status = 'stopped'
    job.paused = false
    db.prepare('UPDATE recon_jobs SET status = ? WHERE job_id = ?').run('stopped', jobId)
    broadcast({ type: 'job_stopped', jobId })
    logActivity(jobId, 'Reconnaissance stopped by user', 'warning')
    activeJobs.delete(jobId)
  }
}

export function pauseReconJob(jobId) {
  const job = activeJobs.get(jobId)
  if (job) {
    job.paused = true
    broadcast({ type: 'job_paused', jobId })
    logActivity(jobId, 'Reconnaissance paused', 'info')
  }
}

export function resumeReconJob(jobId) {
  const job = activeJobs.get(jobId)
  if (job) {
    job.paused = false
    broadcast({ type: 'job_resumed', jobId })
    logActivity(jobId, 'Reconnaissance resumed', 'info')
    // Resume pipeline execution
    executeReconPipeline(job)
  }
}

export function getJobStatus(jobId) {
  const job = activeJobs.get(jobId)
  if (!job) {
    const dbJob = db.prepare('SELECT * FROM recon_jobs WHERE job_id = ?').get(jobId)
    return dbJob
  }
  return job
}

function logActivity(jobId, message, level = 'info') {
  db.prepare(`
    INSERT INTO activity_logs (job_id, message, level)
    VALUES (?, ?, ?)
  `).run(jobId, message, level)
  
  broadcast({ 
    type: 'activity', 
    jobId, 
    message, 
    level, 
    timestamp: new Date().toISOString() 
  })
}
