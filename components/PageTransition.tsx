'use client'

import { useEffect } from 'react'

// Da li je ovo prvo iscrtavanje aplikacije. Tada nema animacije: strana se
// ionako tek pojavila, a server i klijent moraju da iscrtaju isto. Menja se
// samo u efektu, pa server uvek vidi `true`.
let firstMount = true

// Ulazna animacija strane. Koriste je `template.tsx` fajlovi, koje Next ponovo
// montira pri svakoj navigaciji, pa animacija krene na svaki prelaz.
//
// `fade` je samo opacity. Transform na pretku pomera `position: fixed` decu
// (donji meni, modali) dok animacija traje, pa se koristi tamo gde omotač
// obuhvata i njih.
export default function PageTransition({
  variant,
  children,
}: {
  variant: 'fade' | 'up'
  children: React.ReactNode
}) {
  const animate = !firstMount
  useEffect(() => {
    firstMount = false
  }, [])

  return (
    <div className={`flex flex-1 flex-col ${animate ? `page-in-${variant}` : ''}`}>
      {children}
    </div>
  )
}
