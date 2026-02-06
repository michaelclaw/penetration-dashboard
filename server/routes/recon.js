import express from 'express'
import { startReconJob, stopReconJob, pauseReconJob, resumeReconJob, getJobStatus } from '../services/reconService.js'
import { broadcast } from '../server.js'

export const reconRouter = express.Router()

// Start reconnaissance
reconRouter.post('/start', async (req, res) => {
  try {
    const { targetId, profile } = req.body
    
    if (!targetId) {
      return res.status(400).json({ error: 'targetId is required' })
    }

    const jobId = await startReconJob(targetId, profile)
    res.json({ jobId, message: 'Reconnaissance started' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Stop reconnaissance
reconRouter.post('/stop', (req, res) => {
  try {
    const { jobId } = req.body
    
    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' })
    }

    stopReconJob(jobId)
    res.json({ message: 'Reconnaissance stopped' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Pause reconnaissance
reconRouter.post('/pause', (req, res) => {
  try {
    const { jobId } = req.body
    
    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' })
    }

    pauseReconJob(jobId)
    res.json({ message: 'Reconnaissance paused' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Resume reconnaissance
reconRouter.post('/resume', (req, res) => {
  try {
    const { jobId } = req.body
    
    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' })
    }

    resumeReconJob(jobId)
    res.json({ message: 'Reconnaissance resumed' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get job status
reconRouter.get('/status/:jobId', (req, res) => {
  try {
    const status = getJobStatus(req.params.jobId)
    if (!status) {
      return res.status(404).json({ error: 'Job not found' })
    }
    res.json(status)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
