// Deljenje rasporeda putem linka — stateless (ceo payload u URL-u, bez backend-a).
//
// Payload je namerno minimalan: godina + grupa + indeksi čekiranih predmeta.
// Grupa određuje ceo bazni raspored; program/semestar se izvode iz god.json na
// strani primaoca, pa se ne šalju. Lične beleške se NE dele.
//
// Predmeti se šalju kao INDEKSI u uniqueSubjectsForGroup(data, g) — istu
// sortiranu listu grade obe strane. `n` (broj predmeta) je zaštita: ako se
// primaocu raspored promenio (drugačiji n), indeksi ne valjaju i /deli pada na
// picker umesto da tiho primeni pogrešan izbor.
//
// x/p/o (preneseni termini / predmeti iz prethodnih godina / drugog semestra)
// su opcioni — pošiljalac bira da li da ih uključi (ako mu ceo raspored zavisi
// od prenesenog predmeta, bez ovoga bi link stigao prazan). Odsutni polje =
// pošiljalac nije uključio, primalac zadržava svoje postojeće vrednosti.

import type { ScheduleEntry } from './types'

export type SharePayload = {
  v: 1
  y: number      // godina studija (1–4)
  g: string      // šifra grupe, npr. "C1"
  n: number      // broj jedinstvenih predmeta grupe (guard protiv drift-a)
  s: number[]    // indeksi čekiranih predmeta u sortiranoj listi
  x?: ScheduleEntry[]                     // preneseni termini (Izmena termina)
  p?: { year: number; subject: string }[] // predmeti iz prethodnih godina
  o?: string[]                            // predmeti iz drugog semestra
}

// btoa/atob rade samo sa Latin1 — nazivi predmeta imaju č/ć/š/đ/ž (van Latin1
// opsega), pa se prvo enkoduje u UTF-8 bajtove.
function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): string {
  const padded = s.length % 4 === 0 ? s : s + '='.repeat(4 - (s.length % 4))
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeShare(p: SharePayload): string {
  return toBase64Url(JSON.stringify(p))
}

// Vraća validan payload ili null (malformirani/nepoznati input se odbacuje).
export function decodeShare(raw: string): SharePayload | null {
  if (!raw) return null
  let obj: unknown
  try {
    obj = JSON.parse(fromBase64Url(raw))
  } catch {
    return null
  }
  if (typeof obj !== 'object' || obj === null) return null
  const o = obj as Record<string, unknown>
  if (o.v !== 1) return null
  if (typeof o.y !== 'number' || !Number.isInteger(o.y)) return null
  if (typeof o.g !== 'string' || !o.g) return null
  if (typeof o.n !== 'number' || !Number.isInteger(o.n) || o.n < 0) return null
  if (!Array.isArray(o.s) || !o.s.every(x => typeof x === 'number' && Number.isInteger(x) && x >= 0)) {
    return null
  }

  const x = Array.isArray(o.x) ? (o.x as ScheduleEntry[]) : undefined
  const p = Array.isArray(o.p)
    ? o.p.filter(
        (e): e is { year: number; subject: string } =>
          typeof e === 'object' && e !== null &&
          typeof (e as Record<string, unknown>).year === 'number' &&
          typeof (e as Record<string, unknown>).subject === 'string'
      )
    : undefined
  const otherSem = Array.isArray(o.o) ? o.o.filter((s): s is string => typeof s === 'string') : undefined

  return {
    v: 1, y: o.y, g: o.g, n: o.n, s: o.s as number[],
    ...(x ? { x } : {}),
    ...(p ? { p } : {}),
    ...(otherSem ? { o: otherSem } : {}),
  }
}
