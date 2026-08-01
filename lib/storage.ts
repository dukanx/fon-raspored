// Jedan izvor istine za sve `fon_*` ključeve u local/sessionStorage.
//
// Zašto: ključevi su ranije bili razbacani kao template-literali po više fajlova
// (raspored, rokovi, izborni, semester, providers…), pa su lako nastajale
// nesinhronizacije (npr. reset na promenu semestra koji promaši neki ključ).
// Ovde su definisani jednom, sa tipovima i SSR-safe pristupom.
//
// Konvencija:
//   - session.*  -> sessionStorage (traje koliko i tab)
//   - saved.*    -> localStorage (preživljava zatvaranje taba)
//   - byGroup.*  -> localStorage, ključ sufiksovan grupom
//   - note()     -> localStorage, ključ sufiksovan predmetom
import type { ScheduleEntry, RokEntry, CustomRokEntry } from './types'

type Kind = 'local' | 'session'

function backend(kind: Kind): Storage | null {
  if (typeof window === 'undefined') return null
  return kind === 'local' ? window.localStorage : window.sessionStorage
}

function getStr(kind: Kind, key: string): string | null {
  return backend(kind)?.getItem(key) ?? null
}

function setStr(kind: Kind, key: string, value: string): void {
  backend(kind)?.setItem(key, value)
}

function removeKey(kind: Kind, key: string): void {
  backend(kind)?.removeItem(key)
}

function getJSON<T>(kind: Kind, key: string, fallback: T): T {
  const raw = backend(kind)?.getItem(key)
  if (raw == null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function setJSON<T>(kind: Kind, key: string, value: T): void {
  backend(kind)?.setItem(key, JSON.stringify(value))
}

// ---- Accessori (get/set/remove nad jednim ključem) ----

export type StrAccessor = { get(): string | null; set(v: string): void; remove(): void }
export type JsonAccessor<T> = { get(): T; set(v: T): void; remove(): void }
export type FlagAccessor = { get(): boolean; set(): void; remove(): void }

function str(kind: Kind, key: string): StrAccessor {
  return {
    get: () => getStr(kind, key),
    set: (v) => setStr(kind, key, v),
    remove: () => removeKey(kind, key),
  }
}

function json<T>(kind: Kind, key: string, fallback: T): JsonAccessor<T> {
  return {
    get: () => getJSON(kind, key, fallback),
    set: (v) => setJSON(kind, key, v),
    remove: () => removeKey(kind, key),
  }
}

// Boolean flag koji se čuva kao '1' (ili odsutan). Npr. odbačen baner prijave.
function flag(kind: Kind, key: string): FlagAccessor {
  return {
    get: () => getStr(kind, key) === '1',
    set: () => setStr(kind, key, '1'),
    remove: () => removeKey(kind, key),
  }
}

// ---- Javni API ----

// Aktivna sesija (jedan tab). Onboarding upisuje ove; strane ih čitaju.
export const session = {
  group: str('session', 'fon_group'),
  year: str('session', 'fon_year'),
  lastName: str('session', 'fon_lastName'),
  program: str('session', 'fon_program'),
  semester: str('session', 'fon_semester'),
  dismissedPrijava: (rok: string) => flag('session', `fon_dismissed_prijava_${rok}`),
}

// Trajni „zapamćeni" podaci — vraćaju korisnika u raspored bez ponovnog onboardinga.
export const saved = {
  group: str('local', 'fon_saved_group'),
  year: str('local', 'fon_saved_year'),
  program: str('local', 'fon_saved_program'),
  lastName: str('local', 'fon_saved_lastName'),
  semester: str('local', 'fon_saved_semester'),
}

// Globalno stanje aplikacije (nije vezano za grupu).
export const app = {
  theme: str('local', 'fon_theme'),
  flipPending: str('local', 'fon_flip_pending'),
  subjectsHistory: json<Record<string, string[]>>('local', 'fon_subjects_history', {}),
  // Prvi-put modal za notifikacije prikazan (upisuje se čim se pokaže, jednom).
  notifIntroSeen: flag('local', 'fon_notif_intro_seen'),
  // Prvi-put tutorial (feature walkthrough) prikazan ili preskočen, jednom.
  tutorialSeen: flag('local', 'fon_tutorial_seen'),
}

// Stanje vezano za konkretnu grupu (izbor predmeta, izmene, skriveni termini…).
export const byGroup = {
  subjects: (g: string) => json<Record<string, boolean>>('local', `fon_subjects_${g}`, {}),
  extra: (g: string) => json<ScheduleEntry[]>('local', `fon_extra_${g}`, []),
  hidden: (g: string) => json<ScheduleEntry[]>('local', `fon_hidden_${g}`, []),
  otherSem: (g: string) => json<string[]>('local', `fon_other_sem_${g}`, []),
  prevSubjects: (g: string) =>
    json<{ year: number; subject: string }[]>('local', `fon_prev_subjects_${g}`, []),
  rokHidden: (tab: string, g: string) =>
    json<RokEntry[]>('local', `fon_rok_hidden_${tab}_${g}`, []),
  // Korisnikovi sopstveni unosi u rokovi kalendar (nisu sa FON sajta).
  customRokovi: (g: string) =>
    json<CustomRokEntry[]>('local', `fon_custom_rok_${g}`, []),
}

// Lična beleška po predmetu.
export const note = (subject: string): StrAccessor => str('local', `fon_note_${subject}`)

// Reset izbora predmeta na promenu semestra — kredencijali (saved.*) ostaju.
// Isti skup ključeva koji briše lib/semester.ts pri prevrtanju semestra.
export function resetSubjectsForNewSemester(group: string): void {
  byGroup.subjects(group).remove()
  byGroup.otherSem(group).remove()
}
