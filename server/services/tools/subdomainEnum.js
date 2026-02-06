import { runCommand } from './commandRunner.js'

// Rate limiting: 1 request per 2 seconds (stealth mode)
const DELAY_BETWEEN_REQUESTS = 2000

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function executeSubdomainEnum(target, logger) {
  const subdomains = new Set()
  
  // Try multiple tools for better coverage
  const tools = [
    { name: 'subfinder', cmd: `subfinder -d ${target} -silent -o -` },
    { name: 'assetfinder', cmd: `assetfinder ${target}` },
    { name: 'findomain', cmd: `findomain -t ${target} -q` }
  ]

  for (const tool of tools) {
    try {
      await delay(DELAY_BETWEEN_REQUESTS)
      
      const { stdout } = await runCommand({
        cmd: tool.cmd,
        timeout: 60000,
        logger
      })
      
      const results = stdout.split('\n')
        .map(line => line.trim())
        .filter(line => {
          if (!line) return false
          // Validate subdomain format
          return line.includes(target) && 
                 line.split('.').length >= 2 &&
                 !line.includes(' ') &&
                 line.length < 255
        })
      
      results.forEach(sub => {
        if (sub && sub.toLowerCase().includes(target.toLowerCase())) {
          subdomains.add(sub.toLowerCase())
        }
      })
      
    } catch (error) {
      // Tool not installed or failed - continue with next tool
      if (logger) {
        logger(`Tool ${tool.name} not available or failed: ${error.message}`, 'warning')
      } else {
        console.log(`Tool ${tool.name} not available or failed:`, error.message)
      }
    }
  }

  // Return subdomain strings
  return Array.from(subdomains).sort()
}
