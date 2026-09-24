import PageTransition from '@/components/PageTransition'

// Prelaz između tabova. Omotač je unutar (tabs)/layout.tsx, pa donji meni
// ostaje van njega i ne pomera se.
export default function TabsTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition variant="up">{children}</PageTransition>
}
