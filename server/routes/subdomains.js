import express from 'express'
import { db } from '../database.js'

export const subdomainsRouter = express.Router()

// Get subdomains for a target
subdomainsRouter.get('/', (req, res) => {
  try {
    const { targetId } = req.query
    
    let sql = 'SELECT * FROM subdomains WHERE 1=1'
    const params = []

    if (targetId) {
      sql += ' AND target_id = ?'
      params.push(targetId)
    }

    sql += ' ORDER BY last_seen DESC'
    const subdomains = db.prepare(sql).all(...params)
    res.json(subdomains)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get subdomain summary
subdomainsRouter.get('/summary', (req, res) => {
  try {
    const { targetId } = req.query
    let sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'LIVE' THEN 1 ELSE 0 END) as live,
        COUNT(DISTINCT ip) as unique_ips
      FROM subdomains
      WHERE 1=1
    `
    const params = []

    if (targetId) {
      sql += ' AND target_id = ?'
      params.push(targetId)
    }

    const summary = db.prepare(sql).get(...params)
    res.json(summary)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
