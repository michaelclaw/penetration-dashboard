const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

async function request(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  }

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body)
  }

  try {
    const response = await fetch(url, config)
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Request failed')
    }
    
    return data
  } catch (error) {
    console.error('API request error:', error)
    throw error
  }
}

export const api = {
  // Targets
  getTargets: () => request('/targets'),
  getTarget: (id) => request(`/targets/${id}`),
  createTarget: (target) => request('/targets', { method: 'POST', body: target }),
  updateTarget: (id, updates) => request(`/targets/${id}`, { method: 'PUT', body: updates }),
  deleteTarget: (id) => request(`/targets/${id}`, { method: 'DELETE' }),

  // Recon
  startRecon: (targetId, profile) => request('/recon/start', { method: 'POST', body: { targetId, profile } }),
  stopRecon: (jobId) => request('/recon/stop', { method: 'POST', body: { jobId } }),
  pauseRecon: (jobId) => request('/recon/pause', { method: 'POST', body: { jobId } }),
  resumeRecon: (jobId) => request('/recon/resume', { method: 'POST', body: { jobId } }),
  getJobStatus: (jobId) => request(`/recon/status/${jobId}`),

  // Findings
  getFindings: (params) => {
    const query = new URLSearchParams(params).toString()
    return request(`/findings?${query}`)
  },
  getFindingsSummary: () => request('/findings/summary'),
  updateFinding: (id, updates) => request(`/findings/${id}`, { method: 'PUT', body: updates }),

  // Subdomains
  getSubdomains: (params) => {
    const query = new URLSearchParams(params).toString()
    return request(`/subdomains?${query}`)
  },
  getSubdomainSummary: (params) => {
    const query = new URLSearchParams(params).toString()
    return request(`/subdomains/summary?${query}`)
  },

  // Services
  getServices: (params) => {
    const query = new URLSearchParams(params).toString()
    return request(`/services?${query}`)
  },

  // ICANN / RDAP
  getRdap: (domain) => request(`/icann/rdap?domain=${encodeURIComponent(domain)}`),

  // Import (assignment-safe)
  importResults: (payload) => request('/import', { method: 'POST', body: payload }),

  // Tools
  getToolStatus: () => request('/tools/status'),
  installTool: (toolId) => request('/tools/install', { method: 'POST', body: { toolId } }),

  // Integrations
  getIntegrationsStatus: () => request('/integrations/status'),

  // Activity logs
  getActivityLogs: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/activity?${query}`)
  },
  exportActivityLogs: async (params = {}) => {
    const query = new URLSearchParams(params).toString()
    const url = `${API_URL}/activity/export?${query}`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error('Failed to export activity logs')
    }
    return response.text()
  },

  // Settings (API keys)
  getApiKeys: () => request('/settings/api-keys'),
  updateApiKeys: (keys) => request('/settings/api-keys', { method: 'POST', body: { keys } }),

  // HIBP
  getHibpBreaches: (domain) => request(`/hibp/breaches?domain=${encodeURIComponent(domain)}`),

  // DNS records
  getDnsRecords: (params) => {
    const query = new URLSearchParams(params).toString()
    return request(`/dns-records?${query}`)
  }
}
