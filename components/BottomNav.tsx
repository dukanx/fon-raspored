'use client'

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

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3.5 pb-[calc(env(safe-area-inset-bottom)+0.575rem)] sm:hidden">
      <div className="liquid-glass pointer-events-auto mx-auto flex max-w-md items-stretch gap-1 rounded-[2rem] px-2 py-1.5">
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
              className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-[1.5625rem] px-2 py-1.5 transition-colors duration-300 ${
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
              <Icon className="relative h-[22px] w-[22px]" />
              <span className={`relative text-[10px] ${active ? 'font-semibold' : 'font-medium'}`}>{short}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
