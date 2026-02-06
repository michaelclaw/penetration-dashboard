import { findTool, TOOL_ALIASES } from './toolDetection.js'
import { runCommand } from './commandRunner.js'

const DELAY_BETWEEN_REQUESTS = 1000 // 1 second between HTTP requests (stealth)
const PROBE_TIMEOUT = 5000

// Detect httpx command on startup
let httpxCommand = null
findTool(TOOL_ALIASES.httpx).then(cmd => {
  httpxCommand = cmd
  if (cmd) {
    console.log(`Using httpx command: ${cmd}`)
  }
})

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function normalizeHost(value) {
  let host = (value || '').toString().trim()
  if (!host) return ''
  host = host.replace(/^https?:\/\//i, '')
  host = host.split('/')[0].split('?')[0].split('#')[0]
  return host
}

export async function executeHTTPProbe(hosts, logger) {
  const liveHosts = []
  
  if (!hosts || hosts.length === 0) {
    return liveHosts
  }
  
  // Limit concurrent requests for stealth
  const limitedHosts = hosts.slice(0, 20)
  
  for (const host of limitedHosts) {
    try {
      await delay(DELAY_BETWEEN_REQUESTS)
      
      const rawHost = typeof host === 'string' ? host : (host.subdomain || host.host || host)
      const hostname = normalizeHost(rawHost)
      if (!hostname) continue
      
      // Try httpx or httpx-toolkit first
      let httpxFound = false
      if (httpxCommand) {
        try {
          const { stdout } = await runCommand({
            cmd: `${httpxCommand} -status-code -silent -timeout ${PROBE_TIMEOUT}ms -no-fallback ${hostname}`,
            timeout: PROBE_TIMEOUT + 1000,
            logger
          })
          
          if (stdout.trim()) {
            liveHosts.push(hostname)
            httpxFound = true
          }
        } catch {
          // Fall through to curl
        }
      }
      
      // Fallback to curl if httpx not available
      if (!httpxFound) {
        try {
          // Try HTTPS first, then HTTP
          for (const protocol of ['https', 'http']) {
            try {
              const { stdout } = await runCommand({
                cmd: `curl -s -o /dev/null -w "%{http_code}" --max-time 3 ${protocol}://${hostname}`,
                timeout: 4000,
                logger
              })
              
              if (stdout && stdout !== '000' && parseInt(stdout) > 0) {
                liveHosts.push(hostname)
                break
              }
            } catch {
              // Continue to next protocol
            }
          }
        } catch {
          // Host not reachable
        }
      }
      
    } catch (error) {
      // Continue to next host
      console.log(`HTTP probe failed for ${host}:`, error.message)
    }
  }
  
  return liveHosts
}
