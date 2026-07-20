'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import type { SemesterData } from '@/lib/types'
import { getScheduleForGroup } from '@/lib/schedule'
import { reconcileSemester, acknowledgeFlip } from '@/lib/semester'

const GLASS = 'liquid-glass'

export default function IzbornoPage() {
  const router = useRouter()
  const isHydrated = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false
  )
  const group = isHydrated ? (sessionStorage.getItem('fon_group') ?? '') : ''
  const year = isHydrated ? (sessionStorage.getItem('fon_year') ?? '') : ''
  const [subjects, setSubjects] = useState<string[]>([])
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [semester, setSemester] = useState<string>('')

  const [prevOpen, setPrevOpen] = useState(false)
  const [prevGodina, setPrevGodina] = useState<number | null>(null)
  const [prevPredmeti, setPrevPredmeti] = useState<string[]>([])
  const [prevSearch, setPrevSearch] = useState('')
  const [prevLoading, setPrevLoading] = useState(false)
  const [prevSelected, setPrevSelected] = useState<{ year: number; subject: string }[]>([])

  // Predmeti iz drugog semestra (za mešane septembarski/oktobarski rok)
  const [otherOpen, setOtherOpen] = useState(false)
  const [otherSubjects, setOtherSubjects] = useState<string[]>([])
  const [otherSearch, setOtherSearch] = useState('')
  const [otherLoading, setOtherLoading] = useState(false)
  const [otherLoaded, setOtherLoaded] = useState(false)
  const [otherSelected, setOtherSelected] = useState<string[]>([])

  // "Letnji 2025/26" -> zimski je drugi semestar (i obrnuto)
  const otherSemWord = semester.toLowerCase().startsWith('letnji') ? 'zimski' : 'letnji'
  const otherSemLabel = otherSemWord === 'zimski' ? 'zimskog' : 'letnjeg'

  useEffect(() => {
    if (!isHydrated) return
    if (!group || !year) { router.replace('/'); return }

    // Sinhrono čitanje — persist-efekat za otherSelected piše pre nego što
    // fetch stigne, pa bi async čitanje videlo već pregaženu vrednost.
    const savedSubjectsRaw = localStorage.getItem(`fon_subjects_${group}`)
    const savedOtherRaw = localStorage.getItem(`fon_other_sem_${group}`)

    fetch(`/data/${year}god.json`)
      .then(r => r.json())
      .then((data: SemesterData) => {
        setSemester(data.semester)
        const entries = getScheduleForGroup(data, group)
        const unique = [...new Set(entries.map(e => e.subject))].sort()
        setSubjects(unique)

        // Prevrtanje semestra: sačuvani izbori se odnose na predmete starog
        // semestra — reconcileSemester ih resetuje da rokovi filter ne sakrije
        // nove predmete. (Isti helper koristi i raspored za "Nov semestar" popup.)
        const flipped = reconcileSemester(data.semester, group)

        const saved = flipped ? null : savedSubjectsRaw
        if (saved) {
          setChecked(JSON.parse(saved))
        } else {
          const all: Record<string, boolean> = {}
          unique.forEach(s => { all[s] = true })
          setChecked(all)
        }

        const savedOther = flipped ? null : savedOtherRaw
        if (savedOther) {
          const parsed = JSON.parse(savedOther)
          setOtherSelected(parsed)
          if (parsed.length > 0) setOtherOpen(true)
        }
      })

    const savedPrev = localStorage.getItem(`fon_prev_subjects_${group}`)
    if (savedPrev) {
      const parsed = JSON.parse(savedPrev)
      queueMicrotask(() => {
        setPrevSelected(parsed)
        if (parsed.length > 0) setPrevOpen(true)
      })
    }
  }, [group, isHydrated, router, year])

  useEffect(() => {
    if (!isHydrated || !group) return
    localStorage.setItem(`fon_prev_subjects_${group}`, JSON.stringify(prevSelected))
  }, [prevSelected, isHydrated, group])

  useEffect(() => {
    if (!isHydrated || !group) return
    localStorage.setItem(`fon_other_sem_${group}`, JSON.stringify(otherSelected))
  }, [otherSelected, isHydrated, group])

  // Lenjivo učitaj predmete drugog semestra kad se sekcija prvi put otvori
  function loadOtherSemester() {
    if (otherLoaded || !year || !semester) return
    setOtherLoading(true)
    fetch(`/data/${year}god-${otherSemWord}.json`)
      .then(r => (r.ok ? r.json() : null))
      .then((data: SemesterData | null) => {
        if (data) {
          setOtherSubjects([...new Set(data.entries.map(e => e.subject))].sort())
        }
        setOtherLoaded(true)
      })
      .catch(() => setOtherLoaded(true))
      .finally(() => setOtherLoading(false))
  }

  function toggleOtherSubject(subject: string) {
    setOtherSelected(prev =>
      prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]
    )
  }

  function toggle(subject: string) {
    setChecked(prev => ({ ...prev, [subject]: !prev[subject] }))
  }

  function handleConfirm() {
    // Potvrda izbora = korisnik je odradio "Nov semestar" korak.
    acknowledgeFlip()
    localStorage.setItem(`fon_subjects_${group}`, JSON.stringify(checked))
    // Akumuliraj izbor po semestru — mešani Sep/Okt rokovi uniraju oba semestra.
    if (semester) {
      const raw = localStorage.getItem('fon_subjects_history')
      const hist: Record<string, string[]> = raw ? JSON.parse(raw) : {}
      hist[semester] = Object.entries(checked).filter(([, v]) => v).map(([k]) => k)
      // Orezivanje: čuvaj samo tekuću i prošlu školsku godinu ("Letnji 2025/26" -> 2025).
      // Prošla mora da ostane — Sep/Okt rok pripada staroj školskoj godini.
      const ayStart = (s: string) => parseInt(s.match(/(\d{4})\/\d{2}/)?.[1] ?? '', 10)
      const current = ayStart(semester)
      if (!Number.isNaN(current)) {
        for (const key of Object.keys(hist)) {
          const y = ayStart(key)
          if (Number.isNaN(y) || y < current - 1) delete hist[key]
        }
      }
      localStorage.setItem('fon_subjects_history', JSON.stringify(hist))
    }
    router.push('/raspored')
  }

  function handlePrevGodina(g: number) {
    setPrevGodina(g)
    setPrevSearch('')
    setPrevPredmeti([])
    setPrevLoading(true)
    fetch(`/data/${g}god.json`)
      .then(r => r.json())
      .then((data: SemesterData) => {
        const unique = [...new Set(data.entries.map(e => e.subject))].sort()
        setPrevPredmeti(unique)
      })
      .finally(() => setPrevLoading(false))
  }

  function togglePrevSubject(g: number, subject: string) {
    setPrevSelected(prev => {
      const exists = prev.some(p => p.year === g && p.subject === subject)
      return exists
        ? prev.filter(p => !(p.year === g && p.subject === subject))
        : [...prev, { year: g, subject }]
    })
  }

  const checkedCount = Object.values(checked).filter(Boolean).length
  const filteredPrev = prevPredmeti.filter(p =>
    p.toLowerCase().includes(prevSearch.toLowerCase())
  )

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className={`w-full max-w-md rounded-[1.75rem] p-8 shadow-[0_18px_60px_rgba(2,76,125,0.10)] dark:shadow-[0_18px_60px_rgba(0,0,0,0.35)] ${GLASS}`}>

        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Tvoji predmeti</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Odčekiraj predmete koje ne slušaš
          </p>
        </div>

        <div className="space-y-1 mb-4 max-h-72 overflow-y-auto">
          {subjects.map(subject => (
            <label
              key={subject}
              className="flex items-center gap-3 rounded-xl px-2 py-2.5
                         hover:bg-white/70 dark:hover:bg-gray-800/60 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={checked[subject] ?? true}
                onChange={() => toggle(subject)}
                className="w-4 h-4 rounded accent-[#024c7d] dark:accent-[#60c3ad] shrink-0"
              />
              <span className={`text-sm ${checked[subject] ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500 line-through'}`}>
                {subject}
              </span>
            </label>
          ))}
        </div>

        {/* Predmeti iz prošlih godina */}
        <div className="mb-6 border-t border-white/75 pt-4 dark:border-white/15">
          <button
            type="button"
            onClick={() => setPrevOpen(v => !v)}
            className="no-hover-lift flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors w-full text-left"
          >
            <span className="text-xs w-2">{prevOpen ? '▾' : '▸'}</span>
            <span>Predmeti iz prošlih godina</span>
            {prevSelected.length > 0 && (
                <span className="ml-1 rounded-full bg-[#024c7d] px-1.5 py-0.5 text-[10px] font-medium leading-none text-white dark:bg-[#60c3ad] dark:text-[#024c7d]">
                {prevSelected.length}
              </span>
            )}
          </button>

          {prevOpen && (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Termine za predmete iz prethodnih godina dodaješ u tabu{' '}
                <span className="font-medium text-gray-600 dark:text-gray-300">Izmena termina</span>.
              </p>

              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4].map(g => (
                  <button
                    key={g}
                    onClick={() => handlePrevGodina(g)}
                    className={`py-1.5 rounded-full text-xs font-medium border transition-colors
                      ${prevGodina === g
                        ? 'bg-[#024c7d] text-white border-[#024c7d] shadow-sm ring-1 ring-[#024c7d]/25 dark:bg-[#60c3ad] dark:text-[#024c7d] dark:border-[#60c3ad] dark:ring-[#60c3ad]/25'
                        : 'bg-white/70 text-gray-600 border-[#024c7d]/25 ring-1 ring-[#024c7d]/10 hover:bg-white/80 dark:bg-gray-900/55 dark:text-gray-300 dark:border-white/25 dark:ring-white/10'}`}
                  >
                    {g}. god
                  </button>
                ))}
              </div>

              {prevGodina && (
                <>
                  <input
                    type="text"
                    value={prevSearch}
                    onChange={e => setPrevSearch(e.target.value)}
                    placeholder="Pretraži predmet..."
                    className="w-full h-9 px-3 rounded-xl border border-white/70 dark:border-white/15 text-sm
                               text-gray-900 dark:text-gray-100 bg-white/70 dark:bg-gray-900/65
                               focus:outline-none focus:ring-2 focus:ring-[#024c7d] dark:focus:ring-[#60c3ad]
                               placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  />
                  {prevLoading ? (
                    <div className="h-8 rounded-xl bg-white/60 dark:bg-gray-800/68 animate-pulse" />
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-0.5">
                      {filteredPrev.map(p => {
                        const isSelected = prevSelected.some(s => s.year === prevGodina && s.subject === p)
                        return (
                          <label
                            key={p}
                            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/70 dark:hover:bg-gray-800/60 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => togglePrevSubject(prevGodina, p)}
                              className="w-3.5 h-3.5 rounded accent-[#024c7d] dark:accent-[#60c3ad] shrink-0"
                            />
                            <span className={`text-xs ${isSelected ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                              {p}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </>
              )}

              {prevSelected.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {prevSelected.map((s, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium
                                 bg-white/70 dark:bg-gray-800/65 text-gray-600 dark:text-gray-400"
                    >
                      {s.year}. · {s.subject}
                      <button
                        onClick={() => togglePrevSubject(s.year, s.subject)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 leading-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Predmeti iz drugog semestra — prikaži SAMO u letnjem semestru.
            Mešani Sep/Okt rok uvek padne u letnjem i traži zimske predmete
            (ponavljanja); u zimskom je picker suvišan i samo zbunjuje. */}
        {semester.toLowerCase().startsWith('letnji') && (
        <div className="mb-6 border-t border-white/75 pt-4 dark:border-white/15">
          <button
            type="button"
            onClick={() => { setOtherOpen(v => !v); loadOtherSemester() }}
            className="no-hover-lift flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors w-full text-left"
          >
            <span className="text-xs w-2">{otherOpen ? '▾' : '▸'}</span>
            <span>Predmeti iz {otherSemLabel} semestra</span>
            {otherSelected.length > 0 && (
              <span className="ml-1 rounded-full bg-[#024c7d] px-1.5 py-0.5 text-[10px] font-medium leading-none text-white dark:bg-[#60c3ad] dark:text-[#024c7d]">
                {otherSelected.length}
              </span>
            )}
          </button>

          {otherOpen && (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                U septembarskom i oktobarskom roku ima predmeta iz oba semestra.
                Štikliraj one iz {otherSemLabel} semestra koje polažeš da bi im video termine.
              </p>

              {otherLoading ? (
                <div className="h-8 rounded-xl bg-white/60 dark:bg-gray-800/68 animate-pulse" />
              ) : otherLoaded && otherSubjects.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                  Raspored {otherSemLabel} semestra još nije dostupan.
                </p>
              ) : (
                <>
                  <input
                    type="text"
                    value={otherSearch}
                    onChange={e => setOtherSearch(e.target.value)}
                    placeholder="Pretraži predmet..."
                    className="w-full h-9 px-3 rounded-xl border border-white/70 dark:border-white/15 text-sm
                               text-gray-900 dark:text-gray-100 bg-white/70 dark:bg-gray-900/65
                               focus:outline-none focus:ring-2 focus:ring-[#024c7d] dark:focus:ring-[#60c3ad]
                               placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  />
                  <div className="max-h-40 overflow-y-auto space-y-0.5">
                    {otherSubjects
                      .filter(p => p.toLowerCase().includes(otherSearch.toLowerCase()))
                      .map(p => {
                        const isSelected = otherSelected.includes(p)
                        return (
                          <label
                            key={p}
                            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/70 dark:hover:bg-gray-800/60 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleOtherSubject(p)}
                              className="w-3.5 h-3.5 rounded accent-[#024c7d] dark:accent-[#60c3ad] shrink-0"
                            />
                            <span className={`text-xs ${isSelected ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                              {p}
                            </span>
                          </label>
                        )
                      })}
                  </div>
                </>
              )}

              {otherSelected.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {otherSelected.map(s => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium
                                 bg-white/70 dark:bg-gray-800/65 text-gray-600 dark:text-gray-400"
                    >
                      {s}
                      <button
                        onClick={() => toggleOtherSubject(s)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 leading-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <span className="text-xs text-gray-400 dark:text-gray-500 w-full sm:w-auto text-center sm:text-left">
            {checkedCount} od {subjects.length} predmeta
          </span>
          <div className="flex w-full sm:w-auto items-stretch gap-2">
            <button
              onClick={() => { localStorage.removeItem('fon_saved_group'); sessionStorage.removeItem('fon_group'); router.push('/') }}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 ${GLASS} hover:bg-white/80 dark:hover:bg-gray-800/70 transition-colors`}
            >
              ← Nazad
            </button>
            <button
              onClick={handleConfirm}
              disabled={checkedCount === 0}
              className={`flex-[2] sm:flex-none flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-all active:scale-[0.97]
                ${checkedCount > 0
                  ? 'bg-[#024c7d] text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0]'
                  : 'bg-white/60 text-gray-400 cursor-not-allowed dark:bg-gray-800/68 dark:text-gray-500'}`}
            >
              Prikaži raspored →
            </button>
          </div>
        </div>

      </div>
    </main>
  )
}
