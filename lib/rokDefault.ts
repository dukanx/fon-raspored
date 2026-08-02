// src/lib/rokDefault.ts
//
// Bira da li aplikacija podrazumevano otvara Raspored (nastava) ili Rokovi
// (ispitni period), na osnovu STVARNIH datuma ispitnih rokova iz rokovi.json
// — ne pretpostavljenog akademskog kalendara (koji bi svake godine drift-ovao).
//
// Susedni rokovi (npr. julski -> septembarski -> oktobarski, sa nedeljama
// pauze između) se spajaju u JEDAN "ispitni period" ako je razmak između njih
// manji od ROK_MERGE_GAP_DAYS — cela letnja sezona ispita je i dalje "nema
// nastave", ne samo nedelje kad se doslovno polaže. Veliki razmak (npr.
// februarski -> junski, ~4 meseca aktivne nastave između) se NE spaja.
//
// Kolokvijumi se namerno ignorišu — dešavaju se USRED semestra (nastava i
// dalje traje), pa ne treba da okinu default na Rokovi.

import type { RokData } from './types'

export const ROK_LEAD_DAYS = 14
export const ROK_MERGE_GAP_DAYS = 45

function daysBetweenUTC(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000
}

// Čisto UTC računanje datuma — new Date(str).setDate() + toISOString() bi
// pomerio dan unazad/unapred u zavisnosti od lokalne vremenske zone (npr. u
// CEST-u ponoć 10. avgusta je 9. avgust u UTC-u).
function subtractDaysUTC(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() - days)
  return dt.toISOString().split('T')[0]
}

export function pickDefaultTab(
  rokovi: RokData[],
  todayStr: string,
  opts?: { leadDays?: number; mergeGapDays?: number }
): '/raspored' | '/rokovi' {
  const leadDays = opts?.leadDays ?? ROK_LEAD_DAYS
  const mergeGapDays = opts?.mergeGapDays ?? ROK_MERGE_GAP_DAYS

  const ranges = rokovi
    .filter(r => r.tip === 'ispit')
    .map(r => {
      const dates = r.entries.map(e => e.date).filter(Boolean).sort()
      return dates.length ? { first: dates[0], last: dates[dates.length - 1] } : null
    })
    .filter((r): r is { first: string; last: string } => r !== null)
    .sort((a, b) => a.first.localeCompare(b.first))

  // Spoji susedne rokove u klastere kad je razmak između njih mali.
  const clusters: { first: string; last: string }[] = []
  for (const r of ranges) {
    const prev = clusters[clusters.length - 1]
    if (prev && daysBetweenUTC(prev.last, r.first) <= mergeGapDays) {
      if (r.last > prev.last) prev.last = r.last
    } else {
      clusters.push({ ...r })
    }
  }

  return clusters.some(c => todayStr >= subtractDaysUTC(c.first, leadDays) && todayStr <= c.last)
    ? '/rokovi'
    : '/raspored'
}
