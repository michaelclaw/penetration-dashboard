import express from 'express'
import { WebSocketServer } from 'ws'
import http from 'http'
import cors from 'cors'
import { initDatabase } from './database.js'
import { reconRouter } from './routes/recon.js'
import { targetsRouter } from './routes/targets.js'
import { findingsRouter } from './routes/findings.js'
import { subdomainsRouter } from './routes/subdomains.js'
import { servicesRouter } from './routes/services.js'
import { icannRouter } from './routes/icann.js'
import { importRouter } from './routes/import.js'
import { toolsRouter } from './routes/tools.js'
import { integrationsRouter } from './routes/integrations.js'
import { activityRouter } from './routes/activity.js'
import { settingsRouter } from './routes/settings.js'
import { hibpRouter } from './routes/hibp.js'
import { dnsRecordsRouter } from './routes/dnsRecords.js'
import { setBroadcastFunction } from './services/reconService.js'

const app = express()
const server = http.createServer(app)
const wss = new WebSocketServer({ server })

app.use(cors())
app.use(express.json())

// Initialize database
initDatabase()

// WebSocket connection handler
const clients = new Set()

wss.on('connection', (ws) => {
  clients.add(ws)
  console.log('Client connected. Total clients:', clients.size)

  ws.on('close', () => {
    clients.delete(ws)
    console.log('Client disconnected. Total clients:', clients.size)
  })

  ws.on('error', (error) => {
    console.error('WebSocket error:', error)
  })
})

// Broadcast function to send updates to all connected clients
function broadcast(data) {
  const message = JSON.stringify(data)
  clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message)
    }
  })
}

// Export for use in other modules
export { broadcast }

// Set broadcast function in reconService
setBroadcastFunction(broadcast)

// Make broadcast available to routes
app.locals.broadcast = broadcast

// Routes
app.use('/api/targets', targetsRouter)
app.use('/api/recon', reconRouter)
app.use('/api/findings', findingsRouter)
app.use('/api/subdomains', subdomainsRouter)
app.use('/api/services', servicesRouter)
app.use('/api/icann', icannRouter)
app.use('/api/import', importRouter)
app.use('/api/tools', toolsRouter)
app.use('/api/integrations', integrationsRouter)
app.use('/api/activity', activityRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/hibp', hibpRouter)
app.use('/api/dns-records', dnsRecordsRouter)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Root route - API information
app.get('/', (req, res) => {
  res.json({
    message: 'Recon Dashboard API Server',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      targets: '/api/targets',
      recon: '/api/recon',
      findings: '/api/findings',
      subdomains: '/api/subdomains',
      services: '/api/services'
    },
    websocket: `ws://localhost:${process.env.PORT || 3001}`,
    frontend: 'http://localhost:3000',
    note: 'This is the backend API server. Access the web interface at http://localhost:3000'
  })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Recon Dashboard Server running on port ${PORT}`)
  if (typeof process.getuid === 'function' && process.getuid() !== 0) {
    console.warn('Did you run the backend under sudo? Some tools may be limited without root.')
  }
})
