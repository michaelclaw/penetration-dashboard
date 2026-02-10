import React, { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved || 'hacker'
  })

  const themes = ['light', 'dark', 'hacker', 'midnight']

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'))
  }

  const cycleTheme = () => {
    setTheme(prev => {
      const idx = themes.indexOf(prev)
      const nextIndex = idx === -1 ? 0 : (idx + 1) % themes.length
      return themes[nextIndex]
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, cycleTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
