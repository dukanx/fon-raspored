'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { SemesterData, ScheduleEntry } from '@/lib/types'
import { uniqueSubjectsForGroup } from '@/lib/schedule'
import { decodeShare } from '@/lib/share'
import { session, saved, byGroup } from '@/lib/storage'
import InstallPrompt from '@/components/InstallPrompt'

const GLASS = 'liquid-glass'

type Ready = {
  kind: 'ready'
  y: number
  g: string
  program: string
  semester: string
  subjects: string[]
  checkedList: string[]
  drift: boolean // raspored se promenio od kad je link napravljen
  extra?: ScheduleEntry[]
  prevSubjects?: { year: number; subject: string }[]
  otherSem?: string[]
}

type State = { kind: 'loading' } | { kind: 'invalid' } | Ready

export default function DeliPage() {
  const router = useRouter()
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('s') ?? ''
    const payload = decodeShare(raw)
    // queueMicrotask: izbegava setState sinhrono u efektu (react-hooks pravilo).
    if (!payload) { queueMicrotask(() => setState({ kind: 'invalid' })); return }

    fetch(`/data/${payload.y}god.json`)
      .then(r => (r.ok ? r.json() : null))
      .then((data: SemesterData | null) => {
        if (!data) { setState({ kind: 'invalid' }); return }
        const group = data.groups[payload.g]
        if (!group) { setState({ kind: 'invalid' }); return }

        const subjects = uniqueSubjectsForGroup(data, payload.g)
        const drift = subjects.length !== payload.n
        const checkedList = drift
          ? []
          : payload.s.filter(i => i >= 0 && i < subjects.length).map(i => subjects[i])

        setState({
          kind: 'ready',
          y: payload.y,
          g: payload.g,
          program: group.program,
          semester: data.semester,
          subjects,
          checkedList,
          drift,
          extra: payload.x,
          prevSubjects: payload.p,
          otherSem: payload.o,
        })
      })
      .catch(() => setState({ kind: 'invalid' }))
  }, [])

  // Upiši identitet (grupa/godina/smer/semestar) u session + saved.
  function commitIdentity(s: Ready) {
    session.group.set(s.g)
    session.year.set(String(s.y))
    session.program.set(s.program)
    session.semester.set(s.semester)
    session.lastName.set(s.g) // iz linka nemamo prezime — grupa kao placeholder

    saved.group.set(s.g)
    saved.year.set(String(s.y))
    saved.program.set(s.program)
    saved.lastName.set(s.g)
    saved.semester.set(s.semester)
  }

  // Primeni deljeni izbor predmeta i otvori raspored. extra/prevSubjects/
  // otherSem su prisutni samo ako ih je pošiljalac uključio — ako ih nema,
  // ne diramo ono što primalac možda već ima podešeno.
  function apply(s: Ready) {
    const checked: Record<string, boolean> = {}
    for (const subj of s.subjects) checked[subj] = false
    for (const subj of s.checkedList) checked[subj] = true

    commitIdentity(s)
    byGroup.subjects(s.g).set(checked)
    if (s.extra) byGroup.extra(s.g).set(s.extra)
    if (s.prevSubjects) byGroup.prevSubjects(s.g).set(s.prevSubjects)
    if (s.otherSem) byGroup.otherSem(s.g).set(s.otherSem)
    router.push('/raspored')
  }

  // Preskoči deljeni izbor — samo postavi grupu i vodi na izbor predmeta.
  function pickManually(s: Ready) {
    commitIdentity(s)
    router.push('/izborni')
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center px-4 py-10">
      <div className={`w-full max-w-md rounded-[1.75rem] p-8 ring-1 ring-[#024c7d]/15 dark:ring-white/15 ${GLASS}`}>
        <h1 className="text-xl font-semibold text-[#024c7d] dark:text-[#60c3ad]">Podeljeni raspored</h1>

        {state.kind === 'loading' && (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Učitavanje…</p>
        )}

        {state.kind === 'invalid' && (
          <>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
              Link nije važeći ili je istekao.
            </p>
            <button
              onClick={() => router.push('/')}
              className="mt-6 w-full rounded-xl bg-[#024c7d] py-2.5 text-sm font-medium text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0] transition-colors"
            >
              Na početnu
            </button>
          </>
        )}

        {state.kind === 'ready' && (
          <>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Neko ti je podelio svoj raspored:
            </p>

            <div className="mt-4 rounded-xl border border-[#024c7d]/15 dark:border-white/15 p-4 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-gray-500 dark:text-gray-400">Godina</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{state.y}. godina</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500 dark:text-gray-400">Smer</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{state.program}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500 dark:text-gray-400">Grupa</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{state.g}</span>
              </div>
              {!state.drift && (
                <div className="flex justify-between py-1">
                  <span className="text-gray-500 dark:text-gray-400">Predmeti</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{state.checkedList.length}</span>
                </div>
              )}
              {!!state.extra?.length && (
                <div className="flex justify-between py-1">
                  <span className="text-gray-500 dark:text-gray-400">Preneseni termini</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{state.extra.length}</span>
                </div>
              )}
              {!!state.prevSubjects?.length && (
                <div className="flex justify-between py-1">
                  <span className="text-gray-500 dark:text-gray-400">Preneseni predmeti</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{state.prevSubjects.length}</span>
                </div>
              )}
              {!!state.otherSem?.length && (
                <div className="flex justify-between py-1">
                  <span className="text-gray-500 dark:text-gray-400">Drugi semestar</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{state.otherSem.length}</span>
                </div>
              )}
            </div>

            {state.drift && (
              <p className="mt-4 rounded-xl border border-amber-200/70 bg-amber-50/80 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                Raspored se promenio od kad je link napravljen, pa izbor predmeta ne
                možemo tačno da prenesemo. Možeš da ih izabereš ručno.
              </p>
            )}

            <InstallPrompt withLink className="mt-4" />

            <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
              Ovo će zameniti tvoj trenutni izbor na ovom uređaju.
            </p>

            <div className="mt-4 space-y-2">
              {!state.drift && (
                <button
                  onClick={() => apply(state)}
                  className="w-full rounded-xl bg-[#024c7d] py-2.5 text-sm font-medium text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0] transition-colors"
                >
                  Primeni raspored
                </button>
              )}
              <button
                onClick={() => pickManually(state)}
                className={`w-full rounded-xl py-2.5 text-sm font-medium transition-colors ${
                  state.drift
                    ? 'bg-[#024c7d] text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0]'
                    : 'text-[#024c7d] dark:text-[#60c3ad] hover:bg-white/70 dark:hover:bg-gray-800/60'
                }`}
              >
                Izaberi predmete sam
              </button>
              <button
                onClick={() => router.push('/')}
                className="w-full rounded-xl py-2.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-white/70 dark:hover:bg-gray-800/60 transition-colors"
              >
                Otkaži
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
