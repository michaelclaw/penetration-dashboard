import { db } from '../database.js'

export function getSettingValue(key) {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key)
  if (row && row.value) {
    return row.value
  }
  return process.env[key] || ''
}

export function setSettingValue(key, value) {
  const trimmed = typeof value === 'string' ? value.trim() : value
  if (!trimmed) {
    db.prepare('DELETE FROM app_settings WHERE key = ?').run(key)
    return
  }
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(key, trimmed)
}

export function getMaskedValue(key) {
  const value = getSettingValue(key)
  if (!value) {
    return { configured: false, masked: '' }
  }
  const masked = value.length <= 4 ? '****' : `****${value.slice(-4)}`
  return { configured: true, masked }
}
