import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = join(__dirname, 'recon.db')
export const db = new Database(dbPath)

export function initDatabase() {
  // Targets table
  db.exec(`
    CREATE TABLE IF NOT EXISTS targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      target TEXT NOT NULL UNIQUE,
      tags TEXT,
      notes TEXT,
      status TEXT DEFAULT 'Pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_run DATETIME
    )
  `)

  // Recon jobs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS recon_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_id INTEGER NOT NULL,
      job_id TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'running',
      profile TEXT DEFAULT 'standard_external',
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (target_id) REFERENCES targets(id)
    )
  `)

  // Subdomains table
  db.exec(`
    CREATE TABLE IF NOT EXISTS subdomains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_id INTEGER NOT NULL,
      job_id TEXT NOT NULL,
      subdomain TEXT NOT NULL,
      ip TEXT,
      status TEXT DEFAULT 'UNKNOWN',
      first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      tags TEXT,
      FOREIGN KEY (target_id) REFERENCES targets(id),
      UNIQUE(target_id, subdomain)
    )
  `)

  // Services table
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_id INTEGER NOT NULL,
      job_id TEXT NOT NULL,
      host TEXT NOT NULL,
      ip TEXT NOT NULL,
      port INTEGER NOT NULL,
      protocol TEXT NOT NULL,
      service_name TEXT,
      http_status INTEGER,
      technology TEXT,
      notes TEXT,
      discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (target_id) REFERENCES targets(id)
    )
  `)

  // Findings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS findings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_id INTEGER NOT NULL,
      job_id TEXT NOT NULL,
      severity TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      host TEXT,
      description TEXT,
      first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'Open',
      FOREIGN KEY (target_id) REFERENCES targets(id)
    )
  `)

  // Activity logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      message TEXT NOT NULL,
      level TEXT DEFAULT 'info',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // DNS records table
  db.exec(`
    CREATE TABLE IF NOT EXISTS dns_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_id INTEGER NOT NULL,
      job_id TEXT NOT NULL,
      record TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (target_id) REFERENCES targets(id)
    )
  `)

  // App settings (API keys, config)
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_targets_target ON targets(target);
    CREATE INDEX IF NOT EXISTS idx_subdomains_target ON subdomains(target_id);
    CREATE INDEX IF NOT EXISTS idx_services_target ON services(target_id);
    CREATE INDEX IF NOT EXISTS idx_findings_target ON findings(target_id);
    CREATE INDEX IF NOT EXISTS idx_activity_job ON activity_logs(job_id);
  `)

  console.log('Database initialized successfully')
}
