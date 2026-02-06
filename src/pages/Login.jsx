import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './Login.css'

function Login() {
  const { login, isOpenIdEnabled } = useAuth()
  const navigate = useNavigate()

  if (!isOpenIdEnabled) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h1>Recon Dashboard</h1>
          <p className="login-subtitle">Web Reconnaissance Tool</p>
          <p className="login-note">
            OpenID authentication is not enabled. You can access the dashboard without authentication.
          </p>
          <button className="login-button" onClick={() => navigate('/')}>
            Go to Dashboard
          </button>
          <p className="login-note">
            To enable OpenID authentication, configure it in the <a href="/admin" onClick={(e) => { e.preventDefault(); navigate('/admin'); }}>Admin Panel</a>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Recon Dashboard</h1>
        <p className="login-subtitle">Web Reconnaissance Tool</p>
        <button className="login-button" onClick={login}>
          Sign in with OpenID
        </button>
        <p className="login-note">
          OpenID authentication is enabled. Please sign in to continue.
        </p>
      </div>
    </div>
  )
}

export default Login
