'use client'

import { useEffect, useState } from 'react'
import { useSwipeable } from 'react-swipeable'

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
const IconInfo = (p: IconProps) => (
  <svg {...baseIcon(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></svg>
)
const IconHide = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 9 5 9 5s-.9 1.1-2.3 2.4" /><path d="M6.6 6.6C4.4 8 3 10 3 10s4 5 9 5c1.2 0 2.3-.2 3.3-.6" /></svg>
)
const IconSparkle = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /><circle cx="12" cy="12" r="2.5" /></svg>
)
const IconBell = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M6 9a6 6 0 0 1 12 0v.75a8.97 8.97 0 0 0 2.31 6.02c.3.33.06.86-.38.98A23.85 23.85 0 0 1 12 18a23.85 23.85 0 0 1-7.93-1.25c-.44-.12-.68-.65-.38-.98A8.97 8.97 0 0 0 6 9.75Z" /><path d="M9.5 20a2.5 2.5 0 0 0 5 0" /></svg>
)
const IconShare = (p: IconProps) => (
  <svg {...baseIcon(p)}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.5 6.8-3.9M8.6 13.5l6.8 3.9" /></svg>
)

type Slide = {
  key: string
  title: string
  description: string
  images: string[]
  Icon: (p: IconProps) => React.ReactElement
}

// Fokus na stvari koje se NE VIDE same od sebe (klik/swipe/skriveno dugme) —
// tabovi (Raspored/Rokovi/Izmena) su već očigledni iz donjeg menija.
// Screenshot-ovi u public/tutorial/*.png — dok fajl ne postoji, prikazuje se
// ikonica-placeholder (onError na <img>) da slajd ne izgleda polomljeno.
const SLIDES: Slide[] = [
  {
    key: 'panel',
    title: 'Klikni na čas za detalje',
    description: 'ESPB, katedra, link ka strani predmeta, povezani rokovi, i mesto za tvoju ličnu belešku uz svaki predmet.',
    images: ['/tutorial/panel-1.png'],
    Icon: IconInfo,
  },
  {
    key: 'hide',
    title: 'Ne treba ti termin? Sakrij ga',
    description: 'Prevuci termin ulevo ili klikni X kod detalja predmeta da ga skloniš iz prikaza, u svakom trenutku možeš da ga vratiš nazad iz taba „Izmena".',
    images: ['/tutorial/hide-1.png', '/tutorial/hide-2.png'],
    Icon: IconHide,
  },
  {
    key: 'izmena',
    title: 'Dodatni termini? AI bira termin',
    description: 'U tabu „Izmena" dodaješ predmete iz prethodnih godina ili menjaš termin postojećeg. Jedan klik i AI predlaže predavanja i vežbe bez preklapanja i bez nepotrebnih pauza.',
    images: ['/tutorial/izmena-1.png', '/tutorial/izmena-2.png'],
    Icon: IconSparkle,
  },
  {
    key: 'notifikacije',
    title: 'Ne propusti rok ili prijavu',
    description: 'Uključi notifikacije i javljamo ti kad izađe novi rok, i na dan kad počinje i kad se završava prijava ispita.',
    images: ['/tutorial/notifikacije-1.png', '/tutorial/notifikacije-2.png'],
    Icon: IconBell,
  },
  {
    key: 'deli',
    title: 'Podeli, izvezi, sačuvaj',
    description: 'Pošalji izbor predmeta kolegi jednim linkom, ili izvezi raspored i rokove kao sliku ili u kalendar, iz taba „Raspored" ili "Rokovi".',
    images: ['/tutorial/deli-1.png', '/tutorial/deli-2.png', '/tutorial/deli-3.png'],
    Icon: IconShare,
  },
]

