import { useSyncExternalStore } from 'react'
import { app } from './storage'
import { PODRAZUMEVANA_TEMA, type Tema } from './temaOsnova'

// Prati `dark` klasu na <html> reaktivno - za inline stilove zavisne od teme
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

// true tek posle hidracije (na serveru vraća false) - za uslovni klijentski
// sadržaj bez hydration mismatch-a.
export function useIsHydrated(): boolean {
  return useSyncExternalStore(() => () => {}, () => true, () => false)
}

// Tema: ručni izbor iz Izmene ili prati telefon ('auto'). Tamni izgled
// vozi isključivo `dark` klasa na <html> (globals.css).
export type { Tema }

const SISTEM_TAMNO = '(prefers-color-scheme: dark)'
const PROMENA = 'fon-tema'

export function izabranaTema(): Tema {
  const t = app.theme.get()
  return t === 'auto' || t === 'light' || t === 'dark' ? t : PODRAZUMEVANA_TEMA
}

export function primeniTemu(): void {
  const t = izabranaTema()
  const tamno = t === 'dark' || (t === 'auto' && window.matchMedia(SISTEM_TAMNO).matches)
  document.documentElement.classList.toggle('dark', tamno)
}

export function postaviTemu(t: Tema): void {
  app.theme.set(t)
  primeniTemu()
  window.dispatchEvent(new Event(PROMENA))
}

// Kad telefon sam pređe u tamno (npr. uveče), i aplikacija prati, ako je 'auto'.
export function pratiSistemskuTemu(): () => void {
  const media = window.matchMedia(SISTEM_TAMNO)
  const promena = () => { if (izabranaTema() === 'auto') primeniTemu() }
  media.addEventListener('change', promena)
  return () => media.removeEventListener('change', promena)
}

export function useTema(): Tema {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(PROMENA, onChange)
      return () => window.removeEventListener(PROMENA, onChange)
    },
    izabranaTema,
    () => PODRAZUMEVANA_TEMA,
  )
}
