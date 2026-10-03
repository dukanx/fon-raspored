'use client'

import type { ScheduleEntry } from '@/lib/types'
import { DAYS, DAY_SHORT, SLOTS, subjectInitials } from '@/lib/schedule'

// Mala nedelja za Izmenu: trenutni raspored (sivo), izabrani termini (u boji
// aplikacije) i preklapanja (crveno). Da se odmah vidi gde novi termin staje,
// bez odlaska na Raspored. Isti dani i termini kao grid na Rasporedu.
export default function MiniWeek({ current, picks }: { current: ScheduleEntry[]; picks: ScheduleEntry[] }) {
  // Termini sa FON-ovim početkom; neobičan početak (ako ga ima) dobija svoj red.
  const starts = [...new Set([...SLOTS, ...current.map(e => e.start), ...picks.map(e => e.start)])].sort()

  return (
    <div>
      <div className="grid grid-cols-[30px_repeat(5,minmax(0,1fr))] gap-1">
        <div />
        {DAYS.map(day => (
          <div key={day} className="pb-0.5 text-center text-[10px] font-medium text-gray-400 dark:text-gray-500">
            {DAY_SHORT[day]}
          </div>
        ))}
        {starts.map(start => (
          <Row key={start} start={start} current={current} picks={picks} />
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-[#024c7d] dark:bg-[#60c3ad]" />Novi termin
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-red-500" />Preklapanje
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-gray-300 dark:bg-gray-600" />Tvoj raspored
        </span>
      </div>
    </div>
  )
}

function Row({ start, current, picks }: { start: string; current: ScheduleEntry[]; picks: ScheduleEntry[] }) {
  return (
    <>
      <div className="flex items-center justify-end pr-1 text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
        {start}
      </div>
      {DAYS.map(day => {
        const here = picks.filter(e => e.day === day && e.start === start)
        // Isti termin koji je već dodat ranije nije preklapanje sa samim sobom.
        const existing = current.find(e =>
          e.day === day && e.start === start &&
          !here.some(p => e.subject === p.subject && e.type_short === p.type_short)
        )
        if (here.length > 0) {
          // Crveno kad novi termin gazi postojeći, ili kad su predavanje i vežbe
          // izabrani u istom terminu.
          const conflict = !!existing || here.length > 1
          const title = here.map(e => `${e.subject} [${e.type_short}]`).join(' + ')
            + (existing ? ` - menja ${existing.subject}` : '')
          return (
            <div
              key={day}
              title={title}
              className={`flex h-8 flex-col items-center justify-center rounded-md text-[10px] font-semibold leading-tight ${
                conflict
                  ? 'bg-red-500 text-white ring-2 ring-red-500/30'
                  : 'bg-[#024c7d] text-white ring-2 ring-[#024c7d]/25 dark:bg-[#60c3ad] dark:text-[#024c7d] dark:ring-[#60c3ad]/30'
              }`}
            >
              <span>{subjectInitials(here[0].subject)}</span>
              <span className="text-[8px] font-medium opacity-80">{here.map(e => e.type_short).join('+')}</span>
            </div>
          )
        }
        if (existing) {
          return (
            <div
              key={day}
              title={`${existing.subject} [${existing.type_short}]`}
              className="flex h-8 items-center justify-center rounded-md bg-gray-200/80 text-[9px] font-medium text-gray-500 dark:bg-white/10 dark:text-gray-400"
            >
              {subjectInitials(existing.subject)}
            </div>
          )
        }
        return <div key={day} className="h-8 rounded-md bg-gray-100/60 dark:bg-white/[0.03]" />
      })}
    </>
  )
}
