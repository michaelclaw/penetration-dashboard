import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import './Layout.css'

function Layout({ children }) {
  const { user, logout, isOpenIdEnabled } = useAuth()
  const { theme, toggleTheme, cycleTheme, themes } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()

  const isAdminPage = location.pathname === '/admin'
  const isScanningPage = location.pathname === '/scanning'
  const isReconPage = location.pathname === '/'

  return (
    <div className="layout">
      <header className="header">
        <div className="header-left">
          <h1 className="logo">Penetration Testing</h1>
          <nav className="nav-tabs">
            <button 
              className={`nav-tab ${isReconPage ? 'active' : ''}`}
              onClick={() => navigate('/')}
            >
              Reconnaissance
            </button>
            <button
              className={`nav-tab ${isScanningPage ? 'active' : ''}`}
              onClick={() => navigate('/scanning')}
            >
              Scanning
            </button>
            <button className="nav-tab" disabled>Exploitation</button>
            <button className="nav-tab" disabled>Post-Exploitation</button>
            <button className="nav-tab" disabled>Reporting</button>
            <button 
              className={`nav-tab ${isAdminPage ? 'active' : ''}`}
              onClick={() => navigate('/admin')}
            >
              Admin
            </button>
          </nav>
        </div>
        <div className="header-right">
          <button 
            className="theme-toggle" 
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button
            className="theme-toggle"
            onClick={cycleTheme}
            title={`Theme: ${theme} (${themes.indexOf(theme) + 1}/${themes.length})`}
          >
            🎛️
          </button>
          {isOpenIdEnabled && (
            <>
              {user ? (
                <div className="user-menu">
                  <span className="user-name">{user.profile?.name || user.profile?.email || 'User'}</span>
                  <button className="logout-btn" onClick={logout}>Logout</button>
                </div>
              ) : (
                <button className="login-header-btn" onClick={() => navigate('/login')}>
                  Login
                </button>
              )}
            </>
          )}
        </div>
      </header>
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}

export default Layout
