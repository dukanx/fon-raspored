import type { Metadata } from 'next'

// Deljeni raspored — sadržaj zavisi od koda u URL-u i tiče se jedne osobe.
// Takve adrese ne smeju da završe u pretrazi (v. app/(tabs)/layout.tsx).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function DeliLayout({ children }: { children: React.ReactNode }) {
  return children
}
