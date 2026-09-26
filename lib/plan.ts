// lib/plan.ts
//
// Plan studija po modulima (public/data/plan.json, pravi ga
// scripts/scrape_plan.py). Za dati modul, godinu i semestar kaže da li je
// predmet obavezan ili izborni. Tačnije je od statusa sa stranice predmeta
// (lib/subjects.ts), koji ne zna za modul: tamo piše npr. "Obavezan
// predmet/Izborni predmet", jer je predmet na jednom modulu obavezan, a na
// drugom izborni.

export type SemesterKey = 'zimski' | 'letnji'

export interface SemesterPlan {
  obavezni: string[]
  izborni: string[]
  // Isti izborni predmeti, grupisani po bloku ("Izborni predmet SI 1" -> opcije).
  blokovi?: string[][]
}

export type StudyPlan = Record<
  string,
  { program: string; godine: Record<string, Partial<Record<SemesterKey, SemesterPlan>>> }
>

// Nazivi u rasporedu i u planu se razlikuju u sitnicama: "(NA)" oznaka,
// velika slova, razmaci.
function norm(subject: string): string {
  return subject.toLowerCase().replace(/\(na\)/g, '').replace(/\s+/g, ' ').trim()
}

// "obavezan" | "izborni" za predmet po planu, ili null kad plan ne zna (nema
// modula, godine ili predmeta). `program` je kao u grupi iz god.json: naziv
// modula ("Softversko inženjerstvo"), ili samo "ISiT"/"MiO" kad se grupe još
// ne dele po modulima. Tada se gledaju svi moduli programa, a obavezno je
// samo ono što je obavezno na svakom od njih.
export function planStatus(
  plan: StudyPlan,
  program: string,
  year: number,
  semester: SemesterKey,
  subject: string
): 'obavezan' | 'izborni' | null {
  const sems = semesterPlans(plan, program, year, semester)
  if (sems.length === 0) return null

  const n = norm(subject)
  const has = (list: string[]) => list.some(x => norm(x) === n)
  if (sems.every(s => has(s.obavezni))) return 'obavezan'
  return sems.some(s => has(s.obavezni) || has(s.izborni)) ? 'izborni' : null
}

function semesterPlans(plan: StudyPlan, program: string, year: number, semester: SemesterKey): SemesterPlan[] {
  const modules = plan[program] ? [plan[program]] : Object.values(plan).filter(m => m.program === program)
  return modules
    .map(m => m.godine[String(year)]?.[semester])
    .filter((s): s is SemesterPlan => !!s)
}

// Da li FON još nije objavio raspored nekog izbornog bloka za ovu grupu: blok
// iz plana u kom nijedan predmet nije u rasporedu grupe. Za "ISiT"/"MiO"
// (grupa nije po modulu) važi samo ako takav blok postoji na svakom modulu, da
// razlika između modula ne bi dala lažno upozorenje. Bez plana -> false.
export function hasUnpublishedElectives(
  plan: StudyPlan,
  program: string,
  year: number,
  semester: SemesterKey,
  groupSubjects: string[]
): boolean {
  const sems = semesterPlans(plan, program, year, semester)
  if (sems.length === 0) return false
  const have = new Set(groupSubjects.map(norm))
  const missingBlock = (s: SemesterPlan) =>
    (s.blokovi ?? []).some(block => block.length > 0 && !block.some(o => have.has(norm(o))))
  return sems.every(missingBlock)
}

// "Zimski 2026/27" -> "zimski"
export function semesterKey(semester: string): SemesterKey | null {
  const k = semester.trim().split(/\s+/)[0]?.toLowerCase()
  return k === 'zimski' || k === 'letnji' ? k : null
}
