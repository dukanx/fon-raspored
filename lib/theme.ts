import { useSyncExternalStore } from 'react'
import { app } from './storage'

// Prati `dark` klasu na <html> reaktivno — za inline stilove zavisne od teme
// (npr. boje kartica koje se ne mogu izraziti Tailwind klasama).
export function useIsDark(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') return () => {}
      const observer = new MutationObserver(onStoreChange)
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
      return () => observer.disconnect()
    },
    () => document.documentElement.classList.contains('dark'),
    () => false,
  )
}

// true tek posle hidracije (na serveru vraća false) — za uslovni klijentski
// sadržaj bez hydration mismatch-a.
export function useIsHydrated(): boolean {
  return useSyncExternalStore(() => () => {}, () => true, () => false)
}

// Prebaci temu i upamti izbor u localStorage.
export function toggleTheme(): void {
  const root = document.documentElement
  const willBeDark = !root.classList.contains('dark')
  root.classList.toggle('dark', willBeDark)
  app.theme.set(willBeDark ? 'dark' : 'light')
}
