// Deljenje rasporeda putem linka — stateless (ceo payload u URL-u, bez backend-a).
//
// Payload je namerno minimalan: godina + grupa + indeksi čekiranih predmeta.
// Grupa određuje ceo bazni raspored; program/semestar se izvode iz god.json na
// strani primaoca, pa se ne šalju. Beleške/extras se NE dele (lične su).
//
// Predmeti se šalju kao INDEKSI u uniqueSubjectsForGroup(data, g) — istu
// sortiranu listu grade obe strane. `n` (broj predmeta) je zaštita: ako se
// primaocu raspored promenio (drugačiji n), indeksi ne valjaju i /deli pada na
// picker umesto da tiho primeni pogrešan izbor.

export type SharePayload = {
  v: 1
  y: number      // godina studija (1–4)
  g: string      // šifra grupe, npr. "C1"
  n: number      // broj jedinstvenih predmeta grupe (guard protiv drift-a)
  s: number[]    // indeksi čekiranih predmeta u sortiranoj listi
}

function toBase64Url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): string {
  const padded = s.length % 4 === 0 ? s : s + '='.repeat(4 - (s.length % 4))
  return atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
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
  return { v: 1, y: o.y, g: o.g, n: o.n, s: o.s as number[] }
}
