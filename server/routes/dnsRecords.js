import express from 'express'
import { db } from '../database.js'

export const dnsRecordsRouter = express.Router()

dnsRecordsRouter.get('/', (req, res) => {
  try {
    const { targetId } = req.query
    let sql = 'SELECT * FROM dns_records WHERE 1=1'
    const params = []

    if (targetId) {
      sql += ' AND target_id = ?'
      params.push(targetId)
    }

    sql += ' ORDER BY created_at DESC'
    const records = db.prepare(sql).all(...params)
    res.json(records)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
