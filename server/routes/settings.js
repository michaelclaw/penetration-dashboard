import express from 'express'
import { getMaskedValue, setSettingValue } from '../services/settingsService.js'

export const settingsRouter = express.Router()

const API_KEYS = [
  'SHODAN_API_KEY',
  'CENSYS_API_ID',
  'CENSYS_SECRET',
  'GITHUB_TOKEN',
  'HIBP_API_KEY',
  'VIRUSTOTAL_API_KEY'
]

settingsRouter.get('/api-keys', (req, res) => {
  try {
    const keys = {}
    API_KEYS.forEach(key => {
      keys[key] = getMaskedValue(key)
    })
    res.json({ keys })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

settingsRouter.post('/api-keys', (req, res) => {
  try {
    const { keys } = req.body || {}
    if (!keys || typeof keys !== 'object') {
      return res.status(400).json({ error: 'keys object is required' })
    }

    Object.entries(keys).forEach(([key, value]) => {
      if (API_KEYS.includes(key)) {
        setSettingValue(key, value)
      }
    })

    const updated = {}
    API_KEYS.forEach(key => {
      updated[key] = getMaskedValue(key)
    })

    res.json({ keys: updated })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
