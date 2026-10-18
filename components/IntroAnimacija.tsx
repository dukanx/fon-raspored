'use client'

// Animacija logoa: FON-ovi krugovi se sklope u kalendar. Telefon: kratka
// (potez pera, 1,8 s) preko cele aplikacije pri ulasku, dodir preskače.
// Računar: v3, sa natpisom, umesto logoa i naslova na početnoj.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

const VIDEO = '/logo-animacija.mp4' // telefon, splash
// Video je položen (16:9), pa na uspravnom telefonu zauzima samo traku po
// sredini. Na kraju se kalendar uvećava preko ivica kadra (izmereno: ivicu
// dodirne na 1,47 s). Pre toga se ceo video uveća dok traka ne pokrije ekran,
// pa se ivice ne vide, a dva uvećanja deluju kao jedan pokret.
const ZUM_OD = 1.0
const ZUM_TRAJE = 0.45

export default function IntroAnimacija() {
  const [faza, setFaza] = useState<'pusta' | 'nestaje' | 'gotovo'>('pusta')
  const [zum, setZum] = useState(1)
  const video = useRef<HTMLVideoElement>(null)
  const zatvoren = useRef(false)

  const zavrsi = useCallback(() => {
    if (zatvoren.current) return
    zatvoren.current = true
    setFaza('nestaje')
    setTimeout(() => setFaza('gotovo'), 300)
  }, [])

  useEffect(() => {
    const v = video.current
    if (!v) return
    let rafId = 0
    const prati = () => {
      if (v.currentTime >= ZUM_OD) {
        // Koliko puta je ekran viši od trake u kojoj je video.
        setZum(Math.max(1, window.innerHeight / (window.innerWidth * 9 / 16)))
        return
      }
      rafId = requestAnimationFrame(prati)
    }
    rafId = requestAnimationFrame(prati)
    return () => cancelAnimationFrame(rafId)
  }, [])

  if (faza === 'gotovo') return null

  return (
    <div
      onClick={() => zavrsi()}
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#fdfdfd] transition-opacity duration-300 lg:hidden"
      style={{ opacity: faza === 'nestaje' ? 0 : 1 }}
    >
      <video
        ref={video}
        src={VIDEO}
        autoPlay
        muted
        playsInline
        onEnded={() => zavrsi()}
        onError={() => zavrsi()}
        className="h-full w-full object-contain"
        style={{ transform: `scale(${zum})`, transition: `transform ${ZUM_TRAJE}s ease-in` }}
      />
    </div>
  )
}

// Računar: v3, krugovi -> kalendar -> logo i natpis "FON Raspored" (2,65 s).
// Video ima pravu providnost (WebM, VP9 sa alfom) i već je isečen na deo u
// kome se sve dešava. KRAJ je gotov logo sa natpisom, u udelima kadra: mesto
// na strani je te veličine, a ceo kadar viri preko ivica (krugovi su na
// početku veći od gotovog logoa).
const NASLOV_VIDEO = '/logo-naslov-animacija.webm'
const W = 640
const H = 248
const KRAJ = { x: 0.0125, y: 0.3145, w: 0.9766, h: 0.3952 }
// U tamnoj temi tamnoplavi natpis i obrisi postaju tirkizni, kao naslov
// (dark:text-[#60c3ad]), inače se ne vide na tamnoj pozadini.
const TIRKIZNA = [96, 195, 173]

// Visina gotovog logoa sa natpisom (kao h-11 naslova).
const VISINA = 44

// Prvi kadar je uglavnom providan (krugovi zauzimaju mali deo). Ako je više
// od ovoga puno, browser ne daje pravu providnost ili prave piksele (Safari
// ne zna alfu u WebM-u, zaštita od praćenja preko canvas-a), pa se umesto
// animacije prikazuje rezerva.
const NAJVISE_PUNO = 0.5
// Ako za ovoliko nijedan kadar nije nacrtan (video ne može da krene), isto.
const CEKANJE_MS = 3000

