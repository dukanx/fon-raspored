'use client'

// Animacija logoa: FON-ovi krugovi se sklope u kalendar (2,5 s, bela
// pozadina). Telefon: preko cele aplikacije pri ulasku (dodir preskače).
// Računar: umesto logoa pored naslova na početnoj.
import { useEffect, useRef, useState } from 'react'

const VIDEO = '/logo-animacija.mp4'

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

// Deo kadra u kome se animacija dešava (krugovi su najviši oko 0,5 s, gotov
// kalendar je 34% x 52% kadra, centriran).
const ISECAK = { x: 0.31, y: 0.19, w: 0.38, h: 0.62 }
const W = 120
const H = Math.round(W * (ISECAK.h * 1080) / (ISECAK.w * 1920))

// Video se crta u canvas, a bela pozadina se briše piksel po piksel: koliko je
// piksel daleko od belog, toliko je neproziran, pa radi na svakoj pozadini i u
// tamnoj temi.
export function LogoAnimacija({ className = '' }: { className?: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const v = video.current
    const ctx = canvas.current?.getContext('2d', { willReadFrequently: true })
    if (!v || !ctx) return
    let rafId = 0
    const crtaj = () => {
      if (v.videoWidth) {
        const vw = v.videoWidth, vh = v.videoHeight
        ctx.clearRect(0, 0, W, H)
        ctx.drawImage(v, ISECAK.x * vw, ISECAK.y * vh, ISECAK.w * vw, ISECAK.h * vh, 0, 0, W, H)
        const slika = ctx.getImageData(0, 0, W, H)
        const d = slika.data
        for (let i = 0; i < d.length; i += 4) {
          const a = Math.max(0, ((255 - Math.min(d[i], d[i + 1], d[i + 2])) / 255 - 0.04) / 0.96)
          if (a === 0) { d[i + 3] = 0; continue }
          for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, 255 - (255 - d[i + k]) / a)
          d[i + 3] = Math.round(a * 255)
        }
        ctx.putImageData(slika, 0, 0)
      }
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
    v.addEventListener('playing', petlja)
    v.addEventListener('seeked', crtaj)
    if (v.readyState >= 1) kreni()
    else v.addEventListener('loadedmetadata', kreni, { once: true })
    return () => {
      cancelAnimationFrame(rafId)
      v.pause()
      v.removeEventListener('playing', petlja)
      v.removeEventListener('seeked', crtaj)
      v.removeEventListener('loadedmetadata', kreni)
    }
  }, [])

  return (
    <span className={`relative h-8 w-9 shrink-0 lg:h-11 lg:w-[50px] ${className}`} style={{ top: -3 }}>
      <video ref={video} src={VIDEO} muted playsInline preload="auto" aria-hidden="true" className="pointer-events-none absolute size-px opacity-0" />
      <canvas
        ref={canvas}
        width={W}
        height={H}
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 h-[119%] w-auto max-w-none -translate-x-1/2 -translate-y-1/2"
      />
    </span>
  )
}
