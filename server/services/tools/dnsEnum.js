import { runCommand } from './commandRunner.js'

const DELAY_BETWEEN_REQUESTS = 2000
const RECORD_TYPES = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'SOA']

function isIPv4(target) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(target)
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function executeDNSEnum(target, logger) {
  const records = []
  
  try {
    await delay(DELAY_BETWEEN_REQUESTS)
    
    if (isIPv4(target)) {
      const { stdout } = await runCommand({
        cmd: `dig -x ${target} +noall +answer`,
        timeout: 10000,
        logger
      })
      const lines = stdout.split('\n').filter(line => line.trim())
      lines.forEach(line => records.push(line.trim()))
      return records
    }

    // Try ANY first (often blocked), then fall back to common record types
    const anyResult = await runCommand({
      cmd: `dig ${target} ANY +noall +answer`,
      timeout: 10000,
      logger,
      allowFailure: true
    })
    const anyLines = anyResult.stdout.split('\n').filter(line => line.trim())
    anyLines.forEach(line => records.push(line.trim()))

    if (records.length === 0) {
      for (const type of RECORD_TYPES) {
        const { stdout } = await runCommand({
          cmd: `dig ${target} ${type} +noall +answer`,
          timeout: 10000,
          logger,
          allowFailure: true
        })
        const lines = stdout.split('\n').filter(line => line.trim())
        lines.forEach(line => records.push(line.trim()))
      }
    }
    
  } catch (error) {
    console.log('DNS enumeration failed:', error.message)
  }
  
  return Array.from(new Set(records))
}
