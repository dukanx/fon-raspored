import PageTransition from '@/components/PageTransition'

// Prelaz između ruta najvišeg nivoa (/, /izborni, /deli, tabovi). Samo
// opacity, jer omotač obuhvata i donji meni tabova (v. PageTransition).
export default function RootTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition variant="fade">{children}</PageTransition>
}