// Video se crta u canvas, a ne prikazuje direktno: tako se u tamnoj temi
// natpis preboji, a prvi kadar proveri pre nego što se išta vidi.
export function NaslovAnimacija({ className = '', rezerva }: { className?: string; rezerva: ReactNode }) {
  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [radi, setRadi] = useState(true)

  useEffect(() => {
    const v = video.current
    const ctx = canvas.current?.getContext('2d', { willReadFrequently: true })
    if (!v || !ctx) return
    let rafId = 0
    let provereno = false
    const odustani = () => setRadi(false)
    const tajmer = setTimeout(() => { if (!provereno) odustani() }, CEKANJE_MS)
    const crtaj = () => {
      // Pre prvog kadra drawImage ne nacrta ništa, pa nema šta da se proveri.
      if (v.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !v.videoWidth) return
      const tamno = document.documentElement.classList.contains('dark')
      ctx.clearRect(0, 0, W, H)
      ctx.drawImage(v, 0, 0, W, H)
      if (provereno && !tamno) return
      let slika: ImageData
      try { slika = ctx.getImageData(0, 0, W, H) } catch { odustani(); return }
      const d = slika.data
      let puni = 0
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 128) puni++
        if (tamno && d[i] < 60 && d[i + 1] < 120 && d[i + 2] < 170) {
          d[i] = TIRKIZNA[0]; d[i + 1] = TIRKIZNA[1]; d[i + 2] = TIRKIZNA[2]
        }
      }
      if (!provereno) {
        provereno = true
        if (puni / (W * H) > NAJVISE_PUNO) { odustani(); return }
      }
      if (tamno) ctx.putImageData(slika, 0, 0)
    }
    // Petlja crta dok video ide; posle kraja ostaje poslednji kadar.
    const petlja = () => {
      crtaj()
      if (!v.paused && !v.ended) rafId = requestAnimationFrame(petlja)
    }
    // Pušta se iz koda, ne preko autoPlay: Chrome sam pauzira prigušen video
    // koji se ne vidi, a ovaj je skriven jer se vidi samo canvas.
    const kreni = () => {
      v.muted = true
      v.play().catch(() => crtaj())
    }
    // Promena teme posle kraja: poslednji kadar se preboji.
    const tema = new MutationObserver(crtaj)
    tema.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    v.addEventListener('playing', petlja)
    v.addEventListener('error', odustani)
    if (v.readyState >= 1) kreni()
    else v.addEventListener('loadedmetadata', kreni, { once: true })
    return () => {
      clearTimeout(tajmer)
      cancelAnimationFrame(rafId)
      tema.disconnect()
      v.pause()
      v.removeEventListener('playing', petlja)
      v.removeEventListener('loadedmetadata', kreni)
      v.removeEventListener('error', odustani)
    }
  }, [])

  if (!radi) return rezerva
  return (
    // Ispod se ostavlja mesto koliko krugovi na početku vire ispod gotovog
    // logoa, da ne pređu preko podnaslova; gore viri u prazan prostor kartice.
    <span
      className={`relative shrink-0 ${className}`}
      style={{
        height: VISINA,
        aspectRatio: `${(KRAJ.w * W) / (KRAJ.h * H)}`,
        marginBottom: ((1 - KRAJ.y - KRAJ.h) / KRAJ.h) * VISINA,
      }}
    >
      <video ref={video} src={NASLOV_VIDEO} muted playsInline preload="auto" aria-hidden="true" className="pointer-events-none absolute size-px opacity-0" />
      <canvas
        ref={canvas}
        width={W}
        height={H}
        aria-hidden="true"
        className="pointer-events-none absolute max-w-none"
        style={{
          left: `${(-KRAJ.x / KRAJ.w) * 100}%`,
          top: `${(-KRAJ.y / KRAJ.h) * 100}%`,
          width: `${(1 / KRAJ.w) * 100}%`,
          height: `${(1 / KRAJ.h) * 100}%`,
        }}
      />
    </span>
  )
}
