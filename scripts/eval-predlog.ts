// Eval predloga termina (Izmena tab): da li AI bira termine bolje od algoritma
// iz lib/predlog.ts, na scenarijima iz pravih podataka.
//
//   npx vite-node scripts/eval-predlog.ts [broj scenarija]
//
// Zove Groq (GROQ_API_KEY iz .env.local). Scenariji su uvek isti (fiksni
// seed), pa se izmene prompta i modela porede brojem.
//
// Rezultat 2026-10-03 (12 scenarija): AI koji bira sam (stara ruta) 3-4/12
// optimalno, AI sa izračunatim činjenicama i strogim JSON-om 4/12 uz 3 kršenja
// pravila, algoritam 12/12. Zato bira algoritam, a AI samo piše razlog.

import { readFileSync } from 'node:fs'
import type { ScheduleEntry, SemesterData } from '../lib/types'
import { getScheduleForGroup } from '../lib/schedule'
import { najboljiPar, ocenaPara, cinjenice, opisSuseda, type Par } from '../lib/predlog'

const N = Number(process.argv[2] ?? 12)
const GROQ_KEY = process.env.GROQ_API_KEY
  ?? readFileSync('.env.local', 'utf8').match(/^GROQ_API_KEY=(.*)$/m)?.[1].trim().replace(/^"|"$/g, '')

// --- scenariji ---------------------------------------------------------------

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Scenario { naziv: string; raspored: ScheduleEntry[]; predavanja: ScheduleEntry[]; vezbe: ScheduleEntry[] }

function scenariji(n: number): Scenario[] {
  const rand = rng(42)
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)]
  const data = (y: number): SemesterData => JSON.parse(readFileSync(`public/data/${y}god.json`, 'utf8'))
  const out: Scenario[] = []
  while (out.length < n) {
    const y = pick([2, 3, 4])
    const d = data(y)
    const group = pick(Object.keys(d.groups))
    const raspored = getScheduleForGroup(d, group)
    const prev = data(pick([...Array(y - 1)].map((_, i) => i + 1)))
    const subject = pick([...new Set(prev.entries.map(e => e.subject))])
    const termini = prev.entries.filter(e => e.subject === subject)
    const predavanja = termini.filter(e => e.type_short === 'P')
    const vezbe = termini.filter(e => e.type_short === 'V')
    if (!raspored.length || !predavanja.length || !vezbe.length) continue
    out.push({ naziv: `${y}. god ${group} + ${subject}`, raspored, predavanja, vezbe })
  }
  return out
}

// --- varijante ---------------------------------------------------------------

const oznaceno = (s: Scenario, opis: (e: ScheduleEntry) => string) => ({
  p: s.predavanja.map((e, i) => `P${i + 1}: ${e.day} ${e.start}-${e.end} Sala ${e.room} ${opis(e)}`).join('\n'),
  v: s.vezbe.map((e, i) => `V${i + 1}: ${e.day} ${e.start}-${e.end} Sala ${e.room} ${opis(e)}`).join('\n'),
})
const iz = (s: Scenario, p: number | null, v: number | null): Par => ({
  p: p ? s.predavanja[p - 1] ?? null : null,
  v: v ? s.vezbe[v - 1] ?? null : null,
})

// AI bira između izračunatih činjenica, odgovor ograničen JSON šemom.
async function aiBira(s: Scenario): Promise<Par> {
  const opis = (e: ScheduleEntry) => {
    const c = cinjenice(e, s.raspored)
    const status = c.menja ? `(PREKLAPANJE: Mora da zameni ${c.menja.subject})` : '(SLOBODNO)'
    return `${status} | ${opisSuseda(c) ?? 'bez suseda'} | pauza +${c.pauzaBlokova * 2} h | ${c.noviDan ? 'novi dan na fakultetu' : 'dan već ima nastavu'}`
  }
  const liste = oznaceno(s, opis)
  const prompt = `Student dodaje predmet "${s.predavanja[0].subject}" u raspored. Uz svaki termin su
TAČNE činjenice (izračunate iz rasporeda) - ne računaj ništa sam, samo biraj.

Predavanja:
${liste.p}

Vežbe:
${liste.v}

Pravila, ovim redom:
1. Slobodan termin pre termina koji menja postojeći.
2. Ako se mora menjati, bolje da se menja predavanje nego vežbe.
3. Manja pauza, pa dan koji već ima nastavu pre novog dana.
4. Bolje vreme: 10:15, 12:15, 08:15, 14:15, 16:15, 18:15.
5. Predavanje i vežbe nikad u istom terminu (isti dan i vreme).
Razlog: jedna bezlična rečenica na srpskom, ekavicom, sa danom i vremenom, bez oznaka.`
  const enumOf = (prefix: string, n: number) => [...Array(n)].map((_, i) => `${prefix}${i + 1}`)
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      reasoning_effort: 'low',
      max_completion_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'predlog',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              predavanje: { type: 'string', enum: enumOf('P', s.predavanja.length) },
              vezbe: { type: 'string', enum: enumOf('V', s.vezbe.length) },
              razlog: { type: 'string' },
            },
            required: ['predavanje', 'vezbe', 'razlog'],
            additionalProperties: false,
          },
        },
      },
    }),
  })
  const d = await res.json()
  const content = d.choices?.[0]?.message?.content
  if (!res.ok || !content) throw new Error(`Groq ${res.status} ${d.error?.message ?? ''}`)
  const j = JSON.parse(content)
  return iz(s, Number(j.predavanje.slice(1)), Number(j.vezbe.slice(1)))
}

