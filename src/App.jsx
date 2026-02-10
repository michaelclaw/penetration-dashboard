import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ReconDashboard from './pages/ReconDashboard'
import ScanningDashboard from './pages/ScanningDashboard'
import AdminPanel from './pages/AdminPanel'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { NotificationProvider } from './contexts/NotificationContext'
import Login from './pages/Login'
import Callback from './pages/Callback'

function AppContent() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/callback" element={<Callback />} />
        <Route
          path="/admin"
          element={
            <Layout>
              <AdminPanel />
            </Layout>
          }
        />
        <Route
          path="/"
          element={
            <Layout>
              <ReconDashboard />
            </Layout>
          }
        />
        <Route
          path="/scanning"
          element={
            <Layout>
              <ScanningDashboard />
            </Layout>
          }
        />
      </Routes>
    </Router>
  )
}

function App() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <AuthProvider>
          <NotificationProvider>
            <AppContent />
          </NotificationProvider>
        </AuthProvider>
      </SettingsProvider>
    </ThemeProvider>
  )
}

export default App
