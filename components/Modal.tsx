'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useIsHydrated } from '@/lib/theme'

// Zajednički popup: zatamnjena pozadina i kartica, sa animacijom ulaska i
// izlaska (isti pokret kao NotificationIntro). Izgled ostaje kod pozivaoca:
// z-index, poravnanje i stil kartice se razlikuju od popupa do popupa, pa se
// prosleđuju kao klase. Klik na pozadinu i Escape zatvaraju, klik u kartici ne.
//
// Pri zatvaranju AnimatePresence iscrtava poslednju verziju sadržaja dok
// kartica izlazi, pa sadržaj sme da zavisi od stanja koje se pri zatvaranju
// obriše (npr. `eventModal && …`).
//
// Iscrtava se u portal na <body>: ulazna animacija strane (PageTransition)
// kratko postavlja transform na omotač, a uz transform na pretku `fixed` više
// ne bi bio u odnosu na ekran.
export default function Modal({
  open,
  onClose,
  overlayClassName,
  className,
  children,
}: {
  open: boolean
  onClose?: () => void
  overlayClassName: string
  className: string
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open || !onClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const isHydrated = useIsHydrated()
  if (!isHydrated) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.18 } }}
          transition={{ duration: 0.2 }}
          className={`fixed inset-0 ${overlayClassName}`}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97, transition: { duration: 0.16 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className={className}
            onClick={e => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