async function algoritam(s: Scenario): Promise<Par> {
  return najboljiPar(s.raspored, s.predavanja, s.vezbe)
}

// --- merenje -----------------------------------------------------------------

const same = (a: number[], b: number[]) => a.every((x, i) => x === b[i])

// Redom kao u ocena() iz lib/predlog.ts: prvi kriterijum na kom je izbor lošiji.
const KRITERIJUMI = ['gazi postojeće', 'gazi vežbe', 'pauze i novi dani', 'vreme']
const losijeNa = (a: number[], opt: number[]) => KRITERIJUMI[a.findIndex((x, i) => x !== opt[i])]
const kratko = (par: Par) =>
  [par.p, par.v].map(e => (e ? `${e.type_short} ${e.day.slice(0, 3)} ${e.start}` : '-')).join(', ')

// Tvrdo pravilo prekršeno: isti termin za P i V, ili termin koji gazi postojeći
// iako je postojao slobodan (koji se ne poklapa sa drugim izborom).
function prekrsaji(s: Scenario, par: Par): string[] {
  const out: string[] = []
  if (par.p && par.v && par.p.day === par.v.day && par.p.start === par.v.start) out.push('P i V u istom terminu')
  for (const [e, lista, drugi] of [[par.p, s.predavanja, par.v], [par.v, s.vezbe, par.p]] as const) {
    if (!e || !cinjenice(e, s.raspored).menja) continue
    const slobodan = lista.some(x =>
      !cinjenice(x, s.raspored).menja && !(drugi && x.day === drugi.day && x.start === drugi.start))
    if (slobodan) out.push(`${e.type_short} gazi postojeći, a ima slobodan`)
  }
  return out
}

async function main() {
  const svi = scenariji(N)
  const varijante = { 'AI bira': aiBira, 'algoritam': algoritam }
  const rezultat: Record<string, { opt: number; prekrsaji: number; greske: number; ms: number[] }> = {}
  for (const k of Object.keys(varijante)) rezultat[k] = { opt: 0, prekrsaji: 0, greske: 0, ms: [] }

  for (const s of svi) {
    const najbolji = najboljiPar(s.raspored, s.predavanja, s.vezbe)
    const optimum = ocenaPara(s.raspored, najbolji)
    const detalji: string[] = []
    const red: string[] = []
    for (const [k, fn] of Object.entries(varijante)) {
      const t0 = Date.now()
      try {
        const par = await fn(s)
        rezultat[k].ms.push(Date.now() - t0)
        const sc = ocenaPara(s.raspored, par)
        const ok = same(sc, optimum)
        const pr = prekrsaji(s, par)
        if (ok) rezultat[k].opt++
        if (pr.length) rezultat[k].prekrsaji++
        red.push(`${k}:${ok ? 'opt' : `ne(${losijeNa(sc, optimum)})`}${pr.length ? ` PREKRŠAJ: ${pr.join('; ')}` : ''}`)
        if (!ok) detalji.push(`   ${k} izabrao ${kratko(par)} [${sc}]`)
      } catch (e) {
        rezultat[k].greske++
        red.push(`${k}:greška ${(e as Error).message}`)
      }
      if (k !== 'algoritam') await new Promise(r => setTimeout(r, 2500)) // Groq limit
    }
    console.log(`${s.naziv.padEnd(60)} ${red.join('  ')}`)
    if (process.env.VERBOSE && detalji.length) console.log(`   optimum ${kratko(najbolji)} [${optimum}]\n${detalji.join('\n')}`)
  }

  console.log(`\n${N} scenarija`)
  for (const [k, r] of Object.entries(rezultat)) {
    const ms = r.ms.sort((a, b) => a - b)
    const med = ms.length ? ms[Math.floor(ms.length / 2)] : 0
    console.log(`${k.padEnd(22)} optimalno ${r.opt}/${N}  prekršaji pravila ${r.prekrsaji}  greške ${r.greske}  medijana ${med} ms`)
  }
}

main()
