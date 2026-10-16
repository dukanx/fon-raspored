const SR_MONTHS_SHORT = [
  'jan', 'feb', 'mar', 'apr', 'maj', 'jun',
  'jul', 'avg', 'sep', 'okt', 'nov', 'dec',
]

// ISO datum ("2026-06-05") u kratak srpski oblik ("5. jun").
export function formatDateSr(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${d.getDate()}. ${SR_MONTHS_SHORT[d.getMonth()]}`
}

export const SR_MONTHS = [
  'januar', 'februar', 'mart', 'april', 'maj', 'jun',
  'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar',
]
// Od ponedeljka, kao u kalendaru.
export const SR_DAYS_SHORT = ['pon', 'uto', 'sre', 'čet', 'pet', 'sub', 'ned']

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Kratak naziv dana za ISO datum ("2026-06-05" -> "pet").
export function getDaySr(iso: string): string {
  return SR_DAYS_SHORT[(new Date(iso + 'T00:00:00').getDay() + 6) % 7]
}
