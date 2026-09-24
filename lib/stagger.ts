import type { CSSProperties } from 'react'

// Kašnjenje za `anim-up` stavke koje ulaze jedna za drugom. Posle nekoliko
// stavki kašnjenje prestaje da raste, da duge liste ne bi čekale. `offset`
// pomera ceo niz, npr. da krene tek kad roditelj završi svoj ulazak.
export function stagger(i: number, step = 40, max = 8, offset = 0): CSSProperties {
  return { animationDelay: `${offset + Math.min(i, max) * step}ms` }
}
