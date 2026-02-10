import express from 'express'
import { db } from '../database.js'
import { broadcast } from '../server.js'
import { runCommand } from '../services/tools/commandRunner.js'
import { findTool, TOOL_ALIASES } from '../services/tools/toolDetection.js'

export const toolsRouter = express.Router()

const TOOL_DEFINITIONS = [
  {
    id: 'subfinder',
    label: 'Subfinder',
    commands: TOOL_ALIASES.subfinder,
    packages: ['subfinder']
  },
  {
    id: 'assetfinder',
    label: 'Assetfinder',
    commands: TOOL_ALIASES.assetfinder,
    packages: ['assetfinder']
  },
  {
    id: 'findomain',
    label: 'Findomain',
    commands: TOOL_ALIASES.findomain,
    installSteps: [
      'wget -q https://github.com/Findomain/Findomain/releases/latest/download/findomain-linux -O /tmp/findomain',
      'chmod +x /tmp/findomain',
      'mv /tmp/findomain /usr/local/bin/findomain'
    ]
  },
  {
    id: 'httpx',
    label: 'httpx',
    commands: TOOL_ALIASES.httpx,
    packages: ['httpx-toolkit']
  },
  {
    id: 'nmap',
    label: 'nmap',
    commands: TOOL_ALIASES.nmap,
    packages: ['nmap']
  },
  {
    id: 'nuclei',
    label: 'nuclei',
    commands: TOOL_ALIASES.nuclei,
    packages: ['nuclei']
  },
  {
    id: 'nikto',
    label: 'nikto',
    commands: TOOL_ALIASES.nikto,
    packages: ['nikto']
  },
  {
    id: 'gobuster',
    label: 'gobuster',
    commands: TOOL_ALIASES.gobuster,
    packages: ['gobuster']
  },
  {
    id: 'dig',
    label: 'dig (dnsutils)',
    commands: TOOL_ALIASES.dig,
    packages: ['dnsutils']
  },
  {
    id: 'curl',
    label: 'curl',
    commands: ['curl'],
    packages: ['curl']
  }
]

function requiresRoot() {
  return typeof process.getuid === 'function' && process.getuid() !== 0
}

function isLinux() {
  return process.platform === 'linux'
}

async function getToolStatus() {
  const tools = []
  for (const tool of TOOL_DEFINITIONS) {
    const resolved = await findTool(tool.commands)
    tools.push({
      id: tool.id,
      label: tool.label,
      installed: Boolean(resolved),
      command: resolved || tool.commands[0],
      installable: Boolean(tool.packages || tool.installSteps)
    })
  }
  return tools
}

function logActivity(jobId, message, level = 'info') {
  db.prepare(`
    INSERT INTO activity_logs (job_id, message, level)
    VALUES (?, ?, ?)
  `).run(jobId, message, level)

  broadcast({
    type: 'activity',
    jobId,
    message,
    level,
    timestamp: new Date().toISOString()
  })
}

async function runInstallSteps(steps, logger) {
  for (const step of steps) {
    await runCommand({ cmd: step, timeout: 120000, logger })
  }
}

async function installPackages(packages, logger) {
  const pkgList = packages.join(' ')
  await runCommand({ cmd: 'apt-get update', timeout: 300000, logger })
  await runCommand({
    cmd: `DEBIAN_FRONTEND=noninteractive apt-get install -y ${pkgList}`,
    timeout: 300000,
    logger
  })
}

toolsRouter.get('/status', async (req, res) => {
  try {
    const tools = await getToolStatus()
    res.json({ tools, allInstalled: tools.every(tool => tool.installed) })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

toolsRouter.post('/install', async (req, res) => {
  try {
    const { toolId } = req.body
    if (!toolId) {
      return res.status(400).json({ error: 'toolId is required' })
    }

    if (!isLinux()) {
      return res.status(400).json({ error: 'Tool installation is only supported on Linux' })
    }

    if (requiresRoot()) {
      return res.status(403).json({
        error: 'Tool installation requires root. Start the backend with sudo.'
      })
    }

    const tool = TOOL_DEFINITIONS.find(entry => entry.id === toolId)
    if (!tool) {
      return res.status(404).json({ error: 'Unknown tool' })
    }

    const jobId = `tool-install:${toolId}`
    const logger = (message, level = 'info') => logActivity(jobId, message, level)
    logger(`Tool install requested: ${tool.label}`, 'info')

    if (tool.installSteps) {
      await runInstallSteps(tool.installSteps, logger)
    } else if (tool.packages) {
      await installPackages(tool.packages, logger)
    } else {
      return res.status(400).json({ error: 'Tool is not installable via backend' })
    }

    const tools = await getToolStatus()
    const updated = tools.find(entry => entry.id === toolId)
    res.json({
      message: updated?.installed ? `${tool.label} installed` : `${tool.label} install attempted`,
      installed: Boolean(updated?.installed),
      tools
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
