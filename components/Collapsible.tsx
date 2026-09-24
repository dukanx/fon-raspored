'use client'

import { AnimatePresence, motion } from 'motion/react'
import Expand from './Expand'

// Sekcija koja se otvara na tap: zaglavlje sa naslovom i brojem izabranih,
// a sadržaj se glatko raširi (visina 0 → auto).
export default function Collapsible({
  open,
  onToggle,
  title,
  count = 0,
  children,
}: {
  open: boolean
  onToggle: () => void
  title: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <div
      className={`rounded-2xl border transition-colors duration-300 ${
        open
          ? 'border-[#024c7d]/20 bg-white/55 dark:border-white/15 dark:bg-gray-900/45'
          : 'border-[#024c7d]/10 bg-white/30 dark:border-white/10 dark:bg-gray-900/25'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="no-hover-lift flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left"
      >
        <span className="min-w-0 flex-1 text-sm font-medium text-gray-800 dark:text-gray-100">{title}</span>
        <AnimatePresence initial={false}>
          {count > 0 && (
            <motion.span
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#024c7d] px-1.5 text-[11px] font-semibold text-white tabular-nums dark:bg-[#60c3ad] dark:text-[#024c7d]"
            >
              {/* Broj kratko "pukne" na svaku promenu. */}
              <motion.span key={count} initial={{ scale: 1.35 }} animate={{ scale: 1 }}>
                {count}
              </motion.span>
            </motion.span>
          )}
        </AnimatePresence>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`size-4 shrink-0 text-gray-400 transition-transform duration-300 dark:text-gray-500 ${open ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <Expand open={open} className="space-y-3 px-3.5 pt-0.5 pb-3.5">
        {children}
      </Expand>
    </div>
  )
}
