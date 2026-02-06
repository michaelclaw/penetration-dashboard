import { runCommand } from './commandRunner.js'

const DELAY_BETWEEN_REQUESTS = 1000 // 1 second between DNS lookups (stealth)

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isIPv4(value) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(value)
}

function isIPv6(value) {
  return /^[0-9a-f:]+$/i.test(value) && value.includes(':')
}

export async function resolveSubdomainIPs(subdomains, logger) {
  const results = []
  
  for (const subdomain of subdomains) {
    try {
      await delay(DELAY_BETWEEN_REQUESTS)

      const host = (subdomain || '').toString().trim()
        .replace(/^https?:\/\//i, '')
        .split('/')[0]
        .split('?')[0]
        .split('#')[0]

      if (isIPv4(host) || isIPv6(host)) {
        results.push({ subdomain: host, ip: host })
        continue
      }

      const { stdout } = await runCommand({
        cmd: `dig +short ${host}`,
        timeout: 5000,
        logger
      })
      const ip = stdout.trim().split('\n')[0]
      
      if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
        results.push({ subdomain, ip })
      } else {
        results.push({ subdomain, ip: null })
      }
    } catch (error) {
      results.push({ subdomain, ip: null })
    }
  }
  
  return results
}
