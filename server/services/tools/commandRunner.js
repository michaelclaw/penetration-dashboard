import { promisify } from 'util'
import { exec } from 'child_process'

const execAsync = promisify(exec)
const MAX_LOG_OUTPUT = 4000

function formatOutput(label, text) {
  if (!text) return null
  const trimmed = text.trim()
  if (!trimmed) return null
  if (trimmed.length <= MAX_LOG_OUTPUT) {
    return `${label}:\n${trimmed}`
  }
  const truncated = trimmed.slice(0, MAX_LOG_OUTPUT)
  return `${label} (truncated):\n${truncated}\n...`
}

export async function runCommand({ cmd, timeout = 10000, logger, allowFailure = false }) {
  if (logger) {
    logger(`CMD: ${cmd}`, 'info')
  }

  try {
    const result = await execAsync(cmd, {
      timeout,
      maxBuffer: 10 * 1024 * 1024
    })

    const stdoutMessage = formatOutput('STDOUT', result.stdout)
    const stderrMessage = formatOutput('STDERR', result.stderr)

    if (logger && stdoutMessage) logger(stdoutMessage, 'info')
    if (logger && stderrMessage) logger(stderrMessage, 'warning')

    return result
  } catch (error) {
    if (logger) {
      const level = allowFailure ? 'warning' : 'error'
      logger(`CMD failed: ${cmd}`, level)
      if (error?.stdout) {
        const stdoutMessage = formatOutput('STDOUT', error.stdout)
        if (stdoutMessage) logger(stdoutMessage, level)
      }
      if (error?.stderr) {
        const stderrMessage = formatOutput('STDERR', error.stderr)
        if (stderrMessage) logger(stderrMessage, level)
      }
      if (!error?.stdout && !error?.stderr) {
        logger(error.message || 'Command failed', level)
      }
    }
    if (allowFailure) {
      return {
        stdout: error?.stdout || '',
        stderr: error?.stderr || '',
        code: error?.code
      }
    }
    throw error
  }
}
