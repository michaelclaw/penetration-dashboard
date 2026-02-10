import express from 'express'
import { db } from '../database.js'

export const servicesRouter = express.Router()

// Get services for a target
servicesRouter.get('/', (req, res) => {
  try {
    const { targetId, jobId, port } = req.query
    const limit = Math.min(parseInt(req.query.limit || '500', 10), 5000)
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0)
    
    let sql = 'SELECT * FROM services WHERE 1=1'
    const params = []

    if (targetId) {
      sql += ' AND target_id = ?'
      params.push(targetId)
    }
    if (jobId) {
      sql += ' AND job_id = ?'
      params.push(jobId)
    }
    if (port) {
      sql += ' AND port = ?'
      params.push(Number(port))
    }

    sql += ' ORDER BY discovered_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)
    const services = db.prepare(sql).all(...params)
    res.json(services)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
