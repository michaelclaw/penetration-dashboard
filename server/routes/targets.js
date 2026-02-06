import express from 'express'
import { db } from '../database.js'

export const targetsRouter = express.Router()

// Get all targets
targetsRouter.get('/', (req, res) => {
  try {
    const targets = db.prepare('SELECT * FROM targets ORDER BY created_at DESC').all()
    res.json(targets)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get single target
targetsRouter.get('/:id', (req, res) => {
  try {
    const target = db.prepare('SELECT * FROM targets WHERE id = ?').get(req.params.id)
    if (!target) {
      return res.status(404).json({ error: 'Target not found' })
    }
    res.json(target)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Create target
targetsRouter.post('/', (req, res) => {
  try {
    const { name, type, target, tags, notes } = req.body
    
    if (!target || !type) {
      return res.status(400).json({ error: 'Target and type are required' })
    }

    const result = db.prepare(`
      INSERT INTO targets (name, type, target, tags, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(name || target, type, target, tags || '', notes || '')

    const newTarget = db.prepare('SELECT * FROM targets WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(newTarget)
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Target already exists' })
    }
    res.status(500).json({ error: error.message })
  }
})

// Update target
targetsRouter.put('/:id', (req, res) => {
  try {
    const { name, tags, notes, status } = req.body
    const updates = []
    const values = []

    if (name !== undefined) {
      updates.push('name = ?')
      values.push(name)
    }
    if (tags !== undefined) {
      updates.push('tags = ?')
      values.push(tags)
    }
    if (notes !== undefined) {
      updates.push('notes = ?')
      values.push(notes)
    }
    if (status !== undefined) {
      updates.push('status = ?')
      values.push(status)
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    values.push(req.params.id)
    const sql = `UPDATE targets SET ${updates.join(', ')} WHERE id = ?`
    db.prepare(sql).run(...values)

    const updated = db.prepare('SELECT * FROM targets WHERE id = ?').get(req.params.id)
    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Delete target
targetsRouter.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM targets WHERE id = ?').run(req.params.id)
    res.json({ message: 'Target deleted' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
