import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function Callback() {
  const navigate = useNavigate()
  const { user, isOpenIdEnabled } = useAuth()

  useEffect(() => {
    // If OpenID is not enabled, redirect to home
    if (!isOpenIdEnabled) {
      navigate('/')
      return
    }

    // The AuthContext handles the callback, just redirect after a moment
    if (user) {
      navigate('/')
    }
  }, [user, isOpenIdEnabled, navigate])

  if (!isOpenIdEnabled) {
    return null
  }

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      fontSize: '18px'
    }}>
      Completing authentication...
    </div>
  )
}

export default Callback
