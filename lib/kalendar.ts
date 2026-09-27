// lib/kalendar.ts
//
// FON kalendar aktivnosti (public/data/kalendar.json, pravi ga
// scripts/scrape_kalendar.py): za svaki dan školske godine vrsta dana i
// ponekad napomena ("Onlajn nastava", "Januarski ispitni rok"). Kalendar u
// Rokovima od toga boji dane.

export type DayKind = 'nastava' | 'neradni' | 'bez_nastave' | 'ispitni_rok' | 'kolokvijumi'

export interface CalendarDay {
  tip: DayKind
  napomena?: string
}

export interface ActivityCalendar {
  skolska_godina: string
  dani: Record<string, CalendarDay>
}

// Blage nijanse, da se predmeti na danu i dalje jasno vide. Obični nastavni
// dan nema boju, inače bi ceo kalendar bio šaren.
export const DAY_KIND_STYLE: Record<Exclude<DayKind, 'nastava'>, { cell: string; dot: string; label: string }> = {
  ispitni_rok: {
    cell: 'bg-amber-100/80 dark:bg-amber-400/15',
    dot: 'bg-amber-300 dark:bg-amber-400/60',
    label: 'Ispitni rok',
  },
  kolokvijumi: {
    cell: 'bg-sky-100/80 dark:bg-sky-400/15',
    dot: 'bg-sky-300 dark:bg-sky-400/60',
    label: 'Kolokvijumska nedelja',
  },
  neradni: {
    cell: 'bg-gray-200/50 dark:bg-white/[0.06]',
    dot: 'bg-gray-300 dark:bg-gray-600',
    label: 'Neradni dan',
  },
  bez_nastave: {
    cell: 'bg-rose-100/60 dark:bg-rose-400/10',
    dot: 'bg-rose-200 dark:bg-rose-400/50',
    label: 'Bez nastave',
  },
}

export function dayStyle(day: CalendarDay | undefined) {
  return day && day.tip !== 'nastava' ? DAY_KIND_STYLE[day.tip] : null
}

// Kratka oznaka na samom danu, samo za napomene koje menjaju gde se nastava
// drži. Ostale napomene (npr. naziv roka) su u tooltip-u.
export function dayBadge(day: CalendarDay | undefined): string | null {
  return day?.napomena?.toLowerCase().includes('onlajn') ? 'onlajn' : null
}
