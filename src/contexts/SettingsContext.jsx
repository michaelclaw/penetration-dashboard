import React, { createContext, useContext, useState, useEffect } from 'react'

const SettingsContext = createContext()

const STORAGE_KEY = 'recon_dashboard_settings'

const defaultSettings = {
  openid: {
    enabled: false,
    authority: '',
    clientId: '',
    redirectUri: window.location.origin + '/callback',
    scope: 'openid profile email'
  }
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return defaultSettings
      }
    }
    return defaultSettings
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  const updateSettings = (newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }))
  }

  const updateOpenIdSettings = (openIdSettings) => {
    setSettings(prev => ({
      ...prev,
      openid: { ...prev.openid, ...openIdSettings }
    }))
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, updateOpenIdSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider')
  }
  return context
}
