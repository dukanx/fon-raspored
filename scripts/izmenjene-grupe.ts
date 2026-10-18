// Šta se kojoj grupi promenilo u rasporedu nastave između dve objave, za
// ciljane notifikacije (notify-nastava.yml). Upisuje JSON u <izlaz>:
//   { "3:C13": { "promene": ["Matematika 1|V"], "novi": [] }, ... }
// a ispisuje izmenjene grupe razdvojene razmakom, npr. "3:C13 3:C14".
//
//   npx vite-node scripts/izmenjene-grupe.ts <folder sa prethodnim {1..4}god.json> <izlaz.json>

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SemesterData } from '../lib/types'
import { izmeneGrupa, type IzmenaGrupe } from '../lib/izmene'

const [staroDir, izlaz] = process.argv.slice(2)
const ucitaj = (fajl: string): SemesterData => JSON.parse(readFileSync(fajl, 'utf8'))
const prazan: SemesterData = { semester: '', year: 0, groups: {}, entries: [] }

const out: Record<string, IzmenaGrupe> = {}
for (const y of [1, 2, 3, 4]) {
  const staro = join(staroDir, `${y}god.json`)
  const izmene = izmeneGrupa(existsSync(staro) ? ucitaj(staro) : prazan, ucitaj(`public/data/${y}god.json`))
  for (const [g, izmena] of Object.entries(izmene)) out[`${y}:${g}`] = izmena
}
writeFileSync(izlaz, JSON.stringify(out))
console.log(Object.keys(out).join(' '))
