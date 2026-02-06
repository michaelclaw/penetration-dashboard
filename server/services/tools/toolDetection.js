import { accessSync, constants } from 'fs'
import { join } from 'path'

// Cache for tool detection
const toolCache = new Map()

function uniquePaths(paths) {
  const seen = new Set()
  const result = []
  for (const p of paths) {
    if (!p || seen.has(p)) continue
    seen.add(p)
    result.push(p)
  }
  return result
}

function getSearchPaths() {
  const envPaths = (process.env.PATH || '').split(':')
  const extraPaths = [
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin'
  ]
  if (process.env.HOME) {
    extraPaths.push(join(process.env.HOME, 'go', 'bin'))
  }
  return uniquePaths([...envPaths, ...extraPaths])
}

function resolveTool(command) {
  if (toolCache.has(command)) {
    return toolCache.get(command)
  }

  const searchPaths = getSearchPaths()
  for (const dir of searchPaths) {
    const fullPath = join(dir, command)
    try {
      accessSync(fullPath, constants.X_OK)
      toolCache.set(command, fullPath)
      return fullPath
    } catch {
      // Continue searching
    }
  }

  toolCache.set(command, null)
  return null
}

async function checkTool(command) {
  return resolveTool(command)
}

export async function findTool(commands) {
  for (const cmd of commands) {
    const resolved = await checkTool(cmd)
    if (resolved) {
      return resolved
    }
  }
  return null
}

// Common tool aliases
export const TOOL_ALIASES = {
  httpx: ['httpx', 'httpx-toolkit'],
  subfinder: ['subfinder'],
  assetfinder: ['assetfinder'],
  findomain: ['findomain'],
  nmap: ['nmap'],
  gobuster: ['gobuster'],
  dig: ['dig']
}
