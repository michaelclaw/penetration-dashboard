import express from 'express'
import { promisify } from 'util'
import { exec } from 'child_process'
import { db } from '../database.js'
import { findTool, TOOL_ALIASES } from '../services/tools/toolDetection.js'
import { broadcast } from '../server.js'

const execAsync = promisify(exec)

export const scansRouter = express.Router()

const SCAN_TOOLS = new Set(['nmap', 'nuclei', 'nikto'])

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

async function runCommand({ cmd, timeout = 180000, allowFailure = false }) {
  try {
    const result = await execAsync(cmd, {
      timeout,
      maxBuffer: 20 * 1024 * 1024
    })
    return result
  } catch (error) {
    if (allowFailure) {
      return {
        stdout: error?.stdout || '',
        stderr: error?.stderr || '',
        code: error?.code
      }
    }
    throw error
  }
}

function parseNmapGrepable(output, fallbackHost) {
  const services = []
  const lines = output.split('\n')
  for (const line of lines) {
    if (!line.includes('Ports:')) continue
    const hostMatch = line.match(/^Host:\s+([^\s]+)\s+/)
    const host = hostMatch?.[1] || fallbackHost
    const portsPart = line.split('Ports:')[1]?.trim()
    if (!portsPart) continue
    const portEntries = portsPart.split(',').map(entry => entry.trim()).filter(Boolean)
    portEntries.forEach(entry => {
      const fields = entry.split('/')
      if (fields.length < 3) return
      const port = parseInt(fields[0], 10)
      const state = fields[1]
      const protocol = fields[2]
      const serviceName = fields[4] || 'unknown'
      const versionInfo = fields[6] || ''
      if (state !== 'open') return
      services.push({
        host,
        ip: host,
        port,
        protocol: protocol.toLowerCase(),
        service: serviceName,
        technology: versionInfo
      })
    })
  }
  return services
}

async function runNmapScan({ scanId, target }) {
  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0
  const scanType = isRoot ? '-sS' : '-sT'
  const nmap = await findTool(TOOL_ALIASES.nmap)
  if (!nmap) {
    throw new Error('nmap is not installed')
  }
  const cmd = `${nmap} ${scanType} -sV -T3 -Pn --top-ports 100 -oG - ${target}`
  const result = await runCommand({ cmd, timeout: 240000 })
  const stdout = result.stdout || ''
  const services = parseNmapGrepable(stdout, target)
  return { raw: stdout, services }
}

function normalizeScanUrl(value) {
  const trimmed = (value || '').toString().trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  return `http://${trimmed}`
}

async function runNucleiScan({ scanId, target, urlOverride }) {
  const nuclei = await findTool(TOOL_ALIASES.nuclei)
  if (!nuclei) {
    throw new Error('nuclei is not installed')
  }
  const targetUrl = normalizeScanUrl(urlOverride || target)
  const cmd = `${nuclei} -u ${targetUrl} -jsonl -silent`
  const result = await runCommand({ cmd, timeout: 300000, allowFailure: true })
  const stdout = result.stdout || ''
  const stderr = result.stderr || ''
  const findings = []
  stdout.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (!trimmed) return
    try {
      const item = JSON.parse(trimmed)
      const severity = (item?.info?.severity || 'low').toUpperCase()
      const title = item?.info?.name || item?.template_id || 'Nuclei finding'
      const host = item?.matched_at || item?.host || target
      const description = item?.info?.description || `Template: ${item?.template_id || 'unknown'}`
      findings.push({
        severity,
        type: 'nuclei',
        title,
        host,
        description
      })
    } catch {
      // ignore non-JSON lines
    }
  })
  const raw = [stdout, stderr].filter(Boolean).join('\n')
  return { raw, findings, exitCode: result.code }
}

function parseNiktoJson(raw, target) {
  try {
    const cleaned = raw
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
    const data = JSON.parse(cleaned)
    const items = data?.vulnerabilities || data?.vulns || data?.items || []
    if (!Array.isArray(items)) return []
    return items.map(item => ({
      severity: 'MEDIUM',
      type: 'nikto',
      title: item?.msg || item?.id || 'Nikto finding',
      host: item?.url || target,
      description: item?.msg || item?.osvdb || 'Nikto finding'
    }))
  } catch {
    return []
  }
}

function parseNiktoText(raw, target) {
  const findings = []
  raw.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('+')) return
    const message = trimmed.replace(/^\+\s*/, '')
    if (!message) return
    findings.push({
      severity: 'LOW',
      type: 'nikto',
      title: message.slice(0, 120),
      host: target,
      description: message
    })
  })
  return findings
}

async function runNiktoScan({ scanId, target }) {
  const nikto = await findTool(TOOL_ALIASES.nikto)
  if (!nikto) {
    throw new Error('nikto is not installed')
  }
  const cmd = `${nikto} -h ${target} -Format json -o -`
  let stdout = ''
  try {
    const result = await runCommand({ cmd, timeout: 300000 })
    stdout = result.stdout || ''
  } catch (error) {
    stdout = error?.stdout || ''
  }
  let findings = parseNiktoJson(stdout, target)
  if (findings.length === 0) {
    findings = parseNiktoText(stdout, target)
  }
  return { raw: stdout, findings }
}

