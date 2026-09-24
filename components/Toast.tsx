'use client'

import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useIsHydrated } from '@/lib/theme'

// Kratka potvrda pri dnu ekrana (iznad donjeg menija na telefonu). Iskoči
// odozdo i spusti se pri nestajanju. Kad se skriva određuje pozivalac.
// Centriranje ide preko `inset-x-0 mx-auto w-fit`, ne `-translate-x-1/2`,
// jer motion sam postavlja transform i pregazio bi ga. Portal na <body> iz
// istog razloga kao u Modal.tsx.
export default function Toast({ show, children }: { show: boolean; children: React.ReactNode }) {
  const isHydrated = useIsHydrated()
  if (!isHydrated) return null

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.18 } }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          className="fixed inset-x-0 bottom-28 z-100 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white shadow-xl sm:bottom-6 dark:bg-gray-100 dark:text-gray-900"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-400 dark:text-green-600">
            ✓
          </span>
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
