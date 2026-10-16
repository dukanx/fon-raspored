// Bez React-a, pa ga koristi i serverski app/layout.tsx (skript koji postavi
// temu pre prvog crtanja) i lib/theme.ts.
export type Tema = 'auto' | 'light' | 'dark'

// Bez izbora važi svetla: aplikacija je dizajnirana svetla. 'auto' je opcija.
export const PODRAZUMEVANA_TEMA: Tema = 'light'
