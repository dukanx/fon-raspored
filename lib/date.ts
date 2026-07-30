const SR_MONTHS_SHORT = [
  'jan', 'feb', 'mar', 'apr', 'maj', 'jun',
  'jul', 'avg', 'sep', 'okt', 'nov', 'dec',
]

// ISO datum ("2026-06-05") u kratak srpski oblik ("5. jun").
export function formatDateSr(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${d.getDate()}. ${SR_MONTHS_SHORT[d.getMonth()]}`
}
