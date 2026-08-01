'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'motion/react'

/* ---------- Ikonice (stroke, currentColor — rade u obe teme) ---------- */
type IconProps = React.SVGProps<SVGSVGElement>
const baseIcon = (props: IconProps) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
})
const IconSchedule = (p: IconProps) => (
  <svg {...baseIcon(p)}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4M7.5 13h4M7.5 17h7" /></svg>
)
const IconEdit = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
)
const IconExam = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" /></svg>
)

const TABS = [
  { key: 'raspored', href: '/raspored', short: 'Raspored', Icon: IconSchedule },
  { key: 'preneseni', href: '/preneseni', short: 'Izmena', Icon: IconEdit },
  { key: 'rokovi', href: '/rokovi', short: 'Rokovi', Icon: IconExam },
] as const

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

  return (
    <nav
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 transition-[padding] duration-300 sm:hidden ${
        isCompact
          ? 'px-12 pb-[calc(env(safe-area-inset-bottom)+0.35rem)]'
          : 'px-3.5 pb-[calc(env(safe-area-inset-bottom)+0.575rem)]'
      }`}
    >
      <div
        className={`liquid-glass liquid-glass-nav pointer-events-auto mx-auto flex items-stretch transition-[padding,gap,border-radius] duration-300 ${
          isCompact
            ? 'max-w-64 gap-0.5 rounded-[1.65rem] px-1.5 py-1.5'
            : 'max-w-md gap-1 rounded-[2rem] px-2 py-1.5'
        }`}
      >
        {TABS.map(({ key, href, short, Icon }) => {
          const active = pathname === href
          return (
            <button
              key={key}
              onClick={() =>
                active
                  ? window.scrollTo({ top: 0, behavior: 'smooth' })
                  : router.push(href)
              }
              className={`relative flex flex-1 flex-col items-center rounded-[1.5625rem] transition-[padding,gap] duration-300 ${
                isCompact ? 'gap-0 py-1.5' : 'gap-0.5 py-1.5'
              } ${
                isCompact ? 'px-1.5' : 'px-2'
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
                className={`relative transition-[width,height] duration-300 ${
                  isCompact ? 'h-5 w-5' : 'h-[22px] w-[22px]'
                }`}
              />
              <span
                className={`relative overflow-hidden text-[10px] transition-[max-height,opacity] duration-300 ${
                  isCompact ? 'max-h-0 opacity-0' : 'max-h-4 opacity-100'
                } ${active ? 'font-semibold' : 'font-medium'}`}
              >
                {short}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
