'use client'

import { useState } from 'react'
import type { ScheduleEntry } from '@/lib/types'
import { DAYS, DAY_SHORT, SLOTS, SLOT_LABEL, entryKey, subjectInitials } from '@/lib/schedule'
import { novTermin, type NovoMesto, type PomerenTermin } from '@/lib/pomereniTermini'
import Modal from '@/components/Modal'
import { IconClose } from '@/components/Ikone'

const GLASS = 'liquid-glass'

// Novo vreme i sala termina, npr. kad profesor javi izmenu na Teams-u. `od` je
// FON-ov termin ako je ovaj već pomeren. `zauzeti` su ostali vidljivi termini:
// zauzet blok se samo označi, jer čas stvarno može da se pomeri preko drugog.
function Forma({ termin, od, zauzeti, onSave, onClose }: {
  termin: ScheduleEntry
  od?: ScheduleEntry
  zauzeti: ScheduleEntry[]
  onSave: (novo: NovoMesto) => void
  onClose: () => void
}) {
  const [day, setDay] = useState(termin.day)
  const [start, setStart] = useState(termin.start)
  const [room, setRoom] = useState(termin.room)
  const izbor = (aktivan: boolean) => `py-1.5 rounded-full text-xs font-medium border transition-colors
    ${aktivan
      ? 'bg-[#024c7d] text-white border-[#024c7d] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:border-[#60c3ad]'
      : 'bg-white/70 text-gray-600 border-[#024c7d]/25 dark:bg-gray-900/55 dark:text-gray-300 dark:border-white/25'}`
  const labelClass = 'mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400'
  const kraj = (s: string) => SLOT_LABEL[s]?.split('-')[1] ?? termin.end

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Pomeri termin</h3>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">{termin.subject} · {termin.type_short}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Zatvori"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white/70 hover:text-gray-700 dark:hover:bg-gray-800/70 dark:hover:text-gray-100"
        >
          <IconClose className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className={labelClass}>Dan</label>
          <div className="grid grid-cols-5 gap-1.5">
            {DAYS.map(d => (
              <button key={d} type="button" onClick={() => setDay(d)} className={izbor(day === d)}>{DAY_SHORT[d]}</button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass}>Vreme</label>
          <div className="grid grid-cols-3 gap-1.5">
            {SLOTS.map(s => {
              const uBloku = zauzeti.filter(e => e.day === day && e.start === s)
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStart(s)}
                  title={uBloku.map(e => e.subject).join(', ') || undefined}
                  className={`truncate px-1 tabular-nums ${izbor(start === s)}`}
                >
                  {s}{uBloku.length > 0 && ` · ${uBloku.map(e => subjectInitials(e.subject)).join(' · ')}`}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <label className={labelClass}>Sala</label>
          <input
            type="text"
            value={room}
            onChange={e => setRoom(e.target.value)}
            className="w-full min-w-0 h-9 px-3 rounded-xl border border-white/70 dark:border-white/15 text-sm text-gray-900 dark:text-gray-100 bg-white/70 dark:bg-gray-900/65 focus:outline-none focus:ring-2 focus:ring-[#024c7d] dark:focus:ring-[#60c3ad]"
          />
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <button
          onClick={() => onSave({ day, start, end: kraj(start), room: room.trim() })}
          className="btn-lift w-full rounded-xl bg-[#024c7d] py-2.5 text-sm font-medium text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0]"
        >
          Sačuvaj
        </button>
        {od && (
          <button
            onClick={() => onSave({ day: od.day, start: od.start, end: od.end, room: od.room })}
            className={`w-full rounded-xl py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 ${GLASS} hover:bg-white/80 dark:hover:bg-gray-800/70 transition-colors`}
          >
            Vrati na FON-ov: {DAY_SHORT[od.day]} {od.start}, {od.room}
          </button>
        )}
      </div>
    </>
  )
}

// Popup "Pomeri termin", isti sa Rasporeda i iz Izmene. `raspored` su termini
// koje student trenutno vidi.
export default function PomeriTermin({ termin, pomereni, raspored, onSave, onClose }: {
  termin: ScheduleEntry | null
  pomereni: PomerenTermin[]
  raspored: ScheduleEntry[]
  onSave: (termin: ScheduleEntry, novo: NovoMesto) => void
  onClose: () => void
}) {
  return (
    <Modal
      open={!!termin}
      onClose={onClose}
      overlayClassName="z-100 flex items-end justify-center bg-black/40 px-4 py-6 backdrop-blur-sm sm:items-center"
      className={`w-full max-w-sm max-h-full overflow-y-auto rounded-2xl p-5 ring-1 ring-[#024c7d]/15 dark:ring-white/15 ${GLASS}`}
    >
      {termin && (
        <Forma
          key={entryKey(termin)}
          termin={termin}
          od={pomereni.find(p => entryKey(novTermin(p)) === entryKey(termin))?.od}
          zauzeti={raspored.filter(e => entryKey(e) !== entryKey(termin))}
          onSave={novo => onSave(termin, novo)}
          onClose={onClose}
        />
      )}
    </Modal>
  )
}
