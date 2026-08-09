import type { Metadata } from 'next'

// Korak onboardinga, nema smisla kao rezultat pretrage (v. app/(tabs)/layout.tsx).
// Postoji samo zato što stranica jeste 'use client' pa ne može sama da izvozi metadata.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function IzborniLayout({ children }: { children: React.ReactNode }) {
  return children
}
