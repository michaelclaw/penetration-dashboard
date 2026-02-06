import express from 'express'
import { promisify } from 'util'
import { exec } from 'child_process'
import { findTool, TOOL_ALIASES } from '../services/tools/toolDetection.js'

const execAsync = promisify(exec)

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

async function runInstallSteps(steps) {
  for (const step of steps) {
    await execAsync(step, { timeout: 120000 })
  }
}

async function installPackages(packages) {
  const pkgList = packages.join(' ')
  await execAsync('apt-get update', { timeout: 300000 })
  await execAsync(`DEBIAN_FRONTEND=noninteractive apt-get install -y ${pkgList}`, {
    timeout: 300000
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

    if (tool.installSteps) {
      await runInstallSteps(tool.installSteps)
    } else if (tool.packages) {
      await installPackages(tool.packages)
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
