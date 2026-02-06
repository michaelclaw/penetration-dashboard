import { runCommand } from './commandRunner.js'
import { findTool, TOOL_ALIASES } from './toolDetection.js'

// Stealth mode: Slow scan with delays
const SCAN_DELAY = 3000 // 3 seconds between hosts
const PORT_SCAN_TIMEOUT = 120000 // 120 seconds per host
const FALLBACK_PORTS = '22,23,25,53,80,110,111,135,139,143,443,445,465,587,993,995,1433,1521,1723,1883,2049,2375,2379,2380,27017,27018,27019,28017,3000,3306,3389,4443,5000,5432,5601,5672,5900,5985,5986,6379,6443,7001,7077,8080,8443,8888'

let nmapCommand = null
findTool(TOOL_ALIASES.nmap).then(cmd => {
  nmapCommand = cmd
  if (cmd) {
    console.log(`Using nmap command: ${cmd}`)
  }
})

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function executePortScan(hosts, logger) {
  const services = []
  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0
  const scanType = isRoot ? '-sS' : '-sT'
  const scannedTargets = new Set()
  const nmap = nmapCommand || 'nmap'
  
  // Limit to top 10 hosts for stealth
  const limitedHosts = hosts.slice(0, 10)
  
  for (const host of limitedHosts) {
    try {
      await delay(SCAN_DELAY)
      
      const hostname = host.subdomain || host.host || host
      const ip = host.ip || hostname
      const scanTarget = ip
      if (scannedTargets.has(scanTarget)) {
        continue
      }
      scannedTargets.add(scanTarget)

      const runNmap = async (cmd) => {
        const result = await runCommand({
          cmd,
          timeout: PORT_SCAN_TIMEOUT,
          logger,
          allowFailure: true
        })
        return result.stdout || ''
      }
      
      // Use nmap with stealth options
      // -sS: SYN scan (stealth, requires root)
      // -sT: TCP connect scan (fallback for non-root)
      // -T2: Polite timing (slower, less suspicious)
      // -Pn: Skip host discovery
      // --top-ports 50: Scan top 50 ports
      const baseCmd = `${nmap} ${scanType} -T2 -Pn --top-ports 50 -oG - ${ip}`
      let stdout = await runNmap(baseCmd)

      if (!stdout && scanType === '-sS') {
        const fallbackCmd = `${nmap} -sT -T2 -Pn --top-ports 50 -oG - ${ip}`
        stdout = await runNmap(fallbackCmd)
      }

      if (!stdout) {
        const quickCmd = `${nmap} -sT -T2 -Pn -p ${FALLBACK_PORTS} -oG - ${ip}`
        stdout = await runNmap(quickCmd)
      }

      if (!stdout && logger) {
        logger(`nmap returned no output for ${ip}`, 'warning')
      }
      
      // Parse nmap output
      const lines = stdout.split('\n')
      for (const line of lines) {
        if (line.includes('Ports:')) {
          const portsPart = line.split('Ports:')[1]?.trim()
          if (!portsPart) continue

          const portEntries = portsPart.split(',').map(entry => entry.trim()).filter(Boolean)
          portEntries.forEach(entry => {
            const fields = entry.split('/')
            if (fields.length < 3) return

            const [port, state, protocol, , serviceName] = fields
            if (state === 'open') {
              services.push({
                host: hostname,
                ip: ip,
                port: parseInt(port, 10),
                protocol: protocol.toLowerCase(),
                service: serviceName || 'unknown'
              })
            }
          })
        }
      }
      
    } catch (error) {
      console.log(`Port scan failed for ${host.subdomain || host.host || host}:`, error.message)
    }
  }
  
  return services
}
