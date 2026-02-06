import express from 'express'
import axios from 'axios'
import { getSettingValue } from '../services/settingsService.js'

export const hibpRouter = express.Router()

hibpRouter.get('/breaches', async (req, res) => {
  try {
    const domain = (req.query.domain || '').toString().trim()
    if (!domain) {
      return res.status(400).json({ error: 'domain is required' })
    }

    const apiKey = getSettingValue('HIBP_API_KEY')
    const headers = {
      'user-agent': 'ReconDashboard/1.0.6 (educational)',
      accept: 'application/json'
    }
    if (apiKey) {
      headers['hibp-api-key'] = apiKey
    }

    const response = await axios.get('https://haveibeenpwned.com/api/v3/breaches', {
      params: { domain },
      headers,
      timeout: 10000
    })

    res.json({ breaches: response.data || [] })
  } catch (error) {
    const status = error?.response?.status
    if (status === 404) {
      return res.json({ breaches: [] })
    }
    res.status(500).json({ error: error.message })
  }
})
