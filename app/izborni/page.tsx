'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import type { SemesterData } from '@/lib/types'
import { getScheduleForGroup, fetchYearBothSemesters } from '@/lib/schedule'
import { reconcileSemester, acknowledgeFlip } from '@/lib/semester'
import { type SubjectMeta, programToTrack, defaultChecked } from '@/lib/subjects'
import { planStatus, semesterKey, hasUnpublishedElectives, type StudyPlan } from '@/lib/plan'
import { session, saved as savedStore, app, byGroup } from '@/lib/storage'
import { AnimatePresence, motion } from 'motion/react'
import OfflineNotice from '@/components/OfflineNotice'
import Collapsible from '@/components/Collapsible'
import CheckRow from '@/components/CheckRow'
import { stagger } from '@/lib/stagger'

const GLASS = 'liquid-glass'

type IconProps = React.SVGProps<SVGSVGElement>
const baseIcon = (p: IconProps) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p,
})
const IconBack = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
)
const IconForward = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
)
const IconSearch = (p: IconProps) => (
  <svg {...baseIcon(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
)
const IconClose = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M18 6 6 18M6 6l12 12" /></svg>
)

/* ---------- Delovi sekcija sa dodatnim predmetima ---------- */

function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Pretraži predmet..."
        aria-label="Pretraži predmet"
        className="h-9 w-full rounded-xl border border-[#024c7d]/15 bg-white/70 pr-3 pl-9 text-sm text-gray-900
                   placeholder:text-gray-400 focus:ring-2 focus:ring-[#024c7d] focus:outline-none
                   dark:border-white/15 dark:bg-gray-900/65 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:ring-[#60c3ad]"
      />
    </div>
  )
}

function SubjectList({
  items,
  query,
  isChecked,
  onToggle,
}: {
  items: string[]
  query: string
  isChecked: (subject: string) => boolean
  onToggle: (subject: string) => void
}) {
  if (!items.length) {
    return (
      <p className="py-3 text-center text-xs text-gray-400 dark:text-gray-500">
        {query ? `Nema predmeta za „${query}“` : 'Nema predmeta'}
      </p>
    )
  }
  return (
    <div className="max-h-52 space-y-0.5 overflow-y-auto">
      {items.map(p => (
        <CheckRow key={p} label={p} checked={isChecked(p)} onChange={() => onToggle(p)} />
      ))}
    </div>
  )
}

// Izabrani predmeti kao čipovi; ulaze i izlaze sa malim "pop" efektom, a
// ostali se glatko pomere na novo mesto (layout).
function SelectedChips({ items }: { items: { key: string; label: string; onRemove: () => void }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 empty:hidden">
      <AnimatePresence initial={false}>
        {items.map(it => (
          <motion.span
            key={it.key}
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            className="inline-flex items-center gap-0.5 rounded-full bg-[#024c7d]/8 py-0.5 pr-0.5 pl-2.5 text-[11px] font-medium text-[#024c7d] dark:bg-[#60c3ad]/12 dark:text-[#60c3ad]"
          >
            {it.label}
            <button
              type="button"
              onClick={it.onRemove}
              aria-label={`Ukloni ${it.label}`}
              className="no-hover-lift flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-[#024c7d]/12 dark:hover:bg-white/10"
            >
              <IconClose className="h-3 w-3" />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  )
}

export default function IzbornoPage() {
  const router = useRouter()
  const isHydrated = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false
  )
  const group = isHydrated ? (session.group.get() ?? '') : ''
  const year = isHydrated ? (session.year.get() ?? '') : ''
  const program = isHydrated ? (session.program.get() ?? '') : ''
  const [subjects, setSubjects] = useState<string[]>([])
  // Obavezan ili izborni za modul ove grupe (v. subjectStatus u efektu ispod).
  const [status, setStatus] = useState<Record<string, 'obavezan' | 'izborni' | 'nepoznat'>>({})
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [semester, setSemester] = useState<string>('')
  // FON još nije objavio raspored nekog izbornog bloka za modul ove grupe.
  const [electivesPending, setElectivesPending] = useState(false)
  const [loadError, setLoadError] = useState(false)

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

    // Sinhrono čitanje - persist-efekat za otherSelected piše pre nego što
    // fetch stigne, pa bi async čitanje videlo već pregaženu vrednost.
    const savedSubjects = byGroup.subjects(group).get()
    const hadSavedSubjects = Object.keys(savedSubjects).length > 0
    const savedOther = byGroup.otherSem(group).get()

    Promise.all([
      fetch(`/data/${year}god.json`).then(r => { if (!r.ok) throw new Error('http'); return r.json() }),
      fetch('/data/subjects-meta.json').then(r => r.ok ? r.json() : {}).catch(() => ({})),
      fetch('/data/plan.json').then(r => r.ok ? r.json() : {}).catch(() => ({})),
    ])
      .then(([data, meta, plan]: [SemesterData, Record<string, SubjectMeta>, StudyPlan]) => {
        setSemester(data.semester)
        // Modul iz sesije je precizniji od programa grupe ("ISiT" u zimskom 2. i
        // 3. godine), pa ima prednost kad ga plan zna.
        const groupProgram = plan && typeof plan === 'object' && program in plan
          ? program
          : data.groups[group]?.program
        const entries = getScheduleForGroup(data, group)
        const unique = [...new Set(entries.map(e => e.subject))].sort()
        setSubjects(unique)

        // Plan modula (plan.json) je tačan za baš ovaj modul i semestar. Status
        // sa stranice predmeta (subjects-meta.json) je samo rezerva za predmete
        // kojih nema u planu, jer ne zna za modul.
        const semKey = semesterKey(data.semester)
        const tr = programToTrack(program)
        const subjectStatus = (s: string): 'obavezan' | 'izborni' | 'nepoznat' => {
          const fromPlan = groupProgram && semKey && plan && typeof plan === 'object'
            ? planStatus(plan, groupProgram, Number(year), semKey, s)
            : null
          if (fromPlan) return fromPlan
          const metaStatus = meta?.[s]?.status
          if (!metaStatus) return 'nepoznat'
          return defaultChecked(metaStatus, tr) ? 'obavezan' : 'izborni'
        }
        const st = Object.fromEntries(unique.map(s => [s, subjectStatus(s)]))
        setStatus(st)
        if (groupProgram && semKey && plan && typeof plan === 'object') {
          setElectivesPending(hasUnpublishedElectives(plan, groupProgram, Number(year), semKey, unique))
        }

        // Prevrtanje semestra: sačuvani izbori se odnose na predmete starog
        // semestra - reconcileSemester ih resetuje da rokovi filter ne sakrije
        // nove predmete. (Isti helper koristi i raspored za "Nov semestar" popup.)
        const flipped = reconcileSemester(data.semester, group)

        if (!flipped && hadSavedSubjects) {
          // Predmeti dodati posle poslednjeg izbora (dopuna rasporeda) dobijaju
          // isti početni izbor kao pri prvom biranju: čekirani samo obavezni.
          const merged = { ...savedSubjects }
          unique.forEach(s => { if (!(s in merged)) merged[s] = st[s] === 'obavezan' })
          setChecked(merged)
        } else {
          // Pametan default: čekirani su samo predmeti za koje znamo da su
          // obavezni. Izborni i nepoznati su odčekirani, pa student sam čekira
          // šta sluša.
          setChecked(Object.fromEntries(unique.map(s => [s, st[s] === 'obavezan'])))
        }

        if (!flipped && savedOther.length > 0) setOtherSelected(savedOther)
      })
      // Bez ovoga offline ostavlja stranicu trajno u skeleton stanju.
      .catch(() => setLoadError(true))

    const savedPrev = byGroup.prevSubjects(group).get()
    if (savedPrev.length > 0) {
      queueMicrotask(() => setPrevSelected(savedPrev))
    }
  }, [group, isHydrated, router, year, program])

  useEffect(() => {
    if (!isHydrated || !group) return
    byGroup.prevSubjects(group).set(prevSelected)
  }, [prevSelected, isHydrated, group])

  useEffect(() => {
    if (!isHydrated || !group) return
    byGroup.otherSem(group).set(otherSelected)
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
    byGroup.subjects(group).set(checked)
    // Akumuliraj izbor po semestru - mešani Sep/Okt rokovi uniraju oba semestra.
    if (semester) {
      const hist = app.subjectsHistory.get()
      hist[semester] = Object.entries(checked).filter(([, v]) => v).map(([k]) => k)
      // Orezivanje: čuvaj samo tekuću i prošlu školsku godinu ("Letnji 2025/26" -> 2025).
      // Prošla mora da ostane - Sep/Okt rok pripada staroj školskoj godini.
      const ayStart = (s: string) => parseInt(s.match(/(\d{4})\/\d{2}/)?.[1] ?? '', 10)
      const current = ayStart(semester)
      if (!Number.isNaN(current)) {
        for (const key of Object.keys(hist)) {
          const y = ayStart(key)
          if (Number.isNaN(y) || y < current - 1) delete hist[key]
        }
      }
      app.subjectsHistory.set(hist)
    }
    router.push('/raspored')
  }

  function handlePrevGodina(g: number) {
    setPrevGodina(g)
    setPrevSearch('')
    setPrevPredmeti([])
    setPrevLoading(true)
    fetchYearBothSemesters(g)
      .then(entries => {
        const unique = [...new Set(entries.map(e => e.subject))].sort()
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
  // Predmet iz prošlih/drugog semestra se broji kao validan izbor i bez
  // ijednog čekiranog tekućeg predmeta (npr. sve položio, ostao mu samo
  // predmet iz zimskog za septembarski rok).
  const hasAnySelection = checkedCount > 0 || prevSelected.length > 0 || otherSelected.length > 0
  const filteredPrev = prevPredmeti.filter(p =>
    p.toLowerCase().includes(prevSearch.toLowerCase())
  )

  // "izborni" tag ima smisla samo kad status razlikuje obavezne od izbornih za
  // ovaj smer. Kad je sve izborno (fini moduli 4. godine), tag bi stajao na
  // svakom predmetu, pa ga tada nema, a podnaslov to kaže.
  const smartMode = subjects.some(s => status[s] === 'obavezan')
  // "Svi su izborni" samo kad to stvarno piše za svaki predmet, a ne kad meta
  // podataka nema (novi predmeti pre scrape-a).
  const allElective = subjects.length > 0 && subjects.every(s => status[s] === 'izborni')

  if (loadError) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-8">
        <OfflineNotice />
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8">
      {/* Ulazi zdesna, kao sledeći korak posle početne (koja odlazi ulevo). */}
      <div className={`enter-right w-full max-w-md rounded-[1.75rem] p-8 shadow-[0_18px_60px_rgba(2,76,125,0.10)] dark:shadow-[0_18px_60px_rgba(0,0,0,0.35)] ${GLASS}`}>

        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Tvoji predmeti</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {smartMode
              ? 'Obavezni su već čekirani - čekiraj izborne koje slušaš'
              : allElective
                ? 'Na ovom modulu su svi predmeti izborni - čekiraj one koje slušaš'
                : 'Čekiraj predmete koje slušaš'}
          </p>
          {electivesPending && (
            <p className="mt-3 rounded-xl bg-amber-100/70 px-3 py-2 text-xs text-pretty text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
              Raspored izbornih predmeta za tvoj modul još nije objavljen. Kad FON dopuni raspored, stiže ti notifikacija i ovde ih biraš.
            </p>
          )}
        </div>

        <div className="space-y-1 mb-4 max-h-72 overflow-y-auto">
          {subjects.map((subject, i) => (
            // Predmeti se pojave jedan za drugim, pošto kartica skoro uđe.
            <label
              key={subject}
              style={stagger(i, 35, 10, 150)}
              className="anim-up flex items-center gap-3 rounded-xl px-2 py-2.5
                         hover:bg-white/70 dark:hover:bg-gray-800/60 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={checked[subject] ?? true}
                onChange={() => toggle(subject)}
                className="w-4 h-4 rounded accent-[#024c7d] dark:accent-[#60c3ad] shrink-0"
              />
              <span className={`flex-1 text-sm ${checked[subject] ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500 line-through'}`}>
                {subject}
              </span>
              {smartMode && status[subject] === 'izborni' && (
                <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  izborni
                </span>
              )}
            </label>
          ))}
        </div>

        {/* Dodatni predmeti: iz prošlih godina i iz drugog semestra */}
        <div className="mb-6 space-y-2.5">
          <Collapsible
            open={prevOpen}
            onToggle={() => setPrevOpen(v => !v)}
            title="Predmeti iz prošlih godina"
            count={prevSelected.length}
          >
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Termine za predmete iz prethodnih godina dodaješ u tabu{' '}
              <span className="font-medium text-gray-600 dark:text-gray-300">Izmena termina</span>.
            </p>

            {/* Segmentirani izbor godine; bela podloga klizi do izabrane. */}
            <div role="group" aria-label="Godina" className="grid grid-cols-4 gap-1 rounded-xl bg-gray-900/5 p-1 dark:bg-white/5">
              {[1, 2, 3, 4].map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => handlePrevGodina(g)}
                  aria-pressed={prevGodina === g}
                  className={`no-hover-lift relative rounded-lg py-1.5 text-xs font-medium transition-colors ${
                    prevGodina === g
                      ? 'text-[#024c7d] dark:text-[#60c3ad]'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  {prevGodina === g && (
                    <motion.span
                      layoutId="prev-godina"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      className="absolute inset-0 rounded-lg bg-white shadow-sm dark:bg-gray-700/80"
                    />
                  )}
                  <span className="relative">{g}. god</span>
                </button>
              ))}
            </div>

            {prevGodina && (
              <>
                <SearchField value={prevSearch} onChange={setPrevSearch} />
                {prevLoading ? (
                  <div className="space-y-1.5">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="h-8 rounded-xl bg-white/60 dark:bg-gray-800/68 animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <SubjectList
                    items={filteredPrev}
                    query={prevSearch}
                    isChecked={p => prevSelected.some(s => s.year === prevGodina && s.subject === p)}
                    onToggle={p => togglePrevSubject(prevGodina, p)}
                  />
                )}
              </>
            )}

            <SelectedChips
              items={prevSelected.map(s => ({
                key: `${s.year}-${s.subject}`,
                label: `${s.year}. · ${s.subject}`,
                onRemove: () => togglePrevSubject(s.year, s.subject),
              }))}
            />
          </Collapsible>

          {/* Predmeti iz drugog semestra - prikaži SAMO u letnjem semestru.
              Mešani Sep/Okt rok uvek padne u letnjem i traži zimske predmete
              (ponavljanja); u zimskom je picker suvišan i samo zbunjuje. */}
          {semester.toLowerCase().startsWith('letnji') && (
            <Collapsible
              open={otherOpen}
              onToggle={() => { setOtherOpen(v => !v); loadOtherSemester() }}
              title={`Predmeti iz ${otherSemLabel} semestra`}
              count={otherSelected.length}
            >
              <p className="text-xs text-gray-400 dark:text-gray-500">
                U septembarskom i oktobarskom roku ima predmeta iz oba semestra.
                Štikliraj one iz {otherSemLabel} semestra koje polažeš da bi im video termine.
              </p>

              {otherLoading ? (
                <div className="space-y-1.5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="h-8 rounded-xl bg-white/60 dark:bg-gray-800/68 animate-pulse" />
                  ))}
                </div>
              ) : otherLoaded && otherSubjects.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                  Raspored {otherSemLabel} semestra još nije dostupan.
                </p>
              ) : (
                <>
                  <SearchField value={otherSearch} onChange={setOtherSearch} />
                  <SubjectList
                    items={otherSubjects.filter(p => p.toLowerCase().includes(otherSearch.toLowerCase()))}
                    query={otherSearch}
                    isChecked={p => otherSelected.includes(p)}
                    onToggle={toggleOtherSubject}
                  />
                </>
              )}

              <SelectedChips
                items={otherSelected.map(s => ({ key: s, label: s, onRemove: () => toggleOtherSubject(s) }))}
              />
            </Collapsible>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <span className="text-xs text-gray-400 dark:text-gray-500 w-full sm:w-auto text-center sm:text-left">
            {checkedCount} od {subjects.length} predmeta
          </span>
          <div className="flex w-full sm:w-auto items-stretch gap-2">
            <button
              onClick={() => { savedStore.group.remove(); session.group.remove(); router.push('/') }}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 ${GLASS} hover:bg-white/80 dark:hover:bg-gray-800/70 transition-colors`}
            >
              <IconBack className="h-4 w-4 opacity-80" />
              Podaci
            </button>
            <button
              onClick={handleConfirm}
              disabled={!hasAnySelection}
              className={`btn-lift flex-[2] sm:flex-none flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium
                ${hasAnySelection
                  ? 'bg-[#024c7d] text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0]'
                  : 'bg-white/60 text-gray-400 cursor-not-allowed dark:bg-gray-800/68 dark:text-gray-500'}`}
            >
              Gotovo
              <IconForward className="h-4 w-4 opacity-80" />
            </button>
          </div>
        </div>

      </div>
    </main>
  )
}
