// Ikonice koje se koriste na više strana; ista ikonica svuda znači isto.
// Stil kao ostale u aplikaciji: obris 1.75, zaobljeni krajevi.

type IconProps = React.SVGProps<SVGSVGElement>

const baseIcon = (props: IconProps) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
})

// Precrtano oko: sakriven termin (sakrij, skriveni termini).
export const IconHidden = (p: IconProps) => (
  <svg {...baseIcon(p)}>
    <path d="M10.7 5.1A10.7 10.7 0 0 1 21.9 11.7a1 1 0 0 1 0 .7 10.7 10.7 0 0 1-1.4 2.5" />
    <path d="M14.1 14.2a3 3 0 0 1-4.2-4.2" />
    <path d="M17.5 17.5A10.7 10.7 0 0 1 2.1 12.3a1 1 0 0 1 0-.7 10.8 10.8 0 0 1 4.4-5.1" />
    <path d="m2 2 20 20" />
  </svg>
)

// Fioka sa strelicom: izvoz (slika, kalendar).
export const IconIzvoz = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M12 3v12M7.5 10.5 12 15l4.5-4.5" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
)

export const IconImage = (p: IconProps) => (
  <svg {...baseIcon(p)}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-4.5-4.5L5 21" /></svg>
)

// Kalendar sa strelicom nadole: izvoz u kalendar telefona (.ics).
export const IconCalendarExport = (p: IconProps) => (
  <svg {...baseIcon(p)}>
    <path d="M21 11V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" />
    <path d="M16 2v4M8 2v4M3 10h18" />
    <path d="M17 14v6M14.5 17.5 17 20l2.5-2.5" />
  </svg>
)

// Tabovi aplikacije (donji meni na telefonu, prekidač na računaru).
export const IconSchedule = (p: IconProps) => (
  <svg {...baseIcon(p)}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4M7.5 13h4M7.5 17h7" /></svg>
)
export const IconEdit = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
)
export const IconExam = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" /></svg>
)
