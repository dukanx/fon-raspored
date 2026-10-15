'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Expand from './Expand'
import { InstallSteps } from './InstallPrompt'
import { useInstalacija } from '@/lib/install'
import { app } from '@/lib/storage'

// Posle × baner se ne nameće, ali ni ne nestaje zauvek posle slučajnog tapa.
const SKRIVEN_DANA = 7

function skrivenJos(): boolean {
  const kad = app.installBannerSkriven.get()
  return !!kad && Date.now() - new Date(kad).getTime() < SKRIVEN_DANA * 86_400_000
}

// Traka "Instaliraj aplikaciju" na vrhu tabova, samo u browseru na telefonu
// (nikad u instaliranoj aplikaciji ni na računaru). Android sa sistemskim
// prozorom instalira na dugme; iOS i ostali dobiju uputstvo ispod trake.
export default function InstallBanner() {
  const inst = useInstalacija()
  const [skriven, setSkriven] = useState(true)
  const [uputstvo, setUputstvo] = useState(false)

  useEffect(() => {
    // queueMicrotask: izbegava setState sinhrono u efektu (react-hooks pravilo).
    queueMicrotask(() => setSkriven(skrivenJos()))
  }, [])

  if (!inst.spremno || inst.instalirano || skriven || inst.platforma === 'other') return null

  const odmah = inst.mozeOdmah && !inst.ugradjenBrowser

  const zatvori = () => {
    app.installBannerSkriven.set(new Date().toISOString())
    setSkriven(true)
  }

  const instaliraj = async () => {
    if (!odmah) return setUputstvo(u => !u)
    if (await inst.instaliraj()) setSkriven(true)
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pt-3 sm:px-6">
      <div className="liquid-glass rounded-2xl border border-[#024c7d]/15 dark:border-white/15">
        <div className="flex items-center gap-3 py-2.5 pr-2 pl-3">
          <Image src="/icon-192.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-[10px]" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">FON Raspored</p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">Dodaj na početni ekran</p>
          </div>
          <button
            type="button"
            onClick={instaliraj}
            aria-expanded={odmah ? undefined : uputstvo}
            className="shrink-0 rounded-full bg-[#024c7d] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0]"
          >
            {inst.ugradjenBrowser ? 'Kako?' : 'Instaliraj'}
          </button>
          <button
            type="button"
            onClick={zatvori}
            aria-label="Zatvori"
            className="no-hover-lift flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <Expand open={uputstvo} className="px-4 pb-3">
          <InstallSteps platforma={inst.platforma} ugradjenBrowser={inst.ugradjenBrowser} />
        </Expand>
      </div>
    </div>
  )
}
