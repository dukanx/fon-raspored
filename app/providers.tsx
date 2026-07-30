'use client'

import { useEffect } from 'react'
import { app } from '@/lib/storage'

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = () => {
      const isDark = app.theme.get() === 'dark'
      root.classList.toggle('dark', isDark)
    }

    applyTheme()

    const onSystemThemeChange = () => {
      if (!app.theme.get()) {
        applyTheme()
      }
    }

    media.addEventListener('change', onSystemThemeChange)
    return () => media.removeEventListener('change', onSystemThemeChange)
  }, [])

  return <>{children}</>
}