// Prvi-put walkthrough kroz glavne funkcije aplikacije. Prikazuje se jednom
// (fon_tutorial_seen), pre prvog notif-modala — vidi FirstRunOverlays.
//
// Slajdovi su teme (5), svaka tema može imati više screenshot-ova koji sami
// prolaze kao Instagram/Snapchat story (traka segmenata na vrhu slike, auto
// napredovanje, tap levo/desno za ručnu kontrolu). Spoljašnje swipe/Dalje
// dugme uvek menja TEMU, ne sliku unutar teme.
export default function Tutorial({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0)
  const [imgIndex, setImgIndex] = useState(0)
  const [broken, setBroken] = useState<Set<string>>(new Set())
  const last = index === SLIDES.length - 1
  const slide = SLIDES[index]
  const imgKey = `${slide.key}-${imgIndex}`

  useEffect(() => {
    // queueMicrotask: izbegava setState sinhrono u efektu (react-hooks pravilo).
    queueMicrotask(() => setImgIndex(0))
  }, [index])

  // Auto-napredovanje kroz slike unutar teme (kao story) — staje na poslednjoj.
  useEffect(() => {
    if (slide.images.length <= 1 || imgIndex >= slide.images.length - 1) return
    const t = setTimeout(() => setImgIndex(i => i + 1), 5600)
    return () => clearTimeout(t)
  }, [slide.images.length, imgIndex])

  function next() {
    if (last) onDone()
    else setIndex(i => i + 1)
  }
  function prev() {
    if (index > 0) setIndex(i => i - 1)
  }

  const handlers = useSwipeable({
    onSwipedLeft: next,
    onSwipedRight: prev,
    trackMouse: false,
  })

  return (
    <div className="fixed inset-0 z-70 flex items-end justify-center bg-black/40 px-4 py-6 backdrop-blur-sm sm:items-center">
      <div
        {...handlers}
        className={`w-full max-w-sm overflow-hidden rounded-[1.75rem] ring-1 ring-[#024c7d]/15 dark:ring-white/15 ${GLASS}`}
      >
        <div className="flex items-center justify-end px-4 pt-4">
          <button
            onClick={onDone}
            className="rounded-full px-2.5 py-1 text-xs font-medium text-gray-400 hover:bg-white/70 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800/60 dark:hover:text-gray-300 transition-colors"
          >
            Preskoči
          </button>
        </div>

        <div className="relative mx-4 aspect-3/5 overflow-hidden rounded-2xl ring-1 ring-[#024c7d]/20 shadow-[0_8px_24px_rgba(2,76,125,0.14)] dark:ring-white/20 dark:shadow-[0_8px_24px_rgba(0,0,0,0.4)] bg-linear-to-br from-[#024c7d]/10 to-[#60c3ad]/10 dark:from-[#024c7d]/20 dark:to-[#60c3ad]/15">
          {slide.images.length > 1 && (
            <>
              {/* Scrim iza trake — traka ostaje čitljiva bez obzira na sadržaj screenshot-a. */}
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-14 bg-linear-to-b from-black/55 to-transparent" />
              <div className="pointer-events-none absolute inset-x-2.5 top-2.5 z-10 flex gap-1.5">
                {slide.images.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      i <= imgIndex ? 'bg-white' : 'bg-white/35'
                    }`}
                  />
                ))}
              </div>
            </>
          )}

          {!broken.has(imgKey) ? (
            <img
              src={slide.images[imgIndex]}
              alt={slide.title}
              className="h-full w-full object-cover object-top"
              onError={() => setBroken(prev => new Set(prev).add(imgKey))}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <slide.Icon className="h-14 w-14 text-[#024c7d]/40 dark:text-[#60c3ad]/40" />
            </div>
          )}

          {slide.images.length > 1 && (
            <>
              <button
                aria-label="Prethodna slika"
                onClick={() => setImgIndex(i => Math.max(0, i - 1))}
                className="absolute inset-y-0 left-0 z-10 w-1/3"
              />
              <button
                aria-label="Sledeća slika"
                onClick={() => setImgIndex(i => Math.min(slide.images.length - 1, i + 1))}
                className="absolute inset-y-0 right-0 z-10 w-1/3"
              />
            </>
          )}
        </div>

        <div className="px-6 pb-6 pt-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{slide.title}</h2>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{slide.description}</p>

          <div className="mt-5 flex items-center justify-center gap-1.5">
            {SLIDES.map((s, i) => (
              <span
                key={s.key}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index ? 'w-5 bg-[#024c7d] dark:bg-[#60c3ad]' : 'w-1.5 bg-[#024c7d]/20 dark:bg-white/20'
                }`}
              />
            ))}
          </div>

          <button
            onClick={next}
            className="mt-5 w-full rounded-xl bg-[#024c7d] py-2.5 text-sm font-medium text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0] transition-colors"
          >
            {last ? 'Počni' : 'Dalje'}
          </button>
        </div>
      </div>
    </div>
  )
}
