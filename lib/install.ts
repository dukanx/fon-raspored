// Instalacija aplikacije na početni ekran - zajedničko za karticu
// (InstallPrompt) i baner na vrhu tabova (InstallBanner).
import { useEffect, useState, useSyncExternalStore } from 'react'
import { isIOS, isStandalone } from './push'

// Chrome/Android beforeinstallprompt (nije u standardnom TS lib-u).
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Događaj stiže jednom po učitavanju strane, pa se hvata na nivou modula, a ne
// u komponenti: inače ga pojede kartica na početnoj, a baner na tabu, posle
// prelaska bez ponovnog učitavanja, ostane bez njega.
let odlozen: BeforeInstallPromptEvent | null = null
const slusaoci = new Set<() => void>()
const javi = () => slusaoci.forEach(f => f())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    odlozen = e as BeforeInstallPromptEvent
    javi()
  })
  window.addEventListener('appinstalled', () => {
    odlozen = null
    javi()
  })
}

const pretplati = (f: () => void) => {
  slusaoci.add(f)
  return () => { slusaoci.delete(f) }
}

// Ugrađeni browser društvene mreže (Instagram, Facebook, TikTok...) ne ume da
// instalira aplikaciju; tu jedino pomaže "otvori u browseru".
const UGRADJEN = /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|Snapchat|Line\//

export type Platforma = 'ios' | 'android' | 'other'

export interface Instalacija {
  // Platforma je poznata (posle hidracije); pre toga se ništa ne prikazuje.
  spremno: boolean
  platforma: Platforma
  // Već otvoreno kao instalirana aplikacija.
  instalirano: boolean
  ugradjenBrowser: boolean
  // Browser nudi sistemski prozor za instalaciju (Android Chrome, Edge...).
  mozeOdmah: boolean
  // Otvara sistemski prozor; true ako je student prihvatio.
  instaliraj: () => Promise<boolean>
}

export function useInstalacija(): Instalacija {
  const [okruzenje, setOkruzenje] = useState<{ platforma: Platforma; instalirano: boolean; ugradjen: boolean } | null>(null)
  const prompt = useSyncExternalStore(pretplati, () => odlozen, () => null)

  useEffect(() => {
    const ua = navigator.userAgent
    const platforma: Platforma = isIOS() ? 'ios' : /Android/.test(ua) ? 'android' : 'other'
    // queueMicrotask: izbegava setState sinhrono u efektu (react-hooks pravilo).
    queueMicrotask(() => setOkruzenje({ platforma, instalirano: isStandalone(), ugradjen: UGRADJEN.test(ua) }))
  }, [])

  return {
    spremno: okruzenje !== null,
    platforma: okruzenje?.platforma ?? 'other',
    instalirano: okruzenje?.instalirano ?? true,
    ugradjenBrowser: okruzenje?.ugradjen ?? false,
    mozeOdmah: prompt !== null,
    instaliraj: async () => {
      if (!odlozen) return false
      const e = odlozen
      await e.prompt()
      const { outcome } = await e.userChoice
      // Isti događaj ne može dvaput; browser pošalje nov ako opet ponudi.
      odlozen = null
      javi()
      return outcome === 'accepted'
    },
  }
}
