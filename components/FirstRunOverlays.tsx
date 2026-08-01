'use client'

import { useEffect, useState } from 'react'
import NotificationIntro from './NotificationIntro'

// TODO(tutorial): Tutorial.tsx (story-carousel walkthrough) je izgrađen ali
// namerno ISKLJUČEN — slike unutar slajda (flex-1 + object-contain) su
// ispale minijaturne/kvadratne na iPhone 14 Pro PWA umesto da lepo popune
// prostor. Probano i odbačeno: fiksni aspect-ratio (3/5 seklo popup odozgo,
// 4/5 i 2/3 sekli dno slike), flex-1+min-h floor (slika mala, centrirana u
// kvadratu). Sledeći pokušaj bi verovatno trebalo da meri stvarni dostupan
// prostor (ResizeObserver / JS) umesto da se oslanja na CSS aspect-ratio ili
// flex da sam nađe pravu visinu — ili potpuno drugačiji layout (npr. slika
// kao pozadina cele kartice sa tekstom preko, umesto slike u posebnom boxu).
// Kod (SLIDES, screenshot-ovi u public/tutorial/, FirstRunOverlays sekvenca)
// ostaje netaknut za kasnije, samo se ne montira.
//
// import Tutorial from './Tutorial'

type Stage = 'loading' | 'notif'

export default function FirstRunOverlays() {
  const [stage, setStage] = useState<Stage>('loading')

  useEffect(() => {
    // queueMicrotask: izbegava setState sinhrono u efektu (react-hooks pravilo).
    queueMicrotask(() => setStage('notif'))
  }, [])

  if (stage === 'loading') return null
  return <NotificationIntro />
}
