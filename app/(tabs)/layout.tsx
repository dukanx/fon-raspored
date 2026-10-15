import type { Metadata } from 'next'
import BottomNav from '@/components/BottomNav'
import FirstRunOverlays from '@/components/FirstRunOverlays'
import InstallBanner from '@/components/InstallBanner'

// Ove rute su personalizovane na klijentu - bez identiteta u localStorage-u
// robot vidi samo preusmerenje na `/`. Kao rezultat pretrage bile bi prazne
// kopije početne, pa se izbacuju iz indeksa. `follow: true` znači da robot i
// dalje prati linkove sa njih, samo ih ne prikazuje kao rezultat.
// Stranice su 'use client' i ne mogu same da izvoze metadata, zato stoji ovde.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function TabsLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      <InstallBanner />
      {children}
      <BottomNav />
      <FirstRunOverlays />
    </>
  )
}
