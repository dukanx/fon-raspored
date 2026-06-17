import BottomNav from '@/components/BottomNav'

export default function TabsLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      {children}
      <BottomNav />
    </>
  )
}
