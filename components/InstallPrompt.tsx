'use client'

import { useEffect, useState } from 'react'

// Chrome/Android beforeinstallprompt (nije u standardnom TS lib-u).
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const GLASS = 'liquid-glass'

type IconProps = React.SVGProps<SVGSVGElement>
const baseIcon = (p: IconProps) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p,
})
// Strelica u fioku — "instaliraj / preuzmi".
const IconInstall = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M12 3v11M8 10l4 4 4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
)
// Zaobljeni kvadrat sa plusom — iOS "Dodaj na početni ekran".
const IconAddToHome = (p: IconProps) => (
  <svg {...baseIcon(p)}><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M12 8v8M8 12h8" /></svg>
)

// Kartica sa uputstvom za instalaciju PWA. Sama se sakrije ako je app već
// instalirana (standalone) ili na desktopu bez install prompta.
//
// withLink: na /deli strani pokazuje i "kopiraj ovaj link" — jer na iOS-u
// instalirana PWA ima odvojen storage od Safarija, pa se deljeni raspored
// primenjuje tek kad se link nalepi UNUTAR aplikacije.
export default function InstallPrompt({
  withLink = false,
  className = '',
}: {
  withLink?: boolean
  className?: string
}) {
  const [checked, setChecked] = useState(false)
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other')
  const [standalone, setStandalone] = useState(true)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    const maxTouch = navigator.maxTouchPoints ?? 0
    const iosUA = /iPad|iPhone|iPod/.test(ua)
    const ipadOS = navigator.platform === 'MacIntel' && maxTouch > 1
    const ios = (iosUA || ipadOS) && maxTouch > 0
    const android = /Android/.test(ua)
    const sa =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true

    const href = window.location.href
    // queueMicrotask: izbegava setState sinhrono u efektu (react-hooks pravilo).
    queueMicrotask(() => {
      setPlatform(ios ? 'ios' : android ? 'android' : 'other')
      setStandalone(sa)
      setUrl(href)
      setChecked(true)
    })

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  // Ne prikazuj dok ne izmerimo, u instaliranoj PWA, ni na desktopu bez prompta.
  if (!checked || standalone) return null
  if (platform === 'other' && !deferred) return null

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    setDeferred(null)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard nedostupan — tiho odustani
    }
  }

  return (
    <div className={`rounded-2xl border border-[#024c7d]/15 dark:border-white/15 p-4 ${GLASS} ${className}`}>
      <p className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-gray-100">
        <IconInstall className="h-4 w-4 text-[#024c7d] dark:text-[#60c3ad]" />
        Instaliraj aplikaciju
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Brže i lakše korišćenje, uz mogućnost notifikacija za rokove i prijave ispita.
      </p>

      {deferred ? (
        <button
          onClick={install}
          className="mt-3 w-full rounded-xl bg-[#024c7d] py-2 text-sm font-medium text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0] transition-colors"
        >
          Instaliraj
        </button>
      ) : platform === 'ios' ? (
        <ol className="mt-3 list-decimal list-inside space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <li>Klikni <span className="font-medium">Podeli</span> (Share) u Safariju.</li>
          <li>
            Izaberi <span className="font-medium">{'„Na početni ekran”'}</span>{' '}
            <IconAddToHome className="inline h-4 w-4 align-text-bottom" /> (Add to Home Screen).
          </li>
          <li>Otvori aplikaciju sa početnog ekrana.</li>
        </ol>
      ) : (
        <ol className="mt-3 list-decimal list-inside space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <li>Otvori meni <span className="font-medium">(⋮)</span> u browseru.</li>
          <li>Izaberi <span className="font-medium">{'„Instaliraj aplikaciju”'}</span>.</li>
        </ol>
      )}

      {withLink && (
        <div className="mt-3 border-t border-[#024c7d]/10 pt-3 dark:border-white/10">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Posle instalacije, nalepi ovaj link u aplikaciji i dobićeš isti raspored:
          </p>
          <button
            onClick={copyLink}
            className="mt-2 w-full rounded-xl border border-[#024c7d]/15 py-2 text-xs font-medium text-[#024c7d] hover:bg-white/70 dark:border-white/20 dark:text-[#60c3ad] dark:hover:bg-gray-800/60 transition-colors"
          >
            {copied ? 'Kopirano ✓' : 'Kopiraj link'}
          </button>
        </div>
      )}
    </div>
  )
}
