'use client'

import { usePathname, useRouter } from 'next/navigation'
import { IconEdit, IconExam, IconSchedule } from './Ikone'

// Glavni tabovi su Raspored i Rokovi; Izmena je sporedna i stoji odvojeno,
// kao okruglo dugme pored njih (kao pretraga pored tabova u iOS-u). Isti
// raspored i u donjem meniju na telefonu (BottomNav) i u zaglavlju na računaru.
export const GLAVNI_TABOVI = [
  { key: 'raspored', href: '/raspored', short: 'Raspored', Icon: IconSchedule },
  { key: 'rokovi', href: '/rokovi', short: 'Rokovi', Icon: IconExam },
] as const

export const IZMENA = { key: 'preneseni', href: '/preneseni', short: 'Izmena', Icon: IconEdit } as const

// Prekidač u zaglavlju, samo na računaru (na telefonu je donji meni).
export function TabPrekidac() {
  const pathname = usePathname()
  const router = useRouter()
  const idi = (href: string) => { if (!pathname.startsWith(href)) router.push(href) }
  const izmenaAktivna = pathname.startsWith(IZMENA.href)

  return (
    <div className="hidden items-center gap-2 sm:flex sm:justify-self-center">
      <nav className="liquid-glass flex rounded-full p-1">
        {GLAVNI_TABOVI.map(({ key, href, short, Icon }) => {
          const aktivan = pathname.startsWith(href)
          return (
            <button
              key={key}
              onClick={() => idi(href)}
              aria-current={aktivan ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors
                ${aktivan
                  ? 'bg-white text-[#024c7d] shadow-sm dark:bg-gray-700 dark:text-[#60c3ad]'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
            >
              <Icon className="h-4 w-4" />
              {short}
            </button>
          )
        })}
      </nav>
      <button
        onClick={() => idi(IZMENA.href)}
        aria-label={IZMENA.short}
        title={IZMENA.short}
        aria-current={izmenaAktivna ? 'page' : undefined}
        className={`flex h-[38px] w-[38px] items-center justify-center rounded-full transition-colors
          ${izmenaAktivna
            ? 'liquid-glass text-[#024c7d] dark:text-[#60c3ad]'
            : 'liquid-glass text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
      >
        {/* Izabrano izgleda isto kao izabran tab: bela podloga, plava ikonica. */}
        {izmenaAktivna && <span className="absolute inset-1 rounded-full bg-white shadow-sm dark:bg-gray-700" />}
        <IZMENA.Icon className="relative h-4 w-4" />
      </button>
    </div>
  )
}
