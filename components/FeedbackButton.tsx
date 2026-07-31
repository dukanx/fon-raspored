'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { submitFeedback } from '@/app/actions'

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
const IconFeedback = (p: IconProps) => (
  <svg {...baseIcon(p)}>
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    <path d="M12 8v4" strokeWidth="2" />
    <path d="M12 15.2h.01" strokeWidth="2.4" />
  </svg>
)
const IconMail = (p: IconProps) => (
  <svg {...baseIcon(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m4 7 8 6 8-6" />
  </svg>
)

type Status = 'idle' | 'sending' | 'sent' | 'error'

// Ikonica-dugme za header svake stranice (isti stil kao dugme za temu) koje
// otvara mali formular i šalje poruku developeru na mejl preko Resend-a
// (app/actions.ts submitFeedback).
export default function FeedbackButton({ className = '' }: { className?: string }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  function close() {
    setOpen(false)
    // Reset posle zatvaranja, sa malim kašnjenjem da se ne vidi trepćuće brisanje.
    setTimeout(() => {
      setStatus('idle')
      setMessage('')
      setContact('')
      setError(null)
    }, 300)
  }

  async function send() {
    if (!message.trim() || status === 'sending') return
    setStatus('sending')
    setError(null)
    const res = await submitFeedback({ message, contact, page: pathname, website })
    if (res.success) {
      setStatus('sent')
    } else {
      setStatus('error')
      setError(res.error ?? 'Slanje nije uspelo.')
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Ostavi feedback"
        className={`flex h-9 w-9 items-center justify-center rounded-full text-gray-600 dark:text-gray-300 ${GLASS} hover:bg-white/80 dark:hover:bg-gray-800/70 transition-colors ${className}`}
      >
        <IconFeedback className="h-[18px] w-[18px]" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-100 flex items-end justify-center bg-black/40 px-4 py-6 backdrop-blur-sm sm:items-center"
          onClick={close}
        >
          <div
            className={`w-full max-w-sm rounded-[1.75rem] p-6 ring-1 ring-[#024c7d]/15 dark:ring-white/15 ${GLASS}`}
            onClick={e => e.stopPropagation()}
          >
            {status === 'sent' ? (
              <div className="text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500/15 text-green-600 dark:text-green-400">
                  ✓
                </span>
                <h2 className="mt-3 text-base font-semibold text-gray-900 dark:text-gray-100">Hvala!</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Poruka je poslata.</p>
                <button
                  onClick={close}
                  className="mt-5 w-full rounded-xl bg-[#024c7d] py-2.5 text-sm font-medium text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0] transition-colors"
                >
                  Zatvori
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Predlog ili problem?</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Piši slobodno — greška, ideja, bilo šta.
                </p>

                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={4}
                  maxLength={4000}
                  placeholder="Šta bi promenio, dodao, ili je pukla greška..."
                  className="mt-4 w-full resize-none rounded-xl border border-[#024c7d]/15 bg-white/70 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#024c7d] dark:border-white/20 dark:bg-gray-900/65 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:ring-[#60c3ad]"
                />
                <div className="relative mt-2">
                  <IconMail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                  <input
                    value={contact}
                    onChange={e => setContact(e.target.value)}
                    type="email"
                    inputMode="email"
                    placeholder="Mejl (opciono, ako želiš odgovor)"
                    className="w-full rounded-xl border border-[#024c7d]/15 bg-white/70 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#024c7d] dark:border-white/20 dark:bg-gray-900/65 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:ring-[#60c3ad]"
                  />
                </div>
                {/* Honeypot — sakriveno od korisnika, botovi ga često popune */}
                <input
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="absolute h-0 w-0 opacity-0"
                />

                {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

                <div className="mt-4 space-y-2">
                  <button
                    onClick={send}
                    disabled={!message.trim() || status === 'sending'}
                    className={`w-full rounded-xl py-2.5 text-sm font-medium transition-colors ${
                      message.trim() && status !== 'sending'
                        ? 'bg-[#024c7d] text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0]'
                        : 'bg-white/60 text-gray-400 cursor-not-allowed dark:bg-gray-800/68 dark:text-gray-500'
                    }`}
                  >
                    {status === 'sending' ? 'Šalje se…' : 'Pošalji'}
                  </button>
                  <button
                    onClick={close}
                    className="w-full rounded-xl py-2.5 text-sm font-medium text-gray-500 hover:bg-white/70 dark:text-gray-400 dark:hover:bg-gray-800/60 transition-colors"
                  >
                    Otkaži
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
