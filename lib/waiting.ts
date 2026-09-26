// lib/waiting.ts
//
// Odluka pri ulasku u aplikaciju: na koji tab ide korisnik (Raspored ili
// Rokovi) i da li je period "čekamo raspored" (v. lib/season). Koriste je
// početna (app/page.tsx) i /raspored, koji u periodu čekanja vraća na početnu.
//
// Rezultat se pamti za trenutno učitavanje strane, pa obe strane vide isti
// odgovor. Bez toga bi na sporoj mreži početna posle isteka roka poslala na
// Raspored, a on nazad na početnu, i tako u krug.

import { app } from './storage'
import type { RokData, SemesterData } from './types'
import { pickDefaultTab } from './rokDefault'
import { awaitedSemester, pendingFor, todayLocalIso, type PendingSemester } from './season'

export type Dest = '/raspored' | '/rokovi'

export interface BootDecision {
  dest: Dest
  pending: PendingSemester | null
}

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url}: ${r.status}`)
  return r.json()
}

// Deo odluke koji zavisi samo od datuma i rokovi.json-a - isti za ceo dan, pa
// se čuva u localStorage. Tokom semestra (`awaited` je null) ulazak zato ne
// čeka mrežu.
async function dayPlan(date: string): Promise<{ dest: Dest; awaited: string | null } | null> {
  const cached = app.defaultTab.get()
  if (cached && cached.date === date && cached.awaited !== undefined) {
    return { dest: cached.dest, awaited: cached.awaited }
  }
  try {
    const rokovi = await fetchJson<RokData[]>('/data/rokovi.json')
    const plan = { dest: pickDefaultTab(rokovi, date), awaited: awaitedSemester(rokovi, date) }
    app.defaultTab.set({ date, ...plan })
    return plan
  } catch {
    return null
  }
}

async function decide(date: string): Promise<{ decision: BootDecision; ok: boolean }> {
  const fallback: Dest = app.defaultTab.get()?.dest ?? '/raspored'
  const plan = await dayPlan(date)
  if (!plan) return { decision: { dest: fallback, pending: null }, ok: false }
  if (!plan.awaited) return { decision: { dest: plan.dest, pending: null }, ok: true }
  try {
    // Semestar je isti u svim god.json, pa je dovoljan jedan.
    const god = await fetchJson<SemesterData>('/data/1god.json')
    return { decision: { dest: plan.dest, pending: pendingFor(god.semester, plan.awaited) }, ok: true }
  } catch {
    return { decision: { dest: plan.dest, pending: null }, ok: false }
  }
}

let memo: { date: string; promise: Promise<BootDecision> } | null = null

export function bootDecision(): Promise<BootDecision> {
  const date = todayLocalIso()
  if (memo?.date === date) return memo.promise
  const promise = decide(date).then(({ decision, ok }) => {
    // Neuspeh (mreža) se ne pamti, sledeći poziv pokušava ponovo.
    if (!ok) memo = null
    return decision
  })
  memo = { date, promise }
  return promise
}
