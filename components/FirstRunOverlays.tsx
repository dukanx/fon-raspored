'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import NotificationIntro from './NotificationIntro'
import { osveziPodatkePretplate } from '@/lib/push'

// TODO(tutorial): Tutorial.tsx (story-carousel walkthrough) je izgrađen ali
// namerno ISKLJUČEN - slike unutar slajda (flex-1 + object-contain) su
// ispale minijaturne/kvadratne na iPhone 14 Pro PWA umesto da lepo popune
// prostor. Probano i odbačeno: fiksni aspect-ratio (3/5 seklo popup odozgo,
// 4/5 i 2/3 sekli dno slike), flex-1+min-h floor (slika mala, centrirana u
// kvadratu). Sledeći pokušaj bi verovatno trebalo da meri stvarni dostupan
// prostor (ResizeObserver / JS) umesto da se oslanja na CSS aspect-ratio ili
// flex da sam nađe pravu visinu - ili potpuno drugačiji layout (npr. slika
// kao pozadina cele kartice sa tekstom preko, umesto slike u posebnom boxu).
// Kod (SLIDES, screenshot-ovi u public/tutorial/, FirstRunOverlays sekvenca)
// ostaje netaknut za kasnije, samo se ne montira.
//
// import Tutorial from './Tutorial'

type Stage = 'loading' | 'notif'

export default function FirstRunOverlays() {
  const [stage, setStage] = useState<Stage>('loading')
  const pathname = usePathname()

  useEffect(() => {
    // queueMicrotask: izbegava setState sinhrono u efektu (react-hooks pravilo).
    queueMicrotask(() => setStage('notif'))
  }, [])

  // Montira se na svakom tabu, pa je ovo jedno mesto za sve: backend dobije
  // grupu, predmete i dodate termine pretplate. Ponovo na svaki prelaz taba,
  // jer se predmeti i termini menjaju u Izmeni; šalje se samo kad se promene.
  useEffect(() => {
    osveziPodatkePretplate()
  }, [pathname])

  if (stage === 'loading') return null
  return <NotificationIntro />
}
