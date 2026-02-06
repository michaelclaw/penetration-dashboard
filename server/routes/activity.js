import express from 'express'
import { db } from '../database.js'

export const activityRouter = express.Router()

activityRouter.get('/', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '200', 10), 1000)
    const jobId = req.query.jobId
    let sql = 'SELECT * FROM activity_logs WHERE 1=1'
    const params = []

    if (jobId) {
      sql += ' AND job_id = ?'
      params.push(jobId)
    }

    sql += ' ORDER BY created_at DESC LIMIT ?'
    params.push(limit)

    const logs = db.prepare(sql).all(...params)
    res.json({ logs })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

activityRouter.get('/export', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '500', 10), 2000)
    const jobId = req.query.jobId
    let sql = 'SELECT * FROM activity_logs WHERE 1=1'
    const params = []

    if (jobId) {
      sql += ' AND job_id = ?'
      params.push(jobId)
    }

    sql += ' ORDER BY created_at DESC LIMIT ?'
    params.push(limit)

    const logs = db.prepare(sql).all(...params)
    const lines = logs.map(log => {
      const time = log.created_at || ''
      return `[${time}] (${log.level}) ${log.message}`
    })

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.send(lines.join('\n'))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
