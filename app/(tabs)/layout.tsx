import BottomNav from '@/components/BottomNav'
import NotificationIntro from '@/components/NotificationIntro'

export default function TabsLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      {children}
      <BottomNav />
      <NotificationIntro />
    </>
  )
}
