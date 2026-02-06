import axios from 'axios'
import { getSettingValue } from '../settingsService.js'

const DELAY_BETWEEN_REQUESTS = 3000 // 3 seconds between API calls

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function executeOSINT(target, logger) {
  const results = []
  
  // Shodan API (optional)
  const shodanKey = getSettingValue('SHODAN_API_KEY')
  if (shodanKey) {
    try {
      await delay(DELAY_BETWEEN_REQUESTS)
      const response = await axios.get(`https://api.shodan.io/dns/domain/${target}`, {
        params: { key: shodanKey },
        timeout: 10000
      })
      if (response.data && response.data.subdomains) {
        results.push(...response.data.subdomains.map(sub => ({
          source: 'Shodan',
          type: 'subdomain',
          value: `${sub}.${target}`
        })))
      }
    } catch (error) {
      console.log('Shodan API error:', error.message)
    }
  } else if (logger) {
    logger('OSINT: SHODAN_API_KEY not configured, skipping Shodan lookup', 'warning')
  }
  
  // Censys API (optional)
  const censysId = getSettingValue('CENSYS_API_ID')
  const censysSecret = getSettingValue('CENSYS_SECRET')
  if (censysId && censysSecret) {
    try {
      await delay(DELAY_BETWEEN_REQUESTS)
      const auth = Buffer.from(`${censysId}:${censysSecret}`).toString('base64')
      const response = await axios.get(`https://search.censys.io/api/v2/hosts/search`, {
        params: { q: `services.tls.certificates.parsed.names:${target}` },
        headers: { Authorization: `Basic ${auth}` },
        timeout: 10000
      })
      if (response.data && response.data.result && response.data.result.hits) {
        results.push(...response.data.result.hits.map(hit => ({
          source: 'Censys',
          type: 'host',
          value: hit.ip
        })))
      }
    } catch (error) {
      console.log('Censys API error:', error.message)
    }
  } else if (logger) {
    logger('OSINT: Censys API credentials not configured, skipping Censys lookup', 'warning')
  }
  
  // GitHub search (optional)
  // NOTE: On many environments GitHub code search now requires authentication and is aggressively rate limited.
  // We only attempt this if a token is configured. If not, we skip without failing the job.
  const githubToken = getSettingValue('GITHUB_TOKEN')
  if (!githubToken) {
    console.log('GitHub search skipped: GITHUB_TOKEN not configured')
    if (logger) {
      logger('OSINT: GITHUB_TOKEN not configured, skipping GitHub search', 'warning')
    }
    return results
  }

  try {
    await delay(DELAY_BETWEEN_REQUESTS)
    const response = await axios.get('https://api.github.com/search/code', {
      params: { q: `${target}`, per_page: 10 },
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      timeout: 10000
    })

    if (response.data && Array.isArray(response.data.items)) {
      results.push(
        ...response.data.items.map(item => ({
          source: 'GitHub',
          type: 'code',
          value: item.html_url
        }))
      )
    }
  } catch (error) {
    const status = error?.response?.status
    const msg = status ? `status ${status}` : error.message
    console.log('GitHub search error:', msg)
  }
  
  return results
}
