// src/lib/semester.ts
//
// Prevrtanje semestra (Letnji <-> Zimski ili nova školska godina).
// Detekcija je po `semester` stringu iz god.json (npr. "Zimski 2026/27"), pa je
// OTPORNA na re-objavu istog semestra (kad FON nedelju dana kasnije izmeni
// raspored — semestar string ostaje isti, nema lažnog flipa).

import { saved as savedStore, app, session, resetSubjectsForNewSemester } from './storage'

// Pomeri sačuvani semestar i resetuj izbor predmeta kad se semestar prevrne.
// Kredencijali (grupa/prezime/smer) i `fon_subjects_history` OSTAJU — istorija
// napaja mešani septembarski/oktobarski rok. Vraća true ako je flip detektovan.
export function reconcileSemester(currentSemester: string, group: string): boolean {
  if (typeof window === 'undefined' || !currentSemester) return false

  const saved = savedStore.semester.get()

  // Prvi put (nema sačuvanog) — samo zabeleži, nije flip.
  if (!saved) {
    savedStore.semester.set(currentSemester)
    return false
  }
  if (saved === currentSemester) return false

  // Flip: obriši izbor predmeta → rokovi/raspored prelaze u fail-open (prikaži
  // sve) dok student ponovo ne izabere. Bezbedno prelazno stanje.
  if (group) resetSubjectsForNewSemester(group)
  savedStore.semester.set(currentSemester)
  session.semester.set(currentSemester)
  // Popup "Nov semestar" ostaje pending dok ga korisnik ne potvrdi (preživi reload).
  app.flipPending.set(currentSemester)
  return true
}

// Da li treba prikazati "Nov semestar — proveri predmete" popup za dati semestar.
export function isFlipPending(currentSemester: string): boolean {
  if (typeof window === 'undefined') return false
  return app.flipPending.get() === currentSemester
}

// Korisnik je potvrdio flip (kliknuo CTA ili zatvorio popup / izabrao predmete).
export function acknowledgeFlip(): void {
  app.flipPending.remove()
}
