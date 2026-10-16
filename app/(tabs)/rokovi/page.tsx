'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSwipeable } from 'react-swipeable'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { RokData, RokEntry, CustomRokEntry } from '@/lib/types'
import { session, app, byGroup } from '@/lib/storage'
import { useIsDark, useIsHydrated, toggleTheme } from '@/lib/theme'
import { formatDateSr, getDaySr, SR_MONTHS, SR_DAYS_SHORT, cap } from '@/lib/date'
import {
  COLORS, FILTER_NAZIV, aktivniRokovi, buildColorMap, eventTypeLabel, napraviICS, odgovaraFilteru,
  opisVrste, poDatumu, predmetiStudenta, rokEntryKey, skriveniTermini, type Filter, type Termin,
} from '@/lib/rokovi'
import { slikaRokova, meseciSaTerminima, type IzborSlike } from '@/lib/rokSlika'
import { pickPrijavaPovod, SVI_POVODI, POVOD_NASLOV, type PrijavaPovod } from '@/lib/prijavaBanner'
import NotificationBell from '@/components/NotificationBell'
import FeedbackButton from '@/components/FeedbackButton'
import OfflineNotice from '@/components/OfflineNotice'
import { canvasToFile, shareOrDownloadFile } from '@/lib/shareOrDownload'
import { motion } from 'motion/react'
import Modal from '@/components/Modal'
import Expand from '@/components/Expand'
import Toast from '@/components/Toast'
import { IconHidden, IconIzvoz } from '@/components/Ikone'
import Popover, { POPOVER_STAVKA } from '@/components/Popover'
import { stagger } from '@/lib/stagger'
import { dayStyle, dayBadge, DAY_KIND_STYLE, type ActivityCalendar, type CalendarDay } from '@/lib/kalendar'

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
const IconForward = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
)
const IconMoon = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
)
const IconSun = (p: IconProps) => (
  <svg {...baseIcon(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
)
const IconExternal = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
)
const IconCalendar = (p: IconProps) => (
  <svg {...baseIcon(p)}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
)
// Izvoz u kalendar - isti okvir kao IconCalendar, ali sa strelicom nadole.
// Namerno različita od IconCalendar (koja je prikaz „Kalendar"), jer su stajale
// jedna do druge i izgledale kao isto dugme.
const IconCalendarExport = (p: IconProps) => (
  <svg {...baseIcon(p)}>
    <path d="M21 11V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" />
    <path d="M16 2v4M8 2v4M3 10h18" />
    <path d="M17 14v6M14.5 17.5 17 20l2.5-2.5" />
  </svg>
)
const IconList = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
)
const IconImage = (p: IconProps) => (
  <svg {...baseIcon(p)}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-4.5-4.5L5 21" /></svg>
)
const IconFilter = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M4 7h16M7 12h10M10 17h4" /></svg>
)
const IconCheck = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="m5 12 5 5 9-10" /></svg>
)
const IconPlus = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M12 5v14M5 12h14" /></svg>
)
const IconEdit = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
)
const IconSchedule = (p: IconProps) => (
  <svg {...baseIcon(p)}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4M7.5 13h4M7.5 17h7" /></svg>
)
const IconExam = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" /></svg>
)

