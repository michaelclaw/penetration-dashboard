import React, { useState } from 'react'
import { useSettings } from '../contexts/SettingsContext'
import { useAuth } from '../contexts/AuthContext'
import './AdminPanel.css'

function AdminPanel() {
  const { settings, updateOpenIdSettings } = useSettings()
  const { isOpenIdEnabled } = useAuth()
  const [formData, setFormData] = useState({
    enabled: settings.openid.enabled,
    authority: settings.openid.authority,
    clientId: settings.openid.clientId,
    redirectUri: settings.openid.redirectUri,
    scope: settings.openid.scope
  })
  const [saveStatus, setSaveStatus] = useState(null)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    try {
      updateOpenIdSettings(formData)
      setSaveStatus({ type: 'success', message: 'OpenID settings saved successfully!' })
      setTimeout(() => setSaveStatus(null), 3000)
    } catch (err) {
      setSaveStatus({ type: 'error', message: 'Failed to save settings' })
      setTimeout(() => setSaveStatus(null), 3000)
    }
  }

  const handleTest = () => {
    if (!formData.enabled || !formData.authority || !formData.clientId) {
      setSaveStatus({ type: 'error', message: 'Please fill in all required fields and enable OpenID first' })
      setTimeout(() => setSaveStatus(null), 3000)
      return
    }
    setSaveStatus({ type: 'info', message: 'Testing connection... (This will attempt to redirect to your OpenID provider)' })
    // Save settings first, then test
    updateOpenIdSettings(formData)
    setTimeout(() => {
      window.location.reload()
    }, 1000)
  }


  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h2>Admin Panel</h2>
        <p className="admin-subtitle">Configure system settings</p>
      </div>

      <div className="admin-sections">
        <section className="admin-section">
          <h3 className="section-title">OpenID Connect Configuration</h3>
          
          {saveStatus && (
            <div className={`status-message status-${saveStatus.type}`}>
              {saveStatus.message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="admin-form">
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="enabled"
                  checked={formData.enabled}
                  onChange={handleChange}
                />
                <span>Enable OpenID Authentication</span>
              </label>
              <p className="form-help">
                When enabled, users will be required to authenticate via OpenID Connect to access the dashboard.
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="authority">Authority (OpenID Provider URL):</label>
              <input
                type="url"
                id="authority"
                name="authority"
                value={formData.authority}
                onChange={handleChange}
                placeholder="https://your-oidc-provider.com"
                className="form-input"
                disabled={!formData.enabled}
                required={formData.enabled}
              />
              <p className="form-help">
                The base URL of your OpenID provider (e.g., https://auth.example.com)
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="clientId">Client ID:</label>
              <input
                type="text"
                id="clientId"
                name="clientId"
                value={formData.clientId}
                onChange={handleChange}
                placeholder="your-client-id"
                className="form-input"
                disabled={!formData.enabled}
                required={formData.enabled}
              />
              <p className="form-help">
                The client ID provided by your OpenID provider
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="redirectUri">Redirect URI:</label>
              <input
                type="url"
                id="redirectUri"
                name="redirectUri"
                value={formData.redirectUri}
                onChange={handleChange}
                placeholder={window.location.origin + '/callback'}
                className="form-input"
                disabled={!formData.enabled}
                required={formData.enabled}
              />
              <p className="form-help">
                The callback URL registered with your OpenID provider. Must match exactly.
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="scope">Scope:</label>
              <input
                type="text"
                id="scope"
                name="scope"
                value={formData.scope}
                onChange={handleChange}
                placeholder="openid profile email"
                className="form-input"
                disabled={!formData.enabled}
              />
              <p className="form-help">
                Space-separated list of scopes to request (default: openid profile email)
              </p>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary">
                Save Settings
              </button>
              <button 
                type="button" 
                className="btn-secondary"
                onClick={handleTest}
                disabled={!formData.enabled}
              >
                Test Connection
              </button>
            </div>
          </form>

          {isOpenIdEnabled && (
            <div className="status-info">
              <strong>Status:</strong> OpenID is currently <span className="status-active">enabled</span>
            </div>
          )}
        </section>

        <section className="admin-section">
          <h3 className="section-title">Configuration Notes</h3>
          <div className="info-box">
            <h4>Setting up OpenID Connect:</h4>
            <ol>
              <li>Register your application with an OpenID provider (Auth0, Okta, Keycloak, etc.)</li>
              <li>Configure the redirect URI in your provider to match the one above</li>
              <li>Copy the Authority URL and Client ID from your provider</li>
              <li>Enable OpenID and fill in the required fields</li>
              <li>Click "Save Settings" and then "Test Connection"</li>
            </ol>
            <p className="warning-note">
              <strong>Note:</strong> After enabling OpenID, users will need to authenticate to access the dashboard. 
              Make sure your configuration is correct before enabling.
            </p>
          </div>
        </section>

      </div>
    </div>
  )
}

export default AdminPanel
