'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { SemesterData, ScheduleEntry } from '@/lib/types'
import { getScheduleForGroup, fetchYearBothSemesters } from '@/lib/schedule'
import { session, byGroup } from '@/lib/storage'
import { toggleTheme } from '@/lib/theme'
import FeedbackButton from '@/components/FeedbackButton'
import OfflineNotice from '@/components/OfflineNotice'

const SLOT_LABEL: Record<string, string> = {
  '08:15': '08:15-10:00', '10:15': '10:15-12:00',
  '12:15': '12:15-14:00', '14:15': '14:15-16:00',
  '16:15': '16:15-18:00', '18:15': '18:15-20:00',
}

const GLASS = 'liquid-glass'

type IconProps = React.SVGProps<SVGSVGElement>
const baseIcon = (props: IconProps) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
})
const IconBack = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
)
const IconMoon = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
)
const IconSun = (p: IconProps) => (
  <svg {...baseIcon(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
)
const IconChevronDown = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="m6 9 6 6 6-6" /></svg>
)
const IconChevronUp = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="m18 15-6-6-6 6" /></svg>
)
const IconForward = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
)
const IconPlus = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M12 5v14M5 12h14" /></svg>
)
const IconSparkle = (p: IconProps) => (
  <svg {...baseIcon(p)}>
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
  </svg>
)

