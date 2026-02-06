import { runCommand } from './commandRunner.js'

const DELAY_BETWEEN_REQUESTS = 2000 // 2 seconds between requests (stealth)
const WORDLIST_SIZE = 50 // Limit wordlist for stealth

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

export async function executeDirectoryFuzz(hosts, logger) {
  const directories = []
  
  // Limit to 3 hosts for stealth
  const limitedHosts = hosts.slice(0, 3)
  
  for (const host of limitedHosts) {
    try {
      await delay(DELAY_BETWEEN_REQUESTS)
      
      const hostname = normalizeHost(host)
      if (!hostname) continue
      const url = `https://${hostname}`
      
      const tryGobuster = async (targetUrl) => {
        const { stdout } = await runCommand({
          cmd: `gobuster dir -u ${targetUrl} -w /usr/share/wordlists/dirb/common.txt -q -t 1 --timeout 5s | head -${WORDLIST_SIZE}`,
          timeout: 60000,
          logger
        })
        
        const lines = stdout.split('\n').filter(line => line.includes('Status:'))
        lines.forEach(line => {
          const match = line.match(/(\S+)\s+\(Status:\s+(\d+)\)/)
          if (match) {
            directories.push({
              host: hostname,
              path: match[1],
              status: parseInt(match[2], 10)
            })
          }
        })
      }

      try {
        await tryGobuster(url)
      } catch {
        try {
          const fallbackUrl = url.startsWith('https://')
            ? url.replace('https://', 'http://')
            : url.replace('http://', 'https://')
          await tryGobuster(fallbackUrl)
        } catch {
          // Tool not available or host not reachable
        }
      }
      
    } catch (error) {
      console.log(`Directory fuzzing failed for ${host}:`, error.message)
    }
  }
  
  return directories
}
