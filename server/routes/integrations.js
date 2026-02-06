import express from 'express'
import axios from 'axios'
import { getSettingValue } from '../services/settingsService.js'

export const integrationsRouter = express.Router()

async function checkShodan() {
  const key = getSettingValue('SHODAN_API_KEY')
  if (!key) return { status: 'missing', message: 'Missing key (configure)' }
  try {
    await axios.get('https://api.shodan.io/api-info', {
      params: { key },
      timeout: 8000
    })
    return { status: 'ok', message: 'OK' }
  } catch (error) {
    const status = error?.response?.status
    const msg = status ? `Error ${status}` : 'Connection failed'
    return { status: 'error', message: msg }
  }
}

async function checkCensys() {
  const id = getSettingValue('CENSYS_API_ID')
  const secret = getSettingValue('CENSYS_SECRET')
  if (!id || !secret) return { status: 'missing', message: 'Missing key (configure)' }
  try {
    const auth = Buffer.from(`${id}:${secret}`).toString('base64')
    await axios.get('https://search.censys.io/api/v2/account', {
      headers: { Authorization: `Basic ${auth}` },
      timeout: 8000
    })
    return { status: 'ok', message: 'OK' }
  } catch (error) {
    const status = error?.response?.status
    const msg = status ? `Error ${status}` : 'Connection failed'
    return { status: 'error', message: msg }
  }
}

async function checkGithub() {
  const token = getSettingValue('GITHUB_TOKEN')
  if (!token) return { status: 'missing', message: 'Missing key (configure)' }
  try {
    await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      timeout: 8000
    })
    return { status: 'ok', message: 'OK' }
  } catch (error) {
    const status = error?.response?.status
    const msg = status ? `Error ${status}` : 'Connection failed'
    return { status: 'error', message: msg }
  }
}

integrationsRouter.get('/status', async (req, res) => {
  try {
    const [shodan, censys, github] = await Promise.all([
      checkShodan(),
      checkCensys(),
      checkGithub()
    ])

    res.json({
      integrations: [
        { id: 'shodan', name: 'Shodan API', ...shodan },
        { id: 'censys', name: 'Censys API', ...censys },
        { id: 'github', name: 'GitHub search', ...github },
        { id: 'hibp', name: 'Have I Been Pwned', status: getSettingValue('HIBP_API_KEY') ? 'ok' : 'missing', message: getSettingValue('HIBP_API_KEY') ? 'OK' : 'Missing key (configure)' },
        { id: 'virustotal', name: 'VirusTotal', status: getSettingValue('VIRUSTOTAL_API_KEY') ? 'ok' : 'missing', message: getSettingValue('VIRUSTOTAL_API_KEY') ? 'OK' : 'Missing key (configure)' }
      ]
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
