'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

export type IconProps = React.SVGProps<SVGSVGElement>
export const baseIcon = (p: IconProps) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p,
})

export type TourFeature = {
  icon: (p: IconProps) => React.JSX.Element
  title: string
  desc: string
}

export type TourSlide = {
  key: string
  icon: (p: IconProps) => React.JSX.Element
  title: string
  // Opciono — na slajdu koji je samo spisak stavki podnaslov je vata.
  desc?: string
  features?: TourFeature[]
  // Kad slajd ima sopstvenu akciju (npr. "Idi na Izmenu") umesto generičkog
  // "Dalje" — klik odmah zatvara ceo tur (ne samo ovaj slajd).
  primaryLabel?: string
  onPrimary?: () => void
  // Zamena za "Preskoči" (npr. "Kasnije") kad slajd ima sopstvenu akciju.
  secondaryLabel?: string
  // Bitan slajd — "Preskoči" na RANIJEM slajdu skoči direktno na njega umesto
  // da zatvori ceo tur (npr. "Podesi termine" ne sme da se preskoči nezapaženo).
  important?: boolean
}

// Generički multi-slajd popup — isti vizuelni obrazac kao NotificationIntro
// (ikonica-bedž, naslov, feature-red), samo sa navigacijom kroz više slajdova.
// Namerno bez screenshotova (vidi FirstRunOverlays.tsx za zašto je
// Tutorial.tsx sa screenshotovima isključen).
export default function AppTour({
  slides,
  onClose,
}: {
  slides: TourSlide[]
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)
  const slide = slides[index]
  const isLast = index === slides.length - 1

  function next() {
    if (isLast) onClose()
    else setIndex(i => i + 1)
  }

  // "Preskoči" ne sme da preskoči bitan slajd koji tek dolazi — skoči na njega.
  function skip() {
    const nextImportant = slides.findIndex((s, i) => i > index && s.important)
    if (nextImportant !== -1) setIndex(nextImportant)
    else onClose()
  }

  // Enter = glavno dugme (Dalje / Gotovo / sopstvena akcija slajda), Esc = zatvori.
  const primary = slide.onPrimary ?? next
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); primary() }
      else if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-100 flex items-end justify-center bg-black/40 px-4 py-6 backdrop-blur-sm sm:items-center"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.key}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          // Na desktopu je modal centriran, pa bi različite visine slajdova
          // pomerale dugmad pri svakom "Dalje". Fiksna minimalna visina + mt-auto
          // na podnožju drže tačkice i dugmad na istom mestu kroz ceo tur.
          // Na mobilnom je modal prilepljen za dno pa problem ne postoji.
          className="liquid-glass w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-[1.75rem] p-6 ring-1 ring-[#024c7d]/15 dark:ring-white/15 sm:flex sm:min-h-152 sm:flex-col"
        >
          <div className="flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#024c7d]/10 text-[#024c7d] dark:bg-[#60c3ad]/15 dark:text-[#60c3ad]">
              <slide.icon className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {slide.title}
            </h2>
            {slide.desc && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {slide.desc}
              </p>
            )}
          </div>

          {slide.features && slide.features.length > 0 && (
            <div className="mt-5 space-y-2.5">
              {slide.features.map(f => (
                <div
                  key={f.title}
                  className="flex items-start gap-3 rounded-2xl border border-[#024c7d]/10 p-3 dark:border-white/10"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#024c7d]/10 text-[#024c7d] dark:bg-[#60c3ad]/15 dark:text-[#60c3ad]">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{f.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Podnožje: sm:mt-auto ga lepi za dno kartice, pa tačkice i dugmad
              stoje na istom mestu bez obzira na dužinu slajda. */}
          <div className="sm:mt-auto">
          {slides.length > 1 && (
            <div className="mt-5 flex items-center justify-center gap-1.5">
              {slides.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Slajd ${i + 1}`}
                  className="p-1 -m-1"
                >
                  <span
                    className={`block h-1.5 rounded-full transition-all ${
                      i === index
                        ? 'w-4 bg-[#024c7d] dark:bg-[#60c3ad]'
                        : 'w-1.5 bg-[#024c7d]/20 dark:bg-[#60c3ad]/25 hover:bg-[#024c7d]/40 dark:hover:bg-[#60c3ad]/40'
                    }`}
                  />
                </button>
              ))}
            </div>
          )}

          <div className="mt-5 space-y-2">
            <button
              onClick={slide.onPrimary ?? next}
              className="w-full rounded-xl bg-[#024c7d] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0]"
            >
              {slide.primaryLabel ?? (isLast ? 'Gotovo' : 'Dalje')}
            </button>
            {(slide.onPrimary || !isLast) && (
              <button
                onClick={skip}
                className="w-full rounded-xl py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-white/70 dark:text-gray-400 dark:hover:bg-gray-800/60"
              >
                {slide.secondaryLabel ?? 'Preskoči'}
              </button>
            )}
          </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
