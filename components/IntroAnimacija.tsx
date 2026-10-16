'use client'

// Animacija logoa: FON-ovi krugovi se sklope u kalendar. Telefon: kratka
// (v2, 2,5 s) preko cele aplikacije pri ulasku, dodir preskače. Računar: v3,
// sa natpisom, umesto logoa i naslova na početnoj.
import { useEffect, useRef, useState, type ReactNode } from 'react'

const VIDEO = '/logo-animacija.mp4' // telefon, splash

export default function IntroAnimacija() {
  const [faza, setFaza] = useState<'pusta' | 'nestaje' | 'gotovo'>('pusta')
  if (faza === 'gotovo') return null

  const zavrsi = () => {
    if (faza !== 'pusta') return
    setFaza('nestaje')
    setTimeout(() => setFaza('gotovo'), 300)
  }

  return (
    <div
      onClick={zavrsi}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-white transition-opacity duration-300 lg:hidden"
      style={{ opacity: faza === 'nestaje' ? 0 : 1 }}
    >
      <video
        src={VIDEO}
        autoPlay
        muted
        playsInline
        onEnded={zavrsi}
        onError={zavrsi}
        className="h-full w-full object-contain"
      />
    </div>
  )
}

// Računar: v3, krugovi -> kalendar -> logo i natpis "FON Raspored" (3 s).
// Udeli kadra (16:9): ISECAK je deo u kome se sve dešava (krugovi su na
// početku veći od gotovog logoa), KRAJ je gotov logo sa natpisom. Mesto na
// strani je veličine KRAJ, a canvas sa ISECAK-om viri preko ivica.
const NASLOV_VIDEO = '/logo-naslov-animacija.mp4'
const ISECAK = { x: 0.11, y: 0.2, w: 0.77, h: 0.6 }
const KRAJ = { x: 0.117, y: 0.35, w: 0.755, h: 0.3 }
const W = 300
const H = Math.round(W * (ISECAK.h * 9) / (ISECAK.w * 16))
// U tamnoj temi tamnoplavi natpis i obrisi postaju tirkizni, kao naslov
// (dark:text-[#60c3ad]), inače se ne vide na tamnoj pozadini.
const TIRKIZNA = [96, 195, 173]

// Visina gotovog logoa sa natpisom (kao h-11 naslova).
const VISINA = 44

// Kadar sa gotovim logoom je uglavnom bela pozadina, pa posle brisanja
// ostaje mali deo neprovidnih piksela (izmereno ~15%). Više od ovoga znači
// da browser ne daje prave piksele (zaštita od praćenja preko canvas-a,
// video koji se dekodira u crno), pa se umesto animacije prikazuje rezerva.
const NAJVISE_PUNO = 0.5
// Ako za ovoliko nijedan kadar nije nacrtan (video ne može da krene), isto.
const CEKANJE_MS = 3000

// Video se crta u canvas, a bela pozadina se briše piksel po piksel. Providno
// postaje samo ono što je skoro belo (pozadina sa šumom kompresije); boje
// ostaju pune, pa se vide i na tamnoj pozadini.
export function NaslovAnimacija({ className = '', rezerva }: { className?: string; rezerva: ReactNode }) {
  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [radi, setRadi] = useState(true)

  useEffect(() => {
    const v = video.current
    const ctx = canvas.current?.getContext('2d', { willReadFrequently: true })
    if (!v || !ctx) return
    let rafId = 0
    let nacrtano = false
    const odustani = () => setRadi(false)
    const tajmer = setTimeout(() => { if (!nacrtano) odustani() }, CEKANJE_MS)
    const crtaj = () => {
      // Pre prvog kadra drawImage ne nacrta ništa, a providno crni pikseli bi
      // posle brisanja bele postali puni crni pravougaonik.
      if (v.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !v.videoWidth) return
      const vw = v.videoWidth, vh = v.videoHeight
      const tamno = document.documentElement.classList.contains('dark')
      ctx.clearRect(0, 0, W, H)
      ctx.drawImage(v, ISECAK.x * vw, ISECAK.y * vh, ISECAK.w * vw, ISECAK.h * vh, 0, 0, W, H)
      let slika: ImageData
      try { slika = ctx.getImageData(0, 0, W, H) } catch { odustani(); return }
      const d = slika.data
      let puni = 0
      for (let i = 0; i < d.length; i += 4) {
        // Pozadina videa sa šumom kompresije ide do ~240 (izmereno), pa je
        // sve svetlije od 236 providno, a do 206 se postepeno puni.
        const a = Math.min(1, Math.max(0, (236 - Math.min(d[i], d[i + 1], d[i + 2])) / 30))
        if (a === 0) { d[i + 3] = 0; continue }
        for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, 255 - (255 - d[i + k]) / a)
        if (tamno && d[i] < 60 && d[i + 1] < 120 && d[i + 2] < 170) {
          d[i] = TIRKIZNA[0]; d[i + 1] = TIRKIZNA[1]; d[i + 2] = TIRKIZNA[2]
        }
        d[i + 3] = Math.round(a * 255)
        puni++
      }
      if (!nacrtano) {
        nacrtano = true
        if (puni / (W * H) > NAJVISE_PUNO) { odustani(); return }
      }
      ctx.putImageData(slika, 0, 0)
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
        aspectRatio: `${(KRAJ.w * 16) / (KRAJ.h * 9)}`,
        marginBottom: ((ISECAK.y + ISECAK.h - KRAJ.y - KRAJ.h) / KRAJ.h) * VISINA,
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
          left: `${((ISECAK.x - KRAJ.x) / KRAJ.w) * 100}%`,
          top: `${((ISECAK.y - KRAJ.y) / KRAJ.h) * 100}%`,
          width: `${(ISECAK.w / KRAJ.w) * 100}%`,
          height: `${(ISECAK.h / KRAJ.h) * 100}%`,
        }}
      />
    </span>
  )
}
