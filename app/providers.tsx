'use client'

import { useEffect } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = () => {
      const savedTheme = localStorage.getItem('fon_theme')
      const isDark = savedTheme === 'dark'
      root.classList.toggle('dark', isDark)
    }

    applyTheme()

    const onSystemThemeChange = () => {
      if (!localStorage.getItem('fon_theme')) {
        applyTheme()
      }
    }

    media.addEventListener('change', onSystemThemeChange)
    return () => media.removeEventListener('change', onSystemThemeChange)
  }, [])

  return <>{children}</>
}