function SwipeableListItem({ onHide, children }: { onHide: () => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const handlers = useSwipeable({
    onSwipedLeft: () => setOpen(true),
    onSwipedRight: () => setOpen(false),
    preventScrollOnSwipe: true,
    trackMouse: false,
  })
  return (
    <div className="relative overflow-hidden rounded-2xl sm:overflow-visible">
      <div
        className="absolute inset-y-0 right-0 flex w-16 items-center justify-center sm:hidden transition-opacity duration-200"
        style={{ opacity: open ? 1 : 0 }}
      >
        <button
          onClick={() => { onHide(); setOpen(false) }}
          className="flex h-9 w-9 items-center justify-center rounded-full
                     text-red-500 bg-red-50 dark:bg-red-950/60 dark:text-red-400
                     hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors"
          aria-label="Sakrij termin"
        >
          ✕
        </button>
      </div>
      <div
        {...handlers}
        className="transition-transform duration-200 sm:transform-none"
        style={{ transform: open ? 'translateX(-64px)' : 'translateX(0)' }}
      >
        {children}
      </div>
    </div>
  )
}

type EventModalState =
  | { mode: 'add'; date?: string }
  | { mode: 'edit'; entry: CustomRokEntry }

const EVENT_TYPES = ['P', 'U', 'Kolokvijum', 'Ostalo'] as const

const FILTER_MENI: Record<Filter, string> = { sve: 'Sve', ispiti: 'Samo ispiti', kolokvijumi: 'Samo kolokvijumi' }

const FON_STRANE = [
  { naziv: 'Raspored ispita', href: 'https://oas.fon.bg.ac.rs/raspored-ispita/' },
  { naziv: 'Raspored kolokvijuma', href: 'https://oas.fon.bg.ac.rs/raspored-kolokvijuma/' },
]

export default function RokoviPage() {
  const router = useRouter()
  const [allRokovi, setAllRokovi] = useState<RokData[]>([])
  // FON kalendar aktivnosti: boje dana (ispitni rok, kolokvijumi, neradni...).
  const [activityDays, setActivityDays] = useState<Record<string, CalendarDay>>({})
  // Podaci se nisu učitali (offline i nikad keširano) - razlikuje se od
  // "nema zakazanih rokova", pa ne sme da deli isti prazan prikaz.
  const [loadError, setLoadError] = useState(false)
  // Izbor iz ove posete; dok ga nema, važi zapamćeni sa prethodne (storage).
  const [manualFilter, setManualFilter] = useState<Filter | null>(null)
  const [manualView, setManualView] = useState<'list' | 'calendar' | null>(null)
  const [fonMeni, setFonMeni] = useState(false)
  const [filterMeni, setFilterMeni] = useState(false)
  const [izvozMeni, setIzvozMeni] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  // Smer poslednje promene meseca u kalendaru (-1 nazad, 1 napred, 0 bez
  // animacije). Vraća se na 0 posle animacije: CalendarView se montira iznova
  // na svaki render, pa bi inače svaki klik na dan ponovo pokrenuo klizanje.
  const [monthDir, setMonthDir] = useState(0)
  useEffect(() => {
    if (!monthDir) return
    const t = setTimeout(() => setMonthDir(0), 350)
    return () => clearTimeout(t)
  }, [monthDir, calendarMonth])
  function goMonth(dir: -1 | 1) {
    setMonthDir(dir)
    setCalendarMonth(prev => {
      const d = new Date(prev.year, prev.month + dir)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }
  // Prevlačenje po kalendaru menja mesec, kao strelice. Samo dodir, i samo
  // vodoravno: uspravno skrolovanje stranice ostaje netaknuto.
  const monthSwipe = useSwipeable({
    onSwipedLeft: () => goMonth(1),
    onSwipedRight: () => goMonth(-1),
    delta: 40,
    preventScrollOnSwipe: true,
    trackMouse: false,
  })
  const [tooltip, setTooltip] = useState<{ date: string } | null>(null)
  // Ključevi su `rok|povod`.
  const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(new Set())
  // Snimak "prvi put viđeno" u trenutku montiranja. Mora da bude zamrznut: efekat
  // ispod odmah upiše zatečene rokove, pa bi svako naredno čitanje reklo da nema
  // ničeg novog i baner "novo" se ne bi prikazao nijednom.
  const [seenSnapshot] = useState<Record<string, string>>(() => app.rokFirstSeen.get())
  const [hiddenEntries, setHiddenEntries] = useState<RokEntry[]>([])
  const [showHidden, setShowHidden] = useState(false)
  const [downloadToast, setDownloadToast] = useState(false)
  const [imageToast, setImageToast] = useState(false)
  const [showImageMenu, setShowImageMenu] = useState(false)
  const [customEntries, setCustomEntries] = useState<CustomRokEntry[]>([])
  const [eventModal, setEventModal] = useState<EventModalState | null>(null)

  const isDark = useIsDark()
  const isHydrated = useIsHydrated()

  // Prikaz i filter ostaju kakvi su bili pri prošlom ulasku (prvi put:
  // Kalendar i Sve).
  const view: 'list' | 'calendar' = manualView ?? (isHydrated ? app.rokoviPrikaz.get() : 'calendar')
  const filter: Filter = manualFilter ?? (isHydrated ? app.rokoviFilter.get() : 'sve')
  function izaberiPrikaz(v: 'list' | 'calendar') {
    setManualView(v)
    app.rokoviPrikaz.set(v)
  }
  function izaberiFilter(f: Filter) {
    setManualFilter(f)
    app.rokoviFilter.set(f)
    setTooltip(null)
    setFilterMeni(false)
  }

  // Stavke liste ulaze jedna za drugom samo prvi put kad se lista prikaže.
  // ListView je definisan unutar strane pa se montira iznova na svaki render,
  // i bez ovog prekidača bi se animacija ponavljala na svaku promenu stanja.
  const [listIntroDone, setListIntroDone] = useState(false)
  useEffect(() => {
    if (view !== 'list' || !isHydrated || listIntroDone) return
    const t = setTimeout(() => setListIntroDone(true), 1000)
    return () => clearTimeout(t)
  }, [view, isHydrated, listIntroDone])

  const meta = isHydrated
    ? {
        group: session.group.get() ?? '',
        year: session.year.get() ?? '',
        program: session.program.get() ?? '',
        semester: session.semester.get() ?? '',
      }
    : { group: '', year: '', program: '', semester: '' }

  // Bez kalendara (offline, fajl ne stigne) dani su samo bez boje.
  useEffect(() => {
    if (!isHydrated) return
    fetch('/data/kalendar.json')
      .then(r => (r.ok ? r.json() : null))
      .then((d: ActivityCalendar | null) => { if (d?.dani) setActivityDays(d.dani) })
      .catch(() => {})
  }, [isHydrated])

  useEffect(() => {
    if (!isHydrated) return
    fetch('/data/rokovi.json')
      .then(r => { if (!r.ok) throw new Error('http'); return r.json() })
      .then((d: RokData[]) => {
        const data = Array.isArray(d) ? d : []
        setAllRokovi(data)
        setLoadError(false)
        // Ključ je rok + povod, pa odbacivanje jednog podsetnika ne guta i one
        // kasnije (npr. "poslednji dan prijave").
        const dismissed = new Set<string>()
        for (const r of data) {
          for (const povod of SVI_POVODI) {
            if (app.dismissedPrijava(r.rok, povod).get()) dismissed.add(`${r.rok}|${povod}`)
          }
        }
        setDismissedBanners(dismissed)
      })
      // Prazan niz sam po sebi renderuje "Nema podataka za prikaz", što se ne
      // razlikuje od "nema zakazanih ispita" - zato zaseban loadError.
      .catch(() => { setAllRokovi([]); setLoadError(true) })
  }, [isHydrated])

  const userSubjects = isHydrated && meta.group ? predmetiStudenta(meta.group) : null

  const hiddenKeys = useMemo(() => new Set(hiddenEntries.map(rokEntryKey)), [hiddenEntries])

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])

  useEffect(() => {
    if (!isHydrated || !meta.group) { setHiddenEntries([]); return }
    setHiddenEntries(skriveniTermini(meta.group, todayStr))
  }, [isHydrated, meta.group, todayStr])

  function hideEntry(e: RokEntry) {
    if (hiddenKeys.has(rokEntryKey(e))) return
    const next = [...hiddenEntries, e]
    setHiddenEntries(next)
    byGroup.rokHidden(meta.group).set(next)
  }

  function restoreEntry(e: RokEntry) {
    const key = rokEntryKey(e)
    const next = hiddenEntries.filter(h => rokEntryKey(h) !== key)
    setHiddenEntries(next)
    byGroup.rokHidden(meta.group).set(next)
  }

  // Korisnikovi sopstveni unosi (nisu sa FON sajta) - učitaju se po grupi.
  useEffect(() => {
    if (!isHydrated || !meta.group) { setCustomEntries([]); return }
    setCustomEntries(byGroup.customRokovi(meta.group).get())
  }, [isHydrated, meta.group])

  function saveCustomEntry(entry: CustomRokEntry) {
    const exists = customEntries.some(e => e.id === entry.id)
    const next = exists ? customEntries.map(e => (e.id === entry.id ? entry : e)) : [...customEntries, entry]
    setCustomEntries(next)
    byGroup.customRokovi(meta.group).set(next)
    setEventModal(null)
  }

  function deleteCustomEntry(id: string) {
    const next = customEntries.filter(e => e.id !== id)
    setCustomEntries(next)
    byGroup.customRokovi(meta.group).set(next)
    setEventModal(null)
  }

  function filterEntries(entries: RokEntry[]): RokEntry[] {
    return entries.filter(e => {
      if (e.date < todayStr) return false
      if (userSubjects && !userSubjects.has(e.subject)) return false
      if (hiddenKeys.has(rokEntryKey(e))) return false
      return true
    })
  }

  const activeRokovi = useMemo(() => aktivniRokovi(allRokovi, filter, todayStr), [allRokovi, filter, todayStr])

  // Sopstveni događaji se vide uvek, bez obzira na filter: student ih je sam dodao.
  const mojiDogadjaji = useMemo(
    () => customEntries.filter(e => e.date >= todayStr),
    [customEntries, todayStr]
  )

  const allFilteredEntries: Termin[] = useMemo(
    () => [...activeRokovi.flatMap(r => filterEntries(r.entries).map(e => ({ ...e, tip: r.tip }))), ...mojiDogadjaji],
    [activeRokovi, userSubjects, hiddenKeys, mojiDogadjaji] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const imeFajla = filter === 'sve' ? 'rokovi' : filter

  function downloadICS() {
    if (!allFilteredEntries.length) return
    const blob = new Blob([napraviICS(allFilteredEntries)], { type: 'text/calendar;charset=utf-8' })
    const link = document.createElement('a')
    link.download = `${imeFajla}-${meta.group}.ics`
    link.href = URL.createObjectURL(blob)
    link.click()
    setDownloadToast(true)
    setTimeout(() => setDownloadToast(false), 3500)
  }

  // Izvoz kao PNG: jedan mesec ili ceo rok (v. lib/rokSlika).
  async function downloadRokImage(izbor: IzborSlike) {
    const ident = `${meta.program ? `${meta.program} · ` : ''}Grupa ${meta.group}`
    const slika = slikaRokova(allFilteredEntries, izbor, { naslov: FILTER_NAZIV[filter], ident, colorMap })
    if (!slika) return
    const file = await canvasToFile(slika.canvas, `${imeFajla}-${slika.ime}-${meta.group}.png`)
    await shareOrDownloadFile(file, FILTER_NAZIV[filter])
    setImageToast(true)
    setTimeout(() => setImageToast(false), 3500)
  }

  const colorMap = useMemo(() => buildColorMap(allFilteredEntries), [allFilteredEntries])

  const imageMonths = useMemo(() => meseciSaTerminima(allFilteredEntries), [allFilteredEntries])

  // Baner prijave se ranije prikazivao sve dok prijava ne prođe, pa je iskakao
  // pri svakom otvaranju aplikacije. Sad ima četiri povoda i van njih ćuti.
  const prijavaNotice = useMemo(() => {
    // Prazan snimak = korisnik koji je aplikaciju koristio i pre ove logike.
    // Njemu svi zatečeni rokovi nisu "novi", inače bi mu baner iskočio za sve odjednom.
    const prviPut = Object.keys(seenSnapshot).length === 0

    for (const r of allRokovi) {
      if (!odgovaraFilteru(r.tip, filter)) continue
      const povod = pickPrijavaPovod({
        prijavaDatumi: r.prijava_datumi,
        todayStr,
        jeNov: !(r.rok in seenSnapshot) && !prviPut,
      })
      if (!povod) continue
      if (dismissedBanners.has(`${r.rok}|${povod}`)) continue

      return { rok: r, povod }
    }
    return null
  }, [allRokovi, filter, todayStr, seenSnapshot, dismissedBanners])

  // Upis "prvi put viđeno" ide u efekat, ne u memo - memo sme samo da čita.
  useEffect(() => {
    if (!allRokovi.length) return
    const seen = app.rokFirstSeen.get()
    let promenjeno = false
    for (const r of allRokovi) {
      if (!r.prijava_datumi?.length || r.rok in seen) continue
      seen[r.rok] = todayStr
      promenjeno = true
    }
    if (promenjeno) app.rokFirstSeen.set(seen)
  }, [allRokovi, todayStr])

  function dismissBanner(rok: string, povod: PrijavaPovod) {
    setDismissedBanners(prev => new Set([...prev, `${rok}|${povod}`]))
    app.dismissedPrijava(rok, povod).set()
  }

  const byDate = useMemo(() => {
    const map: Record<string, Termin[]> = {}
    for (const e of allFilteredEntries) {
      if (!e.date) continue
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    }
    return map
  }, [allFilteredEntries])

  const isEmpty = activeRokovi.length === 0 && mojiDogadjaji.length === 0

  // Raspored/Rokovi - ravnopravan prekidač na desktopu (bez "nazad" hijerarhije)
  const pageSwitch = [
    { key: 'raspored', label: 'Raspored', Icon: IconSchedule, active: false, onClick: () => router.push('/raspored') },
    { key: 'rokovi', label: 'Rokovi', Icon: IconExam, active: true, onClick: () => {} },
  ] as const

  // Dugmad u traci: na telefonu okrugla ikonica, na računaru ikonica i naziv.
  const dugme = (saNazivom: boolean, aktivan = false) => saNazivom
    ? `inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed
       ${aktivan ? 'bg-[#024c7d]/10 text-[#024c7d] dark:bg-[#60c3ad]/15 dark:text-[#60c3ad]' : `text-gray-600 dark:text-gray-300 ${GLASS} hover:bg-white/80 dark:hover:bg-gray-800/70`}`
    : `flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed
       ${aktivan ? 'bg-[#024c7d] text-white dark:bg-[#60c3ad] dark:text-[#024c7d]' : `text-gray-600 dark:text-gray-300 ${GLASS} hover:bg-white/80 dark:hover:bg-gray-800/70`}`
  const ikona = (saNazivom: boolean) => (saNazivom ? 'h-4 w-4 opacity-80' : 'h-[18px] w-[18px]')

  // Šta se vidi: vrsta rokova i skriveni termini. Kad nešto nije prikazano,
  // dugme je obojeno.
  function FilterDugme({ saNazivom = false }: { saNazivom?: boolean }) {
    const aktivan = filter !== 'sve'
    return (
      <div className="relative">
        <button
          onClick={() => setFilterMeni(o => !o)}
          aria-expanded={filterMeni}
          aria-label={`Filter: ${FILTER_MENI[filter]}`}
          className={dugme(saNazivom, aktivan)}
        >
          <IconFilter className={ikona(saNazivom)} />
          {saNazivom && (aktivan ? FILTER_NAZIV[filter] : 'Filter')}
        </button>
        <Popover open={filterMeni} onClose={() => setFilterMeni(false)}>
          {(Object.keys(FILTER_MENI) as Filter[]).map(f => (
            <button key={f} onClick={() => izaberiFilter(f)} className={POPOVER_STAVKA}>
              {FILTER_MENI[f]}
              {filter === f && <IconCheck className="h-4 w-4 text-[#024c7d] dark:text-[#60c3ad]" />}
            </button>
          ))}
          {hiddenEntries.length > 0 && (
            <>
              <div className="mx-2 my-1 h-px bg-gray-200 dark:bg-gray-700" />
              <button onClick={() => { setShowHidden(o => !o); setFilterMeni(false) }} className={POPOVER_STAVKA}>
                Skriveni termini ({hiddenEntries.length})
                <IconHidden className="h-4 w-4 opacity-50" />
              </button>
            </>
          )}
        </Popover>
      </div>
    )
  }

  // Slika i kalendar su oba izvoz, pa su jedno dugme.
  function IzvozDugme({ saNazivom = false }: { saNazivom?: boolean }) {
    return (
      <div className="relative">
        <button
          onClick={() => setIzvozMeni(o => !o)}
          disabled={allFilteredEntries.length === 0}
          aria-expanded={izvozMeni}
          aria-label="Izvezi"
          className={dugme(saNazivom)}
        >
          <IconIzvoz className={ikona(saNazivom)} />
          {saNazivom && 'Izvezi'}
        </button>
        <Popover open={izvozMeni} onClose={() => setIzvozMeni(false)}>
          <button onClick={() => { setIzvozMeni(false); setShowImageMenu(true) }} className={POPOVER_STAVKA}>
            Sačuvaj kao sliku
            <IconImage className="h-4 w-4 opacity-50" />
          </button>
          <button onClick={() => { setIzvozMeni(false); downloadICS() }} className={POPOVER_STAVKA}>
            Dodaj u kalendar
            <IconCalendarExport className="h-4 w-4 opacity-50" />
          </button>
        </Popover>
      </div>
    )
  }

  function ActionButtons() {
    return (
      <>
        <FilterDugme saNazivom />
        <button onClick={() => setEventModal({ mode: 'add' })} className={dugme(true)}>
          <IconPlus className={ikona(true)} />
          Dodaj
        </button>
        <IzvozDugme saNazivom />
      </>
    )
  }

  // --- Lista view ---
  function ListView() {
    const groups = [
      ...activeRokovi.map(r => ({ label: r.rok, entries: filterEntries(r.entries).map(e => ({ ...e, tip: r.tip })).sort(poDatumu) as Termin[] })),
      { label: 'Moji događaji', entries: [...mojiDogadjaji].sort(poDatumu) as Termin[] },
    ].filter(g => g.entries.length > 0)

    if (!groups.length) {
      return <EmptyState />
    }

    return (
      <div className="space-y-8">
        {groups.map(g => (
          <div key={g.label}>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap">
                {g.label}
              </h2>
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
            </div>
            <div className="space-y-3">
              {Object.entries(
                g.entries.reduce((acc, e) => {
                  if (!acc[e.date]) acc[e.date] = []
                  acc[e.date].push(e)
                  return acc
                }, {} as Record<string, typeof g.entries>)
              ).map(([date, dateEntries], di) => (
                <div
                  key={date}
                  className={listIntroDone ? undefined : 'anim-up'}
                  style={listIntroDone ? undefined : stagger(di, 45)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {getDaySr(date)}, {formatDateSr(date)}
                    </span>
                    <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                  </div>
                  {dateEntries.map((e, i) => {
                    const c = COLORS[colorMap[e.subject]]
                    const isCustom = 'custom' in e && e.custom
                    const vrsta = opisVrste(e)
                    const row = (
                      <div
                        onClick={isCustom ? () => setEventModal({ mode: 'edit', entry: e as CustomRokEntry }) : undefined}
                        className={`flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0 ${isCustom ? 'cursor-pointer' : ''}`}
                      >
                        <span className="text-xs text-gray-400 dark:text-gray-500 w-10 text-right shrink-0">{e.start}</span>
                        <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: c.bar }} />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-gray-900 dark:text-gray-100 block truncate">{e.subject}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {e.rooms.join(', ')}
                            {e.note ? ` · ${e.note}` : ''}
                          </span>
                        </div>
                        {vrsta && (
                          <span
                            style={{ background: isDark ? c.darkBg : c.bg, color: isDark ? c.darkText : c.text }}
                            className="text-xs font-medium px-2 py-0.5 rounded-md shrink-0"
                          >
                            {vrsta}
                          </span>
                        )}
                        <button
                          onClick={ev => {
                            if (isCustom) {
                              ev.stopPropagation()
                              setEventModal({ mode: 'edit', entry: e as CustomRokEntry })
                            } else {
                              hideEntry(e)
                            }
                          }}
                          className={`${isCustom ? 'flex' : 'hidden sm:flex'} w-6 h-6 items-center justify-center rounded-md text-gray-300 dark:text-gray-600 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-400 transition-colors shrink-0 text-xs`}
                          aria-label={isCustom ? 'Izmeni događaj' : 'Sakrij termin'}
                        >
                          {isCustom ? <IconEdit className="h-3.5 w-3.5" /> : '✕'}
                        </button>
                      </div>
                    )
                    return isCustom
                      ? <div key={i}>{row}</div>
                      : <SwipeableListItem key={i} onHide={() => hideEntry(e)}>{row}</SwipeableListItem>
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // --- Kalendar view ---
  // Legenda boja iz FON kalendara aktivnosti, samo za vrste dana kojih ima u
  // prikazanom mesecu.
  function ActivityLegend({ year, month, days }: { year: number; month: number; days: Record<string, CalendarDay> }) {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`
    const present = new Set(
      Object.entries(days).filter(([d]) => d.startsWith(prefix)).map(([, v]) => v.tip)
    )
    const kinds = (Object.keys(DAY_KIND_STYLE) as (keyof typeof DAY_KIND_STYLE)[]).filter(k => present.has(k))
    if (kinds.length === 0) return null
    return (
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-gray-500 dark:text-gray-400">
        {kinds.map(k => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${DAY_KIND_STYLE[k].dot}`} />
            {DAY_KIND_STYLE[k].label}
          </span>
        ))}
        <a
          href="https://oas.fon.bg.ac.rs/kalendar-aktivnosti/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#024c7d]/80 hover:underline dark:text-[#60c3ad]/80"
        >
          FON kalendar
        </a>
      </div>
    )
  }

  function CalendarView() {
    const { year, month } = calendarMonth
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const startOffset = (firstDay + 6) % 7

    const cells: (number | null)[] = [
      ...Array(startOffset).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ]
    while (cells.length % 7 !== 0) cells.push(null)

    const weeks: (number | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

    // Kalendar ostaje interaktivan i kad nema rokova - klik na prazan dan
    // dodaje sopstveni događaj, pa nema razloga da se zameni EmptyState-om.
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => goMonth(-1)}
            aria-label="Prethodni mesec"
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 ${GLASS} hover:bg-white/80 dark:hover:bg-gray-800/70 transition-colors`}
          ><IconBack className="h-4 w-4" /></button>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 capitalize">
            {SR_MONTHS[month]} {year}
          </h3>
          <button
            onClick={() => goMonth(1)}
            aria-label="Sledeći mesec"
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 ${GLASS} hover:bg-white/80 dark:hover:bg-gray-800/70 transition-colors`}
          ><IconForward className="h-4 w-4" /></button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1 sm:gap-1.5">
          {SR_DAYS_SHORT.map(d => (
            <div key={d} className="text-center text-xs text-gray-400 dark:text-gray-500 py-1 font-medium">{d}</div>
          ))}
        </div>

        {/* Novi mesec uđe iz smera strelice (ili prevlačenja). */}
        <div
          {...monthSwipe}
          key={`${year}-${month}`}
          className={monthDir > 0 ? 'month-in-next' : monthDir < 0 ? 'month-in-prev' : undefined}
        >
          {weeks.map((week, wi) => (
            <div key={wi} className="mb-1 grid grid-cols-7 gap-1 sm:mb-1.5 sm:gap-1.5">
              {week.map((day, di) => {
                if (!day) return <div key={di} />
                const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const dayEntries = byDate[isoDate] ?? []
                const isToday = isoDate === todayStr
                const hasEvents = dayEntries.length > 0
                const isPast = isoDate < todayStr
                const isClickable = hasEvents || !isPast
                const activity = activityDays[isoDate]
                const kind = dayStyle(activity)
                const badge = dayBadge(activity)

                return (
                  <div
                    key={di}
                    title={activity?.napomena ?? kind?.label}
                    onClick={() => {
                      if (hasEvents) setTooltip(t => t?.date === isoDate ? null : { date: isoDate })
                      else if (!isPast) setEventModal({ mode: 'add', date: isoDate })
                    }}
                    className={`relative min-h-13 rounded-lg p-1.5 transition-colors sm:min-h-20 sm:p-2
                      ${isClickable ? 'cursor-pointer' : ''}
                      ${isToday ? 'border-2 border-[#024c7d] dark:border-[#60c3ad]' : 'border border-gray-100 dark:border-gray-800'}
                      ${kind ? `${kind.cell} ${hasEvents ? 'hover:brightness-[0.98] dark:hover:brightness-125' : ''}` : hasEvents ? 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-900/30'}
                      ${tooltip?.date === isoDate ? 'ring-2 ring-[#024c7d]/30 dark:ring-[#60c3ad]/30' : ''}
                    `}
                  >
                    <span className={`text-xs font-medium block leading-none mb-1
                      ${isToday ? 'text-[#024c7d] dark:text-[#60c3ad]' : hasEvents ? 'text-gray-900 dark:text-gray-100' : 'text-gray-300 dark:text-gray-700'}`}>
                      {day}
                    </span>
                    {badge && !hasEvents && (
                      <span className="block text-[9px] leading-tight font-medium text-[#024c7d]/70 dark:text-[#60c3ad]/70">{badge}</span>
                    )}
                    {hasEvents && (
                      <div className="flex flex-col gap-px mt-0.5">
                        {dayEntries.slice(0, 3).map((e, i) => (
                          <div
                            key={i}
                            className="rounded-sm px-0.5 overflow-hidden"
                            style={{ background: isDark ? COLORS[colorMap[e.subject]].darkBg : COLORS[colorMap[e.subject]].bg }}
                          >
                            <span
                              className="text-[9px] leading-tight truncate block font-medium"
                              style={{ color: isDark ? COLORS[colorMap[e.subject]].darkText : COLORS[colorMap[e.subject]].text }}
                            >
                              {e.subject}
                            </span>
                          </div>
                        ))}
                        {dayEntries.length > 3 && (
                          <span className="text-[9px] text-gray-400 dark:text-gray-500 px-0.5">+{dayEntries.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <ActivityLegend year={year} month={month} days={activityDays} />

        {isEmpty && (
          <p className="mt-3 text-center text-xs text-gray-400 dark:text-gray-500">
            Nema rokova za prikaz - klikni na datum da dodaš svoj događaj.
          </p>
        )}

        {tooltip && (byDate[tooltip.date]?.length ?? 0) > 0 && (
          <div className={`mt-4 rounded-xl p-4 ${GLASS}`}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {getDaySr(tooltip.date)}, {formatDateSr(tooltip.date)}
              </h4>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEventModal({ mode: 'add', date: tooltip.date })}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white/70 hover:text-gray-700 dark:hover:bg-gray-800/70 dark:hover:text-gray-100"
                  aria-label="Dodaj događaj ovog dana"
                >
                  <IconPlus className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setTooltip(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-base leading-none text-gray-400 transition-colors hover:bg-white/70 hover:text-gray-700 dark:hover:bg-gray-800/70 dark:hover:text-gray-100"
                  aria-label="Zatvori detalje"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {(byDate[tooltip.date] ?? []).map((e, i) => {
                const c = COLORS[colorMap[e.subject]]
                const isCustom = 'custom' in e && e.custom
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-1 h-8 rounded-full shrink-0 mt-0.5" style={{ background: c.bar }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-gray-100">{e.subject}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {e.start}-{e.end} · {e.rooms.join(', ')}
                        {opisVrste(e) && ` · ${opisVrste(e)}`}
                      </p>
                      {e.note && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{e.note}</p>}
                    </div>
                    <button
                      onClick={() => isCustom ? setEventModal({ mode: 'edit', entry: e as CustomRokEntry }) : hideEntry(e)}
                      className="w-6 h-6 flex items-center justify-center rounded-md text-gray-300 dark:text-gray-600 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-400 transition-colors shrink-0 text-xs"
                      aria-label={isCustom ? 'Izmeni događaj' : 'Sakrij termin'}
                    >
                      {isCustom ? <IconEdit className="h-3.5 w-3.5" /> : '✕'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {allFilteredEntries.length > 0 && (
          <div className="mt-6 space-y-1">
            <h4 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Predmeti</h4>
            {Object.entries(colorMap).map(([subject, idx]) => (
              <div key={subject} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[idx].bar }} />
                <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{subject}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  function EmptyState() {
    return (
      <div className="py-16 text-center text-gray-400 dark:text-gray-500 text-sm">
        Nema podataka za prikaz.
      </div>
    )
  }

  // Dodaj/izmeni sopstveni događaj. `key` na pozivnom mestu (ispod) menja se
  // po cilju (koji entry / koji datum), pa React montira svež state umesto
  // da ručno sinhronizuje formu preko efekta kad se promeni cilj.
  function EventModal({ state }: { state: EventModalState }) {
    const existing = state.mode === 'edit' ? state.entry : null
    const [subject, setSubject] = useState(existing?.subject ?? '')
    const [type, setType] = useState<string>(existing?.type ?? 'P')
    const [date, setDate] = useState(existing?.date ?? (state.mode === 'add' ? state.date : undefined) ?? todayStr)
    const [start, setStart] = useState(existing?.start ?? '')
    const [end, setEnd] = useState(existing?.end ?? '')
    const [rooms, setRooms] = useState(existing?.rooms.join(', ') ?? '')
    const [note, setNote] = useState(existing?.note ?? '')
    const [error, setError] = useState<string | null>(null)

    const knownSubjects = useMemo(
      () => [...new Set(allRokovi.flatMap(r => r.entries.map(e => e.subject)))].sort(),
      []
    )

    function handleSave() {
      if (!subject.trim() || !date || !start || !end) {
        setError('Popuni predmet, datum i vreme.')
        return
      }
      saveCustomEntry({
        id: existing?.id ?? crypto.randomUUID(),
        custom: true,
        ...(existing?.tab && { tab: existing.tab }),
        subject: subject.trim(),
        type,
        date,
        start,
        end,
        rooms: rooms.split(',').map(r => r.trim()).filter(Boolean),
        note: note.trim(),
      })
    }

    const fieldClass = 'w-full min-w-0 h-9 px-3 rounded-xl border border-white/70 dark:border-white/15 text-sm text-gray-900 dark:text-gray-100 bg-white/70 dark:bg-gray-900/65 focus:outline-none focus:ring-2 focus:ring-[#024c7d] dark:focus:ring-[#60c3ad] placeholder:text-gray-400 dark:placeholder:text-gray-500'
    const labelClass = 'mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400'

    return (
      <>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {existing ? 'Izmeni događaj' : 'Dodaj događaj'}
        </h3>
        <button
          onClick={() => setEventModal(null)}
          aria-label="Zatvori"
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white/70 hover:text-gray-700 dark:hover:bg-gray-800/70 dark:hover:text-gray-100"
        >
          ✕
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className={labelClass}>Predmet</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            list="rok-subjects"
            placeholder="Naziv predmeta"
            className={fieldClass}
          />
          <datalist id="rok-subjects">
            {knownSubjects.map(s => <option key={s} value={s} />)}
          </datalist>
        </div>

        <div>
          <label className={labelClass}>Tip</label>
          <div className="grid grid-cols-4 gap-1.5">
            {EVENT_TYPES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`py-1.5 rounded-full text-xs font-medium border transition-colors
                  ${type === t
                    ? 'bg-[#024c7d] text-white border-[#024c7d] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:border-[#60c3ad]'
                    : 'bg-white/70 text-gray-600 border-[#024c7d]/25 dark:bg-gray-900/55 dark:text-gray-300 dark:border-white/25'}`}
              >
                {eventTypeLabel(t)}
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0">
          <label className={labelClass}>Datum</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={fieldClass} />
        </div>

        <div className="grid grid-cols-1 gap-2">
          <div className="min-w-0">
            <label className={labelClass}>Od</label>
            <input type="time" value={start} onChange={e => setStart(e.target.value)} className={fieldClass} />
          </div>
          <div className="min-w-0">
            <label className={labelClass}>Do</label>
            <input type="time" value={end} onChange={e => setEnd(e.target.value)} className={fieldClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Sala</label>
          <input
            type="text"
            value={rooms}
            onChange={e => setRooms(e.target.value)}
            placeholder="npr. 012 (više sala odvoji zarezom)"
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass}>Napomena (opciono)</label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="npr. dogovoreno mejlom sa profesorom"
            className={fieldClass}
          />
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

      <div className="mt-5 space-y-2">
        <button
          onClick={handleSave}
          className="btn-lift w-full rounded-xl bg-[#024c7d] py-2.5 text-sm font-medium text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0]"
        >
          Sačuvaj
        </button>
        {existing && (
          <button
            onClick={() => deleteCustomEntry(existing.id)}
            className="w-full rounded-xl py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            Obriši
          </button>
        )}
      </div>
      </>
    )
  }

  if (isHydrated && !meta.group) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Prvo izaberi grupu</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Da bi video svoje ispite i kolokvijume, potrebno je da prođeš kroz onboarding.
          </p>
          <Link
            href="/"
            className="btn-lift inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium
              bg-[#024c7d] text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d]
              dark:hover:bg-[#4db3a0]"
          >
            Idi na početak
            <IconForward className="h-4 w-4 opacity-80" />
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen pb-32 sm:pb-0">
      <div className="mx-auto max-w-4xl px-3 py-3 sm:px-4 sm:py-8">

        <header className="mb-6">
          <div className="flex items-start justify-between gap-3 sm:grid sm:grid-cols-[1fr_auto_1fr]">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Rokovi</h1>
              <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
                {meta.program && `${meta.program} · `}{meta.year && `${meta.year}. godina`}
              </p>
            </div>

            <div className={`hidden rounded-full p-1 sm:flex sm:justify-self-center ${GLASS}`}>
              {pageSwitch.map(({ key, label, Icon, active, onClick }) => (
                <button
                  key={key}
                  onClick={onClick}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors
                    ${active
                      ? 'bg-white text-[#024c7d] shadow-sm dark:bg-gray-700 dark:text-[#60c3ad]'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:justify-self-end">
              <button
                onClick={() => router.push('/izborni')}
                aria-label="Predmeti"
                className={`flex h-9 w-9 items-center justify-center rounded-full text-gray-600 dark:text-gray-300 ${GLASS} hover:bg-white/80 dark:hover:bg-gray-800/70 transition-colors`}
              >
                <IconBack className="h-4 w-4 opacity-80" />
              </button>
              <button
                onClick={toggleTheme}
                aria-label="Promeni temu"
                className={`flex h-9 w-9 items-center justify-center rounded-full text-gray-600 dark:text-gray-300 ${GLASS} hover:bg-white/80 dark:hover:bg-gray-800/70 transition-colors`}
              >
                <IconMoon className="h-[18px] w-[18px] dark:hidden" />
                <IconSun className="hidden h-[18px] w-[18px] dark:block" />
              </button>
              <FeedbackButton />
              {/* Ispiti i kolokvijumi su na FON-u dve strane, pa se bira svaki put. */}
              <div className="relative">
                <button
                  onClick={() => setFonMeni(o => !o)}
                  aria-expanded={fonMeni}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#024c7d]/20 dark:border-[#60c3ad]/25
                             bg-[#024c7d]/10 dark:bg-[#60c3ad]/10 px-3 py-2 text-xs font-semibold backdrop-blur-2xl
                             text-[#024c7d] dark:text-[#60c3ad] hover:bg-[#024c7d]/15 dark:hover:bg-[#60c3ad]/15 transition-colors"
                >
                  FON <IconExternal className="h-3.5 w-3.5" />
                </button>
                <Popover open={fonMeni} onClose={() => setFonMeni(false)}>
                  {FON_STRANE.map(f => (
                    <a
                      key={f.href}
                      href={f.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setFonMeni(false)}
                      className={POPOVER_STAVKA}
                    >
                      {f.naziv}
                      <IconExternal className="h-3.5 w-3.5 opacity-40" />
                    </a>
                  ))}
                </Popover>
              </div>
            </div>
          </div>

          <div className="mt-2 flex w-full flex-wrap items-center gap-2">
            <NotificationBell className="min-w-0" />
            <a
              href="https://student.fon.bg.ac.rs/security/login.jsf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#024c7d]/10 px-3 py-1.5 text-xs font-semibold text-[#024c7d]
                         hover:bg-[#024c7d]/15 dark:bg-[#60c3ad]/10 dark:text-[#60c3ad] dark:hover:bg-[#60c3ad]/15 transition-colors"
            >
              eStudent <IconExternal className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className={`inline-flex rounded-full p-1 ${GLASS}`}>
              {([['list', 'Lista', IconList], ['calendar', 'Kalendar', IconCalendar]] as const).map(([v, label, Icon]) => (
                <button
                  key={v}
                  onClick={() => izaberiPrikaz(v)}
                  className={`no-hover-lift relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors
                    ${view === v
                      ? 'text-[#024c7d] dark:text-[#60c3ad]'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                >
                  {/* Bela podloga klizi do izabranog prikaza. */}
                  {view === v && (
                    <motion.span
                      layoutId="rokovi-view"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      className="absolute inset-0 rounded-full bg-white shadow-sm dark:bg-gray-700"
                    />
                  )}
                  <Icon className="relative h-4 w-4" />
                  <span className="relative">{label}</span>
                </button>
              ))}
            </div>

            {/* Telefon: tri okrugla dugmeta (filter, dodaj, izvoz). */}
            {isHydrated && (
              <div className="flex items-center gap-2 sm:hidden">
                <FilterDugme />
                <button onClick={() => setEventModal({ mode: 'add' })} aria-label="Dodaj događaj" className={dugme(false)}>
                  <IconPlus className={ikona(false)} />
                </button>
                <IzvozDugme />
              </div>
            )}

            {isHydrated && (
              <div className="hidden items-center gap-2 sm:flex">
                <ActionButtons />
              </div>
            )}
          </div>
        </header>

        {/* Baner za prijavu ispita ili kolokvijuma */}
        {prijavaNotice && (
          <div className="anim-up mb-4 flex items-start gap-3 px-4 py-3 rounded-xl
                          bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
            <svg className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {POVOD_NASLOV[prijavaNotice.povod]}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                {prijavaNotice.rok.tip === 'kolokvijum' ? 'Predispitne obaveze' : 'Ispiti'} · {prijavaNotice.rok.rok} · {prijavaNotice.rok.prijava_datumi!.join(' - ')}
                {prijavaNotice.rok.reklamacija_datum && ` · Reklamacije: ${prijavaNotice.rok.reklamacija_datum}`}
              </p>
            </div>
            <button
              onClick={() => dismissBanner(prijavaNotice.rok.rok, prijavaNotice.povod)}
              className="text-amber-400 dark:text-amber-600 hover:text-amber-600 dark:hover:text-amber-400 transition-colors shrink-0 text-sm leading-none mt-0.5"
              aria-label="Zatvori"
            >
              ✕
            </button>
          </div>
        )}

        <Expand open={showHidden && hiddenEntries.length > 0}>
          <div className={`mb-5 rounded-xl p-4 ${GLASS}`}>
            <h4 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
              Skriveni termini
            </h4>
            <div className="space-y-2">
              {hiddenEntries.map((e, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-700 dark:text-gray-300 block truncate">{e.subject}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {getDaySr(e.date)}, {formatDateSr(e.date)} · {e.start}
                      {opisVrste(e) && ` · ${opisVrste(e)}`}
                    </span>
                  </div>
                  <button
                    onClick={() => restoreEntry(e)}
                    className="px-2.5 py-1 text-xs font-medium rounded-md shrink-0
                      text-[#024c7d] dark:text-[#60c3ad] border border-[#024c7d]/30 dark:border-[#60c3ad]/30
                      hover:bg-[#024c7d]/5 dark:hover:bg-[#60c3ad]/10 transition-colors"
                  >
                    Vrati
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Expand>

        {!isHydrated ? (
          <div className="py-16 text-center text-gray-400 dark:text-gray-500 text-sm">Učitavanje...</div>
        ) : loadError ? (
          <OfflineNotice />
        ) : (
          // Ključ je prikaz i filter, pa se omotač (i njegova animacija) menja
          // samo pri promeni jednog od njih, ne na svaki render.
          <div key={`${view}-${filter}`} className="view-in">
            {view === 'list' ? <ListView /> : <CalendarView />}
          </div>
        )}

      </div>

      <Toast show={downloadToast}>Kalendar (.ics) preuzet - otvori fajl da dodaš termine.</Toast>

      <Toast show={imageToast}>Slika rokova je preuzeta!</Toast>

      <Modal
        open={showImageMenu}
        onClose={() => setShowImageMenu(false)}
        overlayClassName="z-100 flex items-end justify-center bg-black/40 px-4 py-6 backdrop-blur-sm sm:items-center"
        className={`w-full max-w-xs rounded-2xl p-4 ring-1 ring-[#024c7d]/15 dark:ring-white/15 ${GLASS}`}
      >
        <p className="mb-1 px-1 text-sm font-semibold text-gray-900 dark:text-gray-100">Skini kao sliku</p>
        <p className="mb-3 px-1 text-xs text-gray-500 dark:text-gray-400">{FILTER_NAZIV[filter]}</p>
        <div className="space-y-1">
          {imageMonths.length > 1 && (
            <button
              onClick={() => { setShowImageMenu(false); void downloadRokImage('all') }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#024c7d] hover:bg-white/70 dark:text-[#60c3ad] dark:hover:bg-gray-800/60 transition-colors"
            >
              <IconImage className="h-4 w-4 opacity-80" />
              Ceo rok (svi meseci)
            </button>
          )}
          {imageMonths.map(m => (
            <button
              key={`${m.year}-${m.month}`}
              onClick={() => { setShowImageMenu(false); void downloadRokImage(m) }}
              className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-white/70 dark:text-gray-200 dark:hover:bg-gray-800/60 transition-colors"
            >
              {cap(SR_MONTHS[m.month])} {m.year}
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        open={!!eventModal}
        onClose={() => setEventModal(null)}
        overlayClassName="z-100 flex items-end justify-center bg-black/40 px-4 py-6 backdrop-blur-sm sm:items-center"
        className={`w-full max-w-sm max-h-full overflow-y-auto rounded-2xl p-5 ring-1 ring-[#024c7d]/15 dark:ring-white/15 ${GLASS}`}
      >
        {eventModal && (
          <EventModal
            key={eventModal.mode === 'edit' ? eventModal.entry.id : `add-${eventModal.date ?? ''}`}
            state={eventModal}
          />
        )}
      </Modal>
    </main>
  )
}
