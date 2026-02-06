import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { UserManager, WebStorageStateStore } from 'oidc-client-ts'
import { useSettings } from './SettingsContext'

const AuthContext = createContext()

let userManager = null

function createUserManager(settings) {
  if (!settings.openid.enabled || !settings.openid.authority || !settings.openid.clientId) {
    return null
  }

  try {
    const oidcConfig = {
      authority: settings.openid.authority,
      client_id: settings.openid.clientId,
      redirect_uri: settings.openid.redirectUri || window.location.origin + '/callback',
      response_type: 'code',
      scope: settings.openid.scope || 'openid profile email',
      post_logout_redirect_uri: window.location.origin,
      userStore: new WebStorageStateStore({ store: window.localStorage })
    }
    return new UserManager(oidcConfig)
  } catch (err) {
    console.error('Error creating UserManager:', err)
    return null
  }
}

export function AuthProvider({ children }) {
  const { settings } = useSettings()
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const userManagerRef = useRef(null)

  useEffect(() => {
    // Initialize or reinitialize user manager when settings change
    if (settings.openid.enabled && settings.openid.authority && settings.openid.clientId) {
      userManagerRef.current = createUserManager(settings)
      userManager = userManagerRef.current

      if (userManager) {
        setIsLoading(true)
        // Check if user is already authenticated
        userManager.getUser().then(user => {
          if (user) {
            setUser(user)
          }
          setIsLoading(false)
        }).catch(() => {
          setIsLoading(false)
        })

        // Handle redirect callback only if we're on the callback route
        if (window.location.pathname === '/callback') {
          userManager.signinRedirectCallback().then(user => {
            setUser(user)
            window.history.replaceState({}, document.title, '/')
          }).catch(err => {
            console.error('Auth callback error:', err)
            setIsLoading(false)
          })
        }

        // Listen for user changes
        userManager.events.addUserLoaded(user => {
          setUser(user)
        })

        userManager.events.addUserUnloaded(() => {
          setUser(null)
        })
      } else {
        setIsLoading(false)
      }
    } else {
      // OpenID not enabled, allow access without authentication
      userManagerRef.current = null
      userManager = null
      setUser(null)
      setIsLoading(false)
    }
  }, [settings])

  const login = async () => {
    if (!userManager) {
      console.error('OpenID is not configured. Please configure it in the admin panel.')
      return
    }
    try {
      await userManager.signinRedirect()
    } catch (err) {
      console.error('Login error:', err)
    }
  }

  const logout = async () => {
    if (!userManager) {
      setUser(null)
      return
    }
    try {
      await userManager.signoutRedirect()
    } catch (err) {
      console.error('Logout error:', err)
      setUser(null)
    }
  }

  const isAuthenticated = !!user
  const isOpenIdEnabled = settings.openid.enabled && settings.openid.authority && settings.openid.clientId

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoading, 
      login, 
      logout,
      isOpenIdEnabled 
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