async function finalizeScan(scanId, status, rawOutput, summary, tool) {
  const MAX_RAW_LENGTH = 200000
  const safeRaw = (rawOutput || '').slice(0, MAX_RAW_LENGTH)
  db.prepare(`
    UPDATE scan_runs
    SET status = ?, completed_at = CURRENT_TIMESTAMP, raw_output = ?, summary_json = ?
    WHERE scan_id = ?
  `).run(status, safeRaw, JSON.stringify(summary || {}), scanId)
  logActivity(scanId, `${tool} scan ${status}`, status === 'completed' ? 'success' : 'error')
}

async function runScanInBackground({ scanId, targetId, target, tool, options }) {
  try {
    if (tool === 'nmap') {
      const { raw, services } = await runNmapScan({ scanId, target })
      if (services.length) {
        const stmt = db.prepare(`
          INSERT INTO services (target_id, job_id, host, ip, port, protocol, service_name, technology)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        services.forEach(service => {
          stmt.run(
            targetId,
            scanId,
            service.host,
            service.ip,
            service.port,
            service.protocol,
            service.service,
            service.technology || ''
          )
        })
      }
      const summary = {
        totalServices: services.length,
        totalHosts: new Set(services.map(item => item.host)).size
      }
      await finalizeScan(scanId, 'completed', raw, summary, tool)
      return
    }

    if (tool === 'nuclei') {
      const { raw, findings, exitCode } = await runNucleiScan({ scanId, target, urlOverride: options?.urlOverride })
      if (findings.length) {
        const stmt = db.prepare(`
          INSERT INTO findings (target_id, job_id, severity, type, title, host, description)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        findings.forEach(finding => {
          stmt.run(
            targetId,
            scanId,
            finding.severity,
            finding.type,
            finding.title,
            finding.host || '',
            finding.description || ''
          )
        })
      }
      const summary = findings.reduce((acc, f) => {
        const key = f.severity.toLowerCase()
        acc[key] = (acc[key] || 0) + 1
        acc.total += 1
        return acc
      }, { total: 0 })
      if (exitCode && exitCode !== 0) {
        await finalizeScan(scanId, 'error', raw, { error: true, ...summary }, tool)
      } else {
        await finalizeScan(scanId, 'completed', raw, summary, tool)
      }
      return
    }

    if (tool === 'nikto') {
      const { raw, findings } = await runNiktoScan({ scanId, target })
      if (findings.length) {
        const stmt = db.prepare(`
          INSERT INTO findings (target_id, job_id, severity, type, title, host, description)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        findings.forEach(finding => {
          stmt.run(
            targetId,
            scanId,
            finding.severity,
            finding.type,
            finding.title,
            finding.host || '',
            finding.description || ''
          )
        })
      }
      const summary = findings.reduce((acc, f) => {
        const key = f.severity.toLowerCase()
        acc[key] = (acc[key] || 0) + 1
        acc.total += 1
        return acc
      }, { total: 0 })
      await finalizeScan(scanId, 'completed', raw, summary, tool)
    }
  } catch (error) {
    await finalizeScan(scanId, 'error', error?.message || 'Scan failed', { error: true }, tool)
  }
}

scansRouter.get('/', (req, res) => {
  try {
    const { targetId, tool } = req.query
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200)
    let sql = `
      SELECT scan_id, target_id, tool, status, started_at, completed_at, summary_json
      FROM scan_runs
      WHERE 1=1
    `
    const params = []
    if (targetId) {
      sql += ' AND target_id = ?'
      params.push(targetId)
    }
    if (tool) {
      sql += ' AND tool = ?'
      params.push(tool)
    }
    sql += ' ORDER BY started_at DESC LIMIT ?'
    params.push(limit)
    const runs = db.prepare(sql).all(...params)
    res.json(runs)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

scansRouter.get('/:scanId', (req, res) => {
  try {
    const includeRaw = req.query.includeRaw === '1'
    const sql = includeRaw
      ? 'SELECT * FROM scan_runs WHERE scan_id = ?'
      : 'SELECT scan_id, target_id, tool, status, started_at, completed_at, summary_json FROM scan_runs WHERE scan_id = ?'
    const run = db.prepare(sql).get(req.params.scanId)
    if (!run) {
      return res.status(404).json({ error: 'Scan not found' })
    }
    res.json(run)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

scansRouter.post('/start', async (req, res) => {
  try {
    const { targetId, tool, options } = req.body || {}
    if (!targetId || !tool) {
      return res.status(400).json({ error: 'targetId and tool are required' })
    }
    if (!SCAN_TOOLS.has(tool)) {
      return res.status(400).json({ error: 'Unsupported scan tool' })
    }

    const target = db.prepare('SELECT * FROM targets WHERE id = ?').get(targetId)
    if (!target) {
      return res.status(404).json({ error: 'Target not found' })
    }

    const scanId = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    db.prepare(`
      INSERT INTO scan_runs (scan_id, target_id, tool, status, options_json)
      VALUES (?, ?, ?, 'running', ?)
    `).run(scanId, targetId, tool, JSON.stringify(options || {}))

    logActivity(scanId, `${tool} scan started for ${target.target}`, 'info')
    res.json({ scanId, message: 'Scan started' })

    runScanInBackground({ scanId, targetId, target: target.target, tool, options })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
