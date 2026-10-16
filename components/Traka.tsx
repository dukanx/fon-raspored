'use client'

import { useRef, useState } from 'react'
import type { IshodIzvoza } from '@/lib/shareOrDownload'
import Popover, { POPOVER_STAVKA } from './Popover'
import { IconCalendarExport, IconImage, IconIzvoz } from './Ikone'

// Dugmad u traci ispod naslova (Raspored, Rokovi): na telefonu okrugla
// ikonica, na računaru ikonica i naziv. `aktivan` = dugme je uključeno
// (npr. filter koji nešto krije), pa je obojeno.
export const dugmeTrake = (saNazivom: boolean, aktivan = false) => saNazivom
  ? `inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed
     ${aktivan ? 'bg-[#024c7d]/10 text-[#024c7d] dark:bg-[#60c3ad]/15 dark:text-[#60c3ad]' : 'liquid-glass text-gray-600 hover:bg-white/80 dark:text-gray-300 dark:hover:bg-gray-800/70'}`
  : `flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed
     ${aktivan ? 'bg-[#024c7d] text-white dark:bg-[#60c3ad] dark:text-[#024c7d]' : 'liquid-glass text-gray-600 hover:bg-white/80 dark:text-gray-300 dark:hover:bg-gray-800/70'}`

export const ikonaTrake = (saNazivom: boolean) => (saNazivom ? 'h-4 w-4 opacity-80' : 'h-[18px] w-[18px]')

// Slika i kalendar su oba izvoz, pa su jedno dugme sa menijem.
export function IzvozDugme({ saNazivom = false, natpis = 'Izvezi', disabled = false, onSlika, onKalendar }: {
  saNazivom?: boolean
  natpis?: string
  disabled?: boolean
  onSlika: () => void
  onKalendar: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        aria-expanded={open}
        aria-label={natpis}
        className={dugmeTrake(saNazivom)}
      >
        <IconIzvoz className={ikonaTrake(saNazivom)} />
        {saNazivom && natpis}
      </button>
      <Popover open={open} onClose={() => setOpen(false)}>
        <button onClick={() => { setOpen(false); onSlika() }} className={POPOVER_STAVKA}>
          Sačuvaj kao sliku
          <IconImage className="h-4 w-4 opacity-50" />
        </button>
        <button onClick={() => { setOpen(false); onKalendar() }} className={POPOVER_STAVKA}>
          Dodaj u kalendar
          <IconCalendarExport className="h-4 w-4 opacity-50" />
        </button>
      </Popover>
    </div>
  )
}

// Poruka posle izvoza samo kad je fajl preuzet. Kad telefon otvori share ili
// Kalendar, korisnik već vidi šta se desilo, pa potvrda ne treba.
export function useIzvozPoruka() {
  const [poruka, setPoruka] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const javi = (ishod: IshodIzvoza, tekst: string) => {
    if (ishod !== 'preuzeto') return
    setPoruka(tekst)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setPoruka(null), 3500)
  }
  return [poruka, javi] as const
}

export const PORUKA_SLIKA = 'Slika je sačuvana'
export const PORUKA_KALENDAR = 'Otvori preuzeti fajl da dodaš termine u kalendar'
