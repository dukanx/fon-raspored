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
