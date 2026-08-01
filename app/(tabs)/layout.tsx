import BottomNav from '@/components/BottomNav'
import FirstRunOverlays from '@/components/FirstRunOverlays'

export default function TabsLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      {children}
      <BottomNav />
      <FirstRunOverlays />
    </>
  )
}
