import express from 'express'
import axios from 'axios'

export const icannRouter = express.Router()

function extractDomain(input) {
  if (!input || typeof input !== 'string') return ''
  let v = input.trim()
  if (!v) return ''

  // If user pasted a full URL, extract hostname
  if (v.includes('://')) {
    try {
      const u = new URL(v)
      v = u.hostname
    } catch {
      // fall through to other cleanup
    }
  }

  // Strip common prefixes / path fragments if user pasted something URL-like without scheme
  v = v.replace(/^[a-z]+:\/\//i, '')
  v = v.split('/')[0]
  v = v.split('?')[0]
  v = v.split('#')[0]

  // Trim trailing dot (valid FQDN form, but RDAP endpoints generally expect without it)
  v = v.replace(/\.$/, '')

  return v.trim().toLowerCase()
}

function isProbablyDomain(value) {
  if (!value || typeof value !== 'string') return false
  const domain = value.trim().toLowerCase()
  if (domain.length < 4 || domain.length > 253) return false
  if (!domain.includes('.')) return false
  if (!/^[a-z0-9.-]+$/.test(domain)) return false
  if (domain.startsWith('.') || domain.endsWith('.')) return false
  if (domain.includes('..')) return false
  return true
}

function extractVcard(vcardArray) {
  // RDAP: vcardArray = ["vcard", [ [name, params, type, value], ... ]]
  if (!Array.isArray(vcardArray) || vcardArray.length < 2) return {}
  const rows = Array.isArray(vcardArray[1]) ? vcardArray[1] : []

  const getAll = (key) =>
    rows
      .filter((r) => Array.isArray(r) && r[0] === key)
      .map((r) => r[3])
      .filter(Boolean)

  const getFirst = (key) => getAll(key)[0]

  return {
    name: getFirst('fn'),
    organization: getFirst('org'),
    emails: getAll('email'),
    phones: getAll('tel'),
    // adr is often a structured array; keep as-is (user asked for not-flooded UI anyway)
    addresses: getAll('adr')
  }
}

function summarizeRdap(data) {
  const events = Array.isArray(data.events) ? data.events : []
  const eventDate = (action) => events.find((e) => e?.eventAction === action)?.eventDate || null

  const nameservers = Array.isArray(data.nameservers)
    ? data.nameservers
        .map((ns) => ns?.ldhName || ns?.unicodeName)
        .filter(Boolean)
    : []

  const entities = Array.isArray(data.entities) ? data.entities : []

  const findEntitiesByRole = (role) =>
    entities.filter((e) => Array.isArray(e.roles) && e.roles.includes(role))

  const registrarEntity =
    findEntitiesByRole('registrar')[0] ||
    findEntitiesByRole('sponsoring registrar')[0] ||
    null

  const registrarVcard = registrarEntity?.vcardArray ? extractVcard(registrarEntity.vcardArray) : {}
  const registrarPublicIds = Array.isArray(registrarEntity?.publicIds) ? registrarEntity.publicIds : []
  const registrarIanaId =
    registrarPublicIds.find((p) => p?.type?.toLowerCase?.() === 'iana registrar id')?.identifier || null

  const contactRoles = ['registrant', 'administrative', 'technical']
  const contacts = Object.fromEntries(
    contactRoles.map((role) => {
      const roleEntities = findEntitiesByRole(role)
      const values = roleEntities
        .map((e) => (e?.vcardArray ? extractVcard(e.vcardArray) : {}))
        .filter((c) => c && (c.name || c.organization || (c.emails && c.emails.length)))
      return [role, values]
    })
  )

  return {
    domain: data.ldhName || data.unicodeName || null,
    unicodeName: data.unicodeName || null,
    statuses: Array.isArray(data.status) ? data.status : [],
    events: {
      registration: eventDate('registration'),
      lastChanged: eventDate('last changed'),
      expiration: eventDate('expiration')
    },
    nameservers,
    registrar: registrarEntity
      ? {
          name: registrarVcard.organization || registrarVcard.name || registrarEntity.handle || 'Registrar',
          ianaId: registrarIanaId
        }
      : null,
    contacts
  }
}

// GET /api/icann/rdap?domain=example.com
icannRouter.get('/rdap', async (req, res) => {
  try {
    const domain = extractDomain((req.query.domain || '').toString())

    if (!isProbablyDomain(domain)) {
      return res.status(400).json({
        error: 'Invalid domain. Provide ?domain=example.com (or pass a URL and we will extract the hostname).',
        received: (req.query.domain || '').toString()
      })
    }

    const url = `https://rdap.org/domain/${encodeURIComponent(domain)}`

    const response = await axios.get(url, {
      timeout: 15000,
      headers: { Accept: 'application/rdap+json, application/json' },
      validateStatus: () => true
    })

    if (response.status === 404) {
      return res.json({ found: false, domain })
    }

    if (response.status < 200 || response.status >= 300) {
      return res.status(502).json({
        error: `RDAP lookup failed (status ${response.status})`,
        domain
      })
    }

    const data = response.data
    return res.json({ found: true, domain, rdap: summarizeRdap(data) })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

