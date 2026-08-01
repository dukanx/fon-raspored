'use client'

import { useEffect, useState } from 'react'
import { app } from '@/lib/storage'
import Tutorial from './Tutorial'
import NotificationIntro from './NotificationIntro'

type Stage = 'loading' | 'tutorial' | 'notif'

// Redosled prvi-put overlay-a: tutorial (feature walkthrough) pa tek onda
// notifikacije, da se dva modala nikad ne prikažu jedan preko drugog.
// NotificationIntro se montira tek kad je tutorial gotov/preskočen — tako
// njegov effect (async provera pretplate) krene u pravom trenutku.
//
// Tutorial je mobile-only (isti sm breakpoint kao ostatak app-a) — na
// desktopu nema smisla, pa se tamo ni ne označava kao viđen (i dalje će
// iskočiti ako korisnik kasnije otvori app na telefonu).
export default function FirstRunOverlays() {
  const [stage, setStage] = useState<Stage>('loading')

  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 639px)').matches
    const seen = app.tutorialSeen.get()
    // queueMicrotask: izbegava setState sinhrono u efektu (react-hooks pravilo).
    queueMicrotask(() => setStage(!isMobile || seen ? 'notif' : 'tutorial'))
  }, [])

  if (stage === 'loading') return null
  if (stage === 'tutorial') {
    return (
      <Tutorial
        onDone={() => {
          app.tutorialSeen.set()
          setStage('notif')
        }}
      />
    )
  }
  return <NotificationIntro />
}
