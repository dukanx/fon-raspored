'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { GLAVNI_TABOVI, IZMENA } from './Navigacija'

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [isCompact, setIsCompact] = useState(false)
  const lastScrollY = useRef(0)

  useEffect(() => {
    lastScrollY.current = window.scrollY

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const delta = currentScrollY - lastScrollY.current
      const scrollingElement = document.scrollingElement ?? document.documentElement
      const maxScrollY = scrollingElement.scrollHeight - window.innerHeight
      const isNearBottom = maxScrollY - currentScrollY < 96
      const wasNearBottom = maxScrollY - lastScrollY.current < 96

      if (currentScrollY < 24) {
        setIsCompact(false)
        lastScrollY.current = currentScrollY
      } else if (delta < 0 && isNearBottom && wasNearBottom) {
        lastScrollY.current = currentScrollY
      } else if (Math.abs(delta) > 6) {
        setIsCompact(delta > 0)
        lastScrollY.current = currentScrollY
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Klik na tab na kome si vraća na vrh strane.
  const idi = (href: string) =>
    pathname === href ? window.scrollTo({ top: 0, behavior: 'smooth' }) : router.push(href)

  // U instaliranoj aplikaciji (standalone) viewport-fit=cover daje pun
  // safe-area-inset-bottom (~34px na iPhone-u), pa bi navbar lebdeo visoko
  // iznad home indikatora. Tamo ulazi delom u tu zonu, kao sistemski tab bar;
  // max() čuva isti razmak na uređajima bez home indikatora (inset 0).
  return (
    <nav
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 transition-[padding] duration-300 sm:hidden ${
        isCompact
          ? 'px-12 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] [@media(display-mode:standalone)]:pb-[max(0.35rem,env(safe-area-inset-bottom)_-_1rem)]'
          : 'px-3.5 pb-[calc(env(safe-area-inset-bottom)+0.575rem)] [@media(display-mode:standalone)]:pb-[max(0.575rem,env(safe-area-inset-bottom)_-_0.75rem)]'
      }`}
    >
      {/* Krug je visok koliko i traka sa tabovima (65px, a 46px skupljena pri skrolu). */}
      <div className={`mx-auto flex items-center gap-2 transition-all duration-300 ${isCompact ? 'max-w-72' : 'max-w-md'}`}>
        <div
          className={`liquid-glass liquid-glass-nav pointer-events-auto flex flex-1 items-stretch transition-all duration-300 ${
            isCompact ? 'gap-0.5 rounded-[1.65rem] px-1.5 py-1.5' : 'gap-1 rounded-[2rem] px-2 py-1.5'
          }`}
        >
          {GLAVNI_TABOVI.map(({ key, href, short, Icon }) => {
            const active = pathname === href
            return (
              <button
                key={key}
                onClick={() => idi(href)}
                className={`relative flex flex-1 flex-col items-center rounded-[1.5625rem] transition-all duration-300 ${
                  isCompact ? 'gap-0 px-1.5 py-1.5' : 'gap-0.5 px-2 py-1.5'
                } ${
                  active
                    ? 'text-[#024c7d] dark:text-[#60c3ad]'
                    : 'text-gray-500 dark:text-gray-400 active:scale-90 transition-transform'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="navPill"
                    className="absolute inset-0 rounded-[1.5625rem] bg-[#024c7d]/10 dark:bg-[#60c3ad]/15"
                    transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                  />
                )}
                <Icon
                  className={`relative transition-all duration-300 ${
                    isCompact ? 'h-5 w-5' : 'h-[22px] w-[22px]'
                  }`}
                />
                <span
                  className={`relative overflow-hidden text-[10px] transition-all duration-300 ${
                    isCompact ? 'max-h-0 opacity-0' : 'max-h-4 opacity-100'
                  } ${active ? 'font-semibold' : 'font-medium'}`}
                >
                  {short}
                </span>
              </button>
            )
          })}
        </div>

        {/* Izmena je sporedna: odvojeno okruglo dugme, bez natpisa. */}
        <button
          onClick={() => idi(IZMENA.href)}
          aria-label={IZMENA.short}
          className={`liquid-glass liquid-glass-nav pointer-events-auto flex shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
            isCompact ? 'h-[46px] w-[46px]' : 'h-[65px] w-[65px]'
          } ${
            pathname === IZMENA.href
              ? 'text-[#024c7d] dark:text-[#60c3ad]'
              : 'text-gray-500 dark:text-gray-400 active:scale-90'
          }`}
        >
          {pathname === IZMENA.href && (
            <span className="absolute inset-1.5 rounded-full bg-[#024c7d]/10 dark:bg-[#60c3ad]/15" />
          )}
          <IZMENA.Icon className={`relative transition-all duration-300 ${isCompact ? 'h-5 w-5' : 'h-[22px] w-[22px]'}`} />
        </button>
      </div>
    </nav>
  )
}
