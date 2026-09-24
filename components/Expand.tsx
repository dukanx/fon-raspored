'use client'

import { AnimatePresence, motion } from 'motion/react'

// Sadržaj koji se glatko raširi i skupi (visina 0 ↔ auto). Pri prvom
// iscrtavanju nema animacije, samo pri otvaranju i zatvaranju posle toga.
export default function Expand({
  open,
  className = '',
  children,
}: {
  open: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
          className="overflow-hidden"
        >
          <div className={className}>{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
