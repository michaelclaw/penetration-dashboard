import express from 'express'
import { db } from '../database.js'

export const importRouter = express.Router()

function normalizeSubdomains(input) {
  if (!input) return []
  if (Array.isArray(input)) {
    return [...new Set(input.map((s) => (s || '').toString().trim()).filter(Boolean))]
  }
  if (typeof input === 'string') {
    return [...new Set(input.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))]
  }
  return []
}

function safeJsonArray(input) {
  if (!input) return []
  if (Array.isArray(input)) return input
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function broadcast(req, payload) {
  const fn = req.app?.locals?.broadcast
  if (typeof fn === 'function') fn(payload)
}

function logActivity(req, jobId, message, level = 'info') {
  db.prepare(
    `
    INSERT INTO activity_logs (job_id, message, level)
    VALUES (?, ?, ?)
  `
  ).run(jobId, message, level)

  broadcast(req, {
    type: 'activity',
    jobId,
    message,
    level,
    timestamp: new Date().toISOString()
  })
}

// POST /api/import
// Body:
// {
//   targetId: number,
//   subdomains: string[] | "newline\nlist",
//   services: object[] | "[{...}]",
//   findings: object[] | "[{...}]",
//   activity: string[] | "newline\nlist"
// }
importRouter.post('/', (req, res) => {
  try {
    const { targetId } = req.body || {}
    if (!targetId) return res.status(400).json({ error: 'targetId is required' })

    const target = db.prepare('SELECT * FROM targets WHERE id = ?').get(targetId)
    if (!target) return res.status(404).json({ error: 'Target not found' })

    const jobId = `import-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

    db.prepare(
      `
      INSERT INTO recon_jobs (target_id, job_id, status, profile, completed_at)
      VALUES (?, ?, 'completed', 'imported', CURRENT_TIMESTAMP)
    `
    ).run(targetId, jobId)

    db.prepare('UPDATE targets SET status = ?, last_run = CURRENT_TIMESTAMP WHERE id = ?').run(
      'Completed',
      targetId
    )

    logActivity(req, jobId, `Imported results for ${target.target}`, 'info')

    const subdomains = normalizeSubdomains(req.body.subdomains)
    const services = safeJsonArray(req.body.services)
    const findings = safeJsonArray(req.body.findings)
    const activityLines = normalizeSubdomains(req.body.activity) // reuse newline normalization

    // Stage updates: start
    broadcast(req, { type: 'stage_update', jobId, stage: 'Subdomains', status: 'running' })

    // Insert subdomains
    const subStmt = db.prepare(
      `
      INSERT OR IGNORE INTO subdomains (target_id, job_id, subdomain, ip, status)
      VALUES (?, ?, ?, ?, ?)
    `
    )
    let subInserted = 0
    for (const s of subdomains) {
      const info = subStmt.run(targetId, jobId, s, null, 'UNKNOWN')
      if (info.changes) subInserted++
    }

    broadcast(req, { type: 'stage_update', jobId, stage: 'Subdomains', status: 'done', count: subInserted })
    logActivity(req, jobId, `Imported subdomains: ${subInserted}`, 'info')

    // Services stage
    broadcast(req, { type: 'stage_update', jobId, stage: 'Ports/services', status: 'running' })

    const svcStmt = db.prepare(
      `
      INSERT INTO services (target_id, job_id, host, ip, port, protocol, service_name, http_status, technology, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )

    let svcInserted = 0
    let svcSkipped = 0
    for (const row of services) {
      const host = (row?.host || row?.hostname || '').toString().trim()
      const ip = (row?.ip || '').toString().trim()
      const port = Number(row?.port)
      const protocol = (row?.protocol || row?.proto || 'tcp').toString().trim().toLowerCase()
      const serviceName = (row?.service_name || row?.service || '').toString().trim() || null
      const httpStatus = row?.http_status !== undefined ? Number(row.http_status) : null
      const technology = (row?.technology || row?.tech || '').toString().trim() || null
      const notes = (row?.notes || '').toString().trim() || null

      if (!host || !ip || !Number.isFinite(port)) {
        svcSkipped++
        continue
      }

      svcStmt.run(targetId, jobId, host, ip, port, protocol || 'tcp', serviceName, httpStatus, technology, notes)
      svcInserted++
    }

    broadcast(req, { type: 'stage_update', jobId, stage: 'Ports/services', status: 'done', count: svcInserted })
    logActivity(
      req,
      jobId,
      svcSkipped ? `Imported services: ${svcInserted} (skipped ${svcSkipped} invalid rows)` : `Imported services: ${svcInserted}`,
      svcSkipped ? 'warning' : 'info'
    )

    // Findings stage (maps to Vulnerability hints in UI)
    broadcast(req, { type: 'stage_update', jobId, stage: 'Vulnerability hints', status: 'running' })

    const findingStmt = db.prepare(
      `
      INSERT INTO findings (target_id, job_id, severity, type, title, host, description, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    let findingInserted = 0
    let findingSkipped = 0
    for (const f of findings) {
      const severity = (f?.severity || 'LOW').toString().trim().toUpperCase()
      const type = (f?.type || 'import').toString().trim()
      const title = (f?.title || '').toString().trim()
      const host = (f?.host || '').toString().trim() || null
      const description = (f?.description || '').toString().trim() || null
      const status = (f?.status || 'Open').toString().trim()

      if (!title) {
        findingSkipped++
        continue
      }
      findingStmt.run(targetId, jobId, severity, type, title, host, description, status)
      findingInserted++
    }

    broadcast(req, { type: 'stage_update', jobId, stage: 'Vulnerability hints', status: 'done', count: findingInserted })
    logActivity(req, jobId, `Imported findings: ${findingInserted}`, 'info')

    // Extra activity lines (optional)
    for (const line of activityLines) {
      logActivity(req, jobId, line, 'info')
    }

    broadcast(req, { type: 'job_complete', jobId })

    res.json({
      jobId,
      imported: {
        subdomains: subInserted,
        services: svcInserted,
        findings: findingInserted,
        activity: activityLines.length
      }
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