export default function PreneseniPage() {
  const router = useRouter()
  const [godina, setGodina] = useState<number | null>(null)
  const [predmeti, setPredmeti] = useState<string[]>([])
  const [odabraniPredmet, setOdabraniPredmet] = useState('')
  const [trenutniRaspored, setTrenutniRaspored] = useState<ScheduleEntry[]>([])
  const [dostupniTermini, setDostupniTermini] = useState<ScheduleEntry[]>([])
  const [preporuka, setPreporuka] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [godineData, setGodineData] = useState<Record<number, SemesterData>>({})
  const [odabranoPredavanje, setOdabranoPredavanje] = useState<ScheduleEntry | null>(null)
  const [odabraneVezbe, setOdabraneVezbe] = useState<ScheduleEntry | null>(null)
  const [dodato, setDodato] = useState(false)
  const [extraTermini, setExtraTermini] = useState<ScheduleEntry[]>([])
  const [hiddenTermini, setHiddenTermini] = useState<ScheduleEntry[]>([])
  const [prevSubjects, setPrevSubjects] = useState<{ year: number; subject: string }[]>([])
  const [predmetSearch, setPredmetSearch] = useState('')
  const [manualOpen, setManualOpen] = useState(false)
  const [loadError, setLoadError] = useState(false)


  async function refreshTrenutniRaspored(nextExtra: ScheduleEntry[]) {
    const group = session.group.get()
    const year = session.year.get()
    if (!group || !year) return

    // Offline bi ovde bacio unhandled rejection usred event handlera i tiho
    // preskočio setTrenutniRaspored — zato try/catch.
    let data: SemesterData
    try {
      const res = await fetch(`/data/${year}god.json`)
      if (!res.ok) return
      data = await res.json()
    } catch {
      return
    }

    const all = getScheduleForGroup(data, group)
    const savedSubjects = byGroup.subjects(group).get()
    const hasSaved = Object.keys(savedSubjects).length > 0
    let baseFiltered = hasSaved
      ? all.filter(e => savedSubjects[e.subject] !== false)
      : all

    baseFiltered = baseFiltered.filter(b => {
      const gaziGaVreme = nextExtra.some(ex => ex.day === b.day && ex.start === b.start)
      const gaziGaPredmet = nextExtra.some(ex => ex.subject === b.subject && ex.type_short === b.type_short)
      return !gaziGaVreme && !gaziGaPredmet
    })

    setTrenutniRaspored([...baseFiltered, ...nextExtra])
  }

  useEffect(() => {
    const group = session.group.get()
    const year = session.year.get()
    if (!group || !year) { router.replace('/'); return }

    fetch(`/data/${year}god.json`)
      .then(r => { if (!r.ok) throw new Error('http'); return r.json() })
      .then((data: SemesterData) => {
        const all = getScheduleForGroup(data, group)
        const savedSubjects = byGroup.subjects(group).get()
        const hasSaved = Object.keys(savedSubjects).length > 0
        let baseFiltered = hasSaved
          ? all.filter(e => savedSubjects[e.subject] !== false)
          : all

        const extraEntries = byGroup.extra(group).get()
        if (extraEntries.length > 0) {
          // Automatsko gaženje: sakrij redovne predmete po VREMENU i po PREDMETU
          baseFiltered = baseFiltered.filter(b => {
            const gaziGaVreme = extraEntries.some(ex => ex.day === b.day && ex.start === b.start)
            const gaziGaPredmet = extraEntries.some(ex => ex.subject === b.subject && ex.type_short === b.type_short)
            return !gaziGaVreme && !gaziGaPredmet
          })

          baseFiltered = [...baseFiltered, ...extraEntries]
        }
        setTrenutniRaspored(baseFiltered)
      })
      .catch(() => setLoadError(true))

    setExtraTermini(byGroup.extra(group).get())
    setHiddenTermini(byGroup.hidden(group).get())
    setPrevSubjects(byGroup.prevSubjects(group).get())
  }, [router])

  function vratiTermin(index: number) {
    const group = session.group.get() ?? ''
    const novi = hiddenTermini.filter((_, i) => i !== index)
    setHiddenTermini(novi)
    if (novi.length === 0) byGroup.hidden(group).remove()
    else byGroup.hidden(group).set(novi)
  }

  function obrisiTermin(index: number) {
    const group = session.group.get() ?? ''
    const novi = extraTermini.filter((_, i) => i !== index)
    setExtraTermini(novi)
    if (novi.length === 0) byGroup.extra(group).remove()
    else byGroup.extra(group).set(novi)
    void refreshTrenutniRaspored(novi)
  }

  async function handleGodinaSelect(g: number, autoSelect?: string) {
    setGodina(g)
    setOdabraniPredmet(autoSelect ?? '')
    setPredmeti([])
    setDostupniTermini([])
    setPreporuka(null)
    setOdabranoPredavanje(null)
    setOdabraneVezbe(null)
    setDodato(false)
    setPredmetSearch('')
    if (autoSelect) setManualOpen(false)

    let data = godineData[g]
    if (!data) {
      setLoadingData(true)
      try {
        // Oba semestra (zimski + letnji), ne samo trenutno "živi" ${g}god.json —
        // inače predmet iz semestra koji trenutno nije aktivan ne može da se nađe.
        const entries = await fetchYearBothSemesters(g)
        data = { semester: '', year: g, groups: {}, entries }
        setGodineData(prev => ({ ...prev, [g]: data as SemesterData }))
      } finally {
        setLoadingData(false)
      }
    }

    const unique = [...new Set(data.entries.map(e => e.subject))].sort()
    setPredmeti(unique)

    if (autoSelect) {
      setOdabraniPredmet(autoSelect)
      setDostupniTermini(data.entries.filter(e => e.subject === autoSelect))
    }
  }

  function handlePredmetSelect(predmet: string) {
    setOdabraniPredmet(predmet)
    setPredmetSearch('')
    setPreporuka(null)
    setOdabranoPredavanje(null)
    setOdabraneVezbe(null)
    setDodato(false)

    if (!godina || !godineData[godina]) return

    const termini = godineData[godina].entries.filter(e => e.subject === predmet)
    setDostupniTermini(termini)
  }

  function clearSelectedSubject() {
    setGodina(null)
    setOdabraniPredmet('')
    setPredmeti([])
    setDostupniTermini([])
    setPredmetSearch('')
    setPreporuka(null)
    setOdabranoPredavanje(null)
    setOdabraneVezbe(null)
    setDodato(false)
  }

  function toggleManualOpen() {
    setManualOpen(open => {
      if (open) clearSelectedSubject()
      return !open
    })
  }

  function handlePrevSubjectClick(item: { year: number; subject: string }) {
    if (godina === item.year && odabraniPredmet === item.subject) {
      clearSelectedSubject()
      return
    }
    setManualOpen(false)
    void handleGodinaSelect(item.year, item.subject)
  }

  async function getPreporuka() {
    if (!odabraniPredmet || !dostupniTermini.length) return
    setLoading(true)
    setPreporuka(null)

    const trenutniStr = trenutniRaspored
      .map(e => `${e.day} ${e.start}-${e.end}: ${e.subject} [${e.type_short}]`)
      .join('\n')

    // AI sad dobija sve termine, sa naznakom da li menjaju postojeći predmet
    const predavanjaStr = dostupniTermini.filter(e => e.type_short === 'P')
      .map(e => {
        const preklapanje = trenutniRaspored.find(r => r.day === e.day && r.start === e.start)
        return `${e.day} ${e.start}-${e.end} Sala ${e.room} ${preklapanje ? `(PREKLAPANJE: Mora da zameni ${preklapanje.subject})` : '(SLOBODNO)'}`
      }).join('\n')

    const vezbeStr = dostupniTermini.filter(e => e.type_short === 'V')
      .map(e => {
        const preklapanje = trenutniRaspored.find(r => r.day === e.day && r.start === e.start)
        return `${e.day} ${e.start}-${e.end} Sala ${e.room} ${preklapanje ? `(PREKLAPANJE: Mora da zameni ${preklapanje.subject})` : '(SLOBODNO)'}`
      }).join('\n')

    try {
      const res = await fetch('/api/preneseni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trenutniRaspored: trenutniStr,
          dostupnaPredavanja: predavanjaStr,
          dostupneVezbe: vezbeStr,
          predmet: odabraniPredmet,
        }),
      })
      const data = await res.json()
      setPreporuka(data.preporuka)
    } catch {
      setPreporuka('Greška pri dobijanju preporuke. Pokušaj ponovo.')
    } finally {
      setLoading(false)
    }
  }

  // Više ne filtriramo izlaz, već nudimo SVE
  const terminiPredavanja = dostupniTermini.filter(e => e.type_short === 'P')
  const terminiVezbi = dostupniTermini.filter(e => e.type_short === 'V')
  const trebaPredavanje = terminiPredavanja.length > 0
  const trebaVezbe = terminiVezbi.length > 0
  const canAdd = odabranoPredavanje !== null || odabraneVezbe !== null


  return (
    <main className="min-h-screen pb-32 sm:pb-0">
      <div className="mx-auto max-w-lg px-3 py-3 sm:px-4 sm:py-8">

        <header className="mb-6 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              Izmena rasporeda
            </h1>
            <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
              Dodaj <strong>termine za predmete iz prethodnih godina</strong>, promeni termin postojećeg predmeta, ili vrati sakrivene termine.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={toggleTheme}
              aria-label="Promeni temu"
              className={`flex h-9 w-9 items-center justify-center rounded-full text-gray-600 dark:text-gray-300 ${GLASS} hover:bg-white/80 dark:hover:bg-gray-800/70 transition-colors`}
            >
              <IconMoon className="h-[18px] w-[18px] dark:hidden" />
              <IconSun className="hidden h-[18px] w-[18px] dark:block" />
            </button>
            <FeedbackButton />
            <button
              onClick={() => router.push('/raspored')}
              className={`hidden items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 sm:inline-flex ${GLASS} hover:bg-white/80 dark:hover:bg-gray-800/70 transition-colors`}
            >
              <IconBack className="h-4 w-4" />
              Nazad
            </button>
          </div>
        </header>

        {loadError && <OfflineNotice />}

        <div className={`space-y-5 rounded-[1.75rem] p-6 ring-1 ring-[#024c7d]/15 dark:ring-white/15 shadow-[0_18px_60px_rgba(2,76,125,0.10)] dark:shadow-[0_18px_60px_rgba(0,0,0,0.35)] ${GLASS} ${loadError ? 'hidden' : ''}`}>

          {/* Moji predmeti (izborni) */}
          <div className="rounded-2xl border border-[#024c7d]/10 bg-white/45 p-3 dark:border-white/15 dark:bg-gray-900/35">
            <button
              type="button"
              onClick={() => router.push('/izborni')}
              className="no-hover-lift flex w-full items-center justify-between gap-3 text-left font-normal"
            >
              <div>
                <p className="text-sm font-normal text-gray-700 dark:text-gray-200">
                  Moji predmeti
                </p>
                <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                  Promeni koje izborne predmete pratiš.
                </p>
              </div>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#024c7d]/10 text-[#024c7d] dark:bg-[#60c3ad]/10 dark:text-[#60c3ad]">
                <IconForward className="h-4 w-4" />
              </span>
            </button>
          </div>

          {/* Dodati termini */}
          {extraTermini.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Dodati termini
              </label>
              <div className="space-y-1">
                {extraTermini.map((e, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-xl border border-[#024c7d]/15 bg-white/70 px-3 py-2 dark:border-white/20 dark:bg-gray-800/68"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {e.subject}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {e.day} · {e.start}–{e.end} [{e.type_short}] · Sala {e.room}
                      </p>
                    </div>
                    <button
                      onClick={() => obrisiTermin(i)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg
                       text-gray-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-500
                       transition-colors shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 border-t border-[#024c7d]/15 pt-2 dark:border-white/20">
                <button
                  onClick={() => {
                    setExtraTermini([])
                    byGroup.extra(session.group.get() ?? '').remove()
                    void refreshTrenutniRaspored([])
                  }}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  Obriši sve
                </button>
              </div>
            </div>
          )}

          {/* Skriveni termini */}
          {hiddenTermini.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Skriveni termini
              </label>
              <div className="space-y-1">
                {hiddenTermini.map((e, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-xl border border-[#024c7d]/15 bg-white/70 px-3 py-2 dark:border-white/20 dark:bg-gray-800/68"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {e.subject}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {e.day} · {e.start}–{e.end} [{e.type_short}] · Sala {e.room}
                      </p>
                    </div>
                    <button
                      onClick={() => vratiTermin(i)}
                      className="text-xs text-gray-400 hover:text-[#024c7d] dark:hover:text-[#60c3ad] transition-colors shrink-0"
                    >
                      Vrati
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prethodno odabrani predmeti iz podešavanja */}
          {prevSubjects.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Preneseni predmeti
              </label>
              <div className="flex flex-wrap gap-1.5">
                {prevSubjects.map((p, i) => {
                  const active = odabraniPredmet === p.subject && godina === p.year
                  return (
                    <button
                      key={i}
                      onClick={() => handlePrevSubjectClick(p)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors
                        ${active
                          ? 'bg-[#024c7d] text-white border-[#024c7d] shadow-sm dark:bg-[#60c3ad] dark:text-[#024c7d] dark:border-[#60c3ad]'
                          : 'bg-white/70 text-gray-600 border-[#024c7d]/15 hover:bg-white/80 dark:bg-gray-900/55 dark:text-gray-300 dark:border-white/20'}`}
                    >
                      <span className="text-gray-400 dark:text-gray-500 font-normal">{p.year}.</span>
                      {p.subject}
                      {!active && <IconPlus className="h-3 w-3 shrink-0 opacity-50" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-[#024c7d]/10 bg-white/45 p-3 dark:border-white/15 dark:bg-gray-900/35">
            <button
              type="button"
              onClick={toggleManualOpen}
              className="no-hover-lift flex w-full items-center justify-between gap-3 text-left font-normal"
            >
              <div>
                <p className="text-sm font-normal text-gray-700 dark:text-gray-200">
                  Dodatni termini
                </p>
                <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                  Ručno izaberi godinu i pronađi termin.
                </p>
              </div>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#024c7d]/10 text-[#024c7d] dark:bg-[#60c3ad]/10 dark:text-[#60c3ad]">
                {manualOpen ? <IconChevronUp className="h-4 w-4" /> : <IconChevronDown className="h-4 w-4" />}
              </span>
            </button>

            {manualOpen && (
              <div className="mt-4 space-y-4 border-t border-[#024c7d]/10 pt-4 dark:border-white/10">
                {/* Godina prenesenog predmeta */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Godina slušanja predmeta
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map(g => (
                      <button
                        key={g}
                        onClick={() => handleGodinaSelect(g)}
                        className={`py-2 rounded-full text-sm font-medium border transition-colors
                          ${godina === g
                            ? 'bg-[#024c7d] text-white border-[#024c7d] shadow-sm dark:bg-[#60c3ad] dark:text-[#024c7d] dark:border-[#60c3ad]'
                            : 'bg-white/70 text-gray-700 border-[#024c7d]/15 hover:bg-white/80 dark:bg-gray-900/55 dark:text-gray-300 dark:border-white/20 dark:hover:bg-gray-800/70'
                          }`}
                      >
                        {g}.
                      </button>
                    ))}
                  </div>
                </div>

                {/* Predmet */}
                {godina && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Predmet
                    </label>
                    {loadingData ? (
                      <div className="h-10 rounded-xl bg-white/60 dark:bg-gray-800/68 animate-pulse" />
                    ) : odabraniPredmet ? (
                      <div className="flex items-center justify-between rounded-xl border border-[#024c7d]/15 bg-white/70 px-3 py-2.5 dark:border-white/20 dark:bg-gray-900/65">
                        <span className="text-sm text-gray-900 dark:text-gray-100 truncate">{odabraniPredmet}</span>
                        <button
                          onClick={() => { setOdabraniPredmet(''); setDostupniTermini([]); setPreporuka(null); setOdabranoPredavanje(null); setOdabraneVezbe(null) }}
                          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0 ml-2 transition-colors"
                        >
                          Promeni
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          value={predmetSearch}
                          onChange={e => setPredmetSearch(e.target.value)}
                          placeholder="Pretraži predmet..."
                          className="w-full h-10 px-3 rounded-xl border border-[#024c7d]/15 dark:border-white/20 text-sm
                                     text-gray-900 dark:text-gray-100 bg-white/70 dark:bg-gray-900/65
                                     focus:outline-none focus:ring-2 focus:ring-[#024c7d] dark:focus:ring-[#60c3ad]
                                     placeholder:text-gray-400 dark:placeholder:text-gray-500"
                        />
                        <div className="max-h-44 overflow-y-auto rounded-xl border border-[#024c7d]/15 dark:border-white/20 divide-y divide-[#024c7d]/10 dark:divide-white/10 bg-white/60 dark:bg-gray-900/55">
                          {predmeti
                            .filter(p => p.toLowerCase().includes(predmetSearch.toLowerCase()))
                            .map(p => (
                              <div
                                key={p}
                                onClick={() => handlePredmetSelect(p)}
                                className="cursor-pointer px-3 py-2 text-sm text-gray-900 transition-colors hover:bg-white/70 dark:text-gray-100 dark:hover:bg-gray-800/65"
                              >
                                {p}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dostupni termini */}
          {dostupniTermini.length > 0 && (
            <div className="space-y-4">
              {terminiPredavanja.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Predavanja (P)
                  </label>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {terminiPredavanja.map((e, i) => {
                      const preklapanje = trenutniRaspored.find(r => r.day === e.day && r.start === e.start)
                      return (
                        <label
                          key={`p-${i}`}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2 cursor-pointer
                        transition-colors border
                        ${odabranoPredavanje === e
                              ? 'bg-[#024c7d] border-[#024c7d] dark:bg-[#60c3ad] dark:border-[#60c3ad]'
                              : preklapanje 
                                ? 'bg-orange-50/50 dark:bg-orange-900/10 border-transparent hover:bg-orange-50 dark:hover:bg-orange-900/20' 
                                : 'bg-white/60 dark:bg-gray-800/50 border-transparent hover:bg-white/70 dark:hover:bg-gray-700/60'}`}
                        >
                          <input
                            type="checkbox"
                            checked={odabranoPredavanje === e}
                            onChange={() => {
                              setOdabranoPredavanje(prev => prev === e ? null : e)
                              setDodato(false)
                            }}
                            className="shrink-0"
                          />
                          <span className={`text-xs flex-1 ${odabranoPredavanje === e ? 'text-white dark:text-[#024c7d]' : 'text-gray-600 dark:text-gray-300'}`}>
                            <span className="font-medium">{e.day}</span>
                            {' '}{SLOT_LABEL[e.start]} [{e.type_short}] · Sala {e.room}
                            {preklapanje && (
                              <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none 
                                ${odabranoPredavanje === e ? 'bg-white/20 text-white dark:bg-[#024c7d]/20 dark:text-[#024c7d]' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                                Menja: {preklapanje.subject} [{preklapanje.type_short}]
                              </span>
                            )}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {terminiVezbi.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Vežbe (V)
                  </label>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {terminiVezbi.map((e, i) => {
                      const preklapanje = trenutniRaspored.find(r => r.day === e.day && r.start === e.start)
                      return (
                        <label
                          key={`v-${i}`}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2 cursor-pointer
                        transition-colors border
                        ${odabraneVezbe === e
                              ? 'bg-[#024c7d] border-[#024c7d] dark:bg-[#60c3ad] dark:border-[#60c3ad]'
                              : preklapanje 
                                ? 'bg-orange-50/50 dark:bg-orange-900/10 border-transparent hover:bg-orange-50 dark:hover:bg-orange-900/20' 
                                : 'bg-white/60 dark:bg-gray-800/50 border-transparent hover:bg-white/70 dark:hover:bg-gray-700/60'}`}
                        >
                          <input
                            type="checkbox"
                            checked={odabraneVezbe === e}
                            onChange={() => {
                              setOdabraneVezbe(prev => prev === e ? null : e)
                              setDodato(false)
                            }}
                            className="shrink-0"
                          />
                          <span className={`text-xs flex-1 ${odabraneVezbe === e ? 'text-white dark:text-[#024c7d]' : 'text-gray-600 dark:text-gray-300'}`}>
                            <span className="font-medium">{e.day}</span>
                            {' '}{SLOT_LABEL[e.start]} [{e.type_short}] · Sala {e.room}
                            {preklapanje && (
                              <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none 
                                ${odabraneVezbe === e ? 'bg-white/20 text-white dark:bg-[#024c7d]/20 dark:text-[#024c7d]' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                                Menja: {preklapanje.subject} [{preklapanje.type_short}]
                              </span>
                            )}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI preporuka dugme */}
          {dostupniTermini.length > 0 && (
            <button
              onClick={getPreporuka}
              disabled={loading}
              className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition-colors
                ${loading
                  ? 'bg-white/60 text-gray-400 cursor-not-allowed dark:bg-gray-800/68 dark:text-gray-500'
                  : 'bg-[#024c7d] text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0]'}`}
            >
              
              {loading ? 'Traženje termina...' : 'Predloži najbolje termine'}
              <IconSparkle className="h-4 w-4" />
            </button>
          )}

          {/* Preporuka */}
          {preporuka && (
            <div className={`rounded-xl p-4 ${GLASS}`}>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Predlog termina</p>
              <div className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed space-y-2">
                {preporuka.split('\n').map((line, i) => (
                  <p key={i} className={line.startsWith('Razlog:') ? 'text-gray-500 dark:text-gray-400 text-xs pt-1 border-t border-gray-100 dark:border-gray-700' : 'font-medium'}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Dodaj u raspored */}
          {(trebaPredavanje || trebaVezbe) && (
            <button
              onClick={() => {
                const group = session.group.get() ?? ''
                const extra = byGroup.extra(group).get()
                const zaDodavanje = [odabranoPredavanje, odabraneVezbe].filter(Boolean) as ScheduleEntry[]

                for (const termin of zaDodavanje) {
                  const exists = extra.some(e =>
                    e.subject === termin.subject &&
                    e.day === termin.day &&
                    e.start === termin.start &&
                    e.type_short === termin.type_short &&
                    e.room === termin.room
                  )
                  if (!exists) {
                    extra.push(termin)
                  }
                }

                byGroup.extra(group).set(extra)
                setExtraTermini(extra)
                void refreshTrenutniRaspored(extra)
                setDodato(true)
                setOdabranoPredavanje(null)
                setOdabraneVezbe(null)
              }}
              disabled={!canAdd}
            className={`w-full rounded-xl py-2.5 text-sm font-medium transition-colors
      ${dodato
                  ? 'bg-green-100 text-green-800 cursor-default dark:bg-green-950/50 dark:text-green-300'
                  : canAdd
                    ? 'bg-[#024c7d] text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0]'
                    : 'bg-white/60 text-gray-400 cursor-not-allowed dark:bg-gray-800/68 dark:text-gray-500'}`}
            >
              {dodato ? '✓ Dodato u raspored' : 'Dodaj odabrane termine u raspored'}
            </button>
          )}

        </div>
      </div>
    </main>
  )
}
