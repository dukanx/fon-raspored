// Grupe kojima se raspored nastave promenio između dve objave, za ciljane
// notifikacije (notify-nastava.yml). Ispisuje "godina:grupa" razdvojeno
// razmakom, npr. "3:C13 3:C14".
//
//   npx vite-node scripts/izmenjene-grupe.ts <folder sa prethodnim {1..4}god.json>

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SemesterData } from '../lib/types'
import { izmenjeneGrupe } from '../lib/izmene'

const staroDir = process.argv[2]
const ucitaj = (fajl: string): SemesterData => JSON.parse(readFileSync(fajl, 'utf8'))
const prazan: SemesterData = { semester: '', year: 0, groups: {}, entries: [] }

const out: string[] = []
for (const y of [1, 2, 3, 4]) {
  const staro = join(staroDir, `${y}god.json`)
  const grupe = izmenjeneGrupe(existsSync(staro) ? ucitaj(staro) : prazan, ucitaj(`public/data/${y}god.json`))
  out.push(...grupe.map(g => `${y}:${g}`))
}
console.log(out.join(' '))
