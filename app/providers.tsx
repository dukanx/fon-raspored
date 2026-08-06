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

  // Service worker (offline keš). Push ga i dalje registruje nezavisno iz
  // lib/push.ts — register() je idempotentan po (scriptURL, scope) pa se ne
  // sudaraju; ko prvi stigne kreira registraciju, drugi dobije istu.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // Kill-switch: /?nosw=1 odregistruje SW i obriše sve `fon-*` keševe, pa je
    // oporavak od pokvarenog SW-a jedan link, bez deploy-a. Mora PRE svega
    // ostalog da bi ostao dostupan i kad je SW pokvaren.
    if (new URLSearchParams(window.location.search).get('nosw') === '1') {
      void (async () => {
        try {
          const regs = await navigator.serviceWorker.getRegistrations()
          await Promise.all(regs.map(r => r.unregister()))
          const keys = await caches.keys()
          await Promise.all(keys.filter(k => k.startsWith('fon-')).map(k => caches.delete(k)))
        } catch { }
        window.location.replace('/')
      })()
      return
    }

    // U dev-u ne registrujemo — keširan HTML i chunk-ovi se tuku sa Turbopack HMR-om.
    if (process.env.NODE_ENV !== 'production') return

    let reg: ServiceWorkerRegistration | undefined

    // Posle `load` — precache (~900 KB) ne sme da otima propusni opseg prvom renderu.
    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then(r => { reg = r })
        .catch(() => { })
    }
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })

    // Provera update-a kad se tab vrati u fokus. Bez ovoga bi tombstone sw.js
    // (kill-switch nivo 1) čekao browser-ov update ciklus — do 24h.
    const onVisible = () => {
      if (document.visibilityState === 'visible') reg?.update().catch(() => { })
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('load', register)
    }
  }, [])

  return <>{children}</>
}
