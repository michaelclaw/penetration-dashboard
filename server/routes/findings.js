import express from 'express'
import { db } from '../database.js'

export const findingsRouter = express.Router()

// Get all findings
findingsRouter.get('/', (req, res) => {
  try {
    const { targetId, severity, status, type, jobId } = req.query
    const limit = Math.min(parseInt(req.query.limit || '200', 10), 2000)
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0)
    let sql = 'SELECT * FROM findings WHERE 1=1'
    const params = []

    if (targetId) {
      sql += ' AND target_id = ?'
      params.push(targetId)
    }
    if (jobId) {
      sql += ' AND job_id = ?'
      params.push(jobId)
    }
    if (severity) {
      sql += ' AND severity = ?'
      params.push(severity)
    }
    if (type) {
      sql += ' AND type = ?'
      params.push(type)
    }
    if (status) {
      sql += ' AND status = ?'
      params.push(status)
    }

    sql += ' ORDER BY first_seen DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)
    const findings = db.prepare(sql).all(...params)
    res.json(findings)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get findings summary
findingsRouter.get('/summary', (req, res) => {
  try {
    const summary = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN severity = 'HIGH' THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN severity = 'MEDIUM' THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN severity = 'LOW' THEN 1 ELSE 0 END) as low
      FROM findings
    `).get()
    
    res.json(summary)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update finding status
findingsRouter.put('/:id', (req, res) => {
  try {
    const { status } = req.body
    db.prepare('UPDATE findings SET status = ? WHERE id = ?').run(status, req.params.id)
    const finding = db.prepare('SELECT * FROM findings WHERE id = ?').get(req.params.id)
    res.json(finding)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
