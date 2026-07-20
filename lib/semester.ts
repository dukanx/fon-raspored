// src/lib/semester.ts
//
// Prevrtanje semestra (Letnji <-> Zimski ili nova školska godina).
// Detekcija je po `semester` stringu iz god.json (npr. "Zimski 2026/27"), pa je
// OTPORNA na re-objavu istog semestra (kad FON nedelju dana kasnije izmeni
// raspored — semestar string ostaje isti, nema lažnog flipa).

const PENDING_KEY = 'fon_flip_pending'
const SAVED_KEY = 'fon_saved_semester'

// Pomeri sačuvani semestar i resetuj izbor predmeta kad se semestar prevrne.
// Kredencijali (grupa/prezime/smer) i `fon_subjects_history` OSTAJU — istorija
// napaja mešani septembarski/oktobarski rok. Vraća true ako je flip detektovan.
export function reconcileSemester(currentSemester: string, group: string): boolean {
  if (typeof window === 'undefined' || !currentSemester) return false

  const saved = localStorage.getItem(SAVED_KEY)

  // Prvi put (nema sačuvanog) — samo zabeleži, nije flip.
  if (!saved) {
    localStorage.setItem(SAVED_KEY, currentSemester)
    return false
  }
  if (saved === currentSemester) return false

  // Flip: obriši izbor predmeta → rokovi/raspored prelaze u fail-open (prikaži
  // sve) dok student ponovo ne izabere. Bezbedno prelazno stanje.
  if (group) {
    localStorage.removeItem(`fon_subjects_${group}`)
    localStorage.removeItem(`fon_other_sem_${group}`)
  }
  localStorage.setItem(SAVED_KEY, currentSemester)
  sessionStorage.setItem('fon_semester', currentSemester)
  // Popup "Nov semestar" ostaje pending dok ga korisnik ne potvrdi (preživi reload).
  localStorage.setItem(PENDING_KEY, currentSemester)
  return true
}

// Da li treba prikazati "Nov semestar — proveri predmete" popup za dati semestar.
export function isFlipPending(currentSemester: string): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(PENDING_KEY) === currentSemester
}

// Korisnik je potvrdio flip (kliknuo CTA ili zatvorio popup / izabrao predmete).
export function acknowledgeFlip(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(PENDING_KEY)
}
