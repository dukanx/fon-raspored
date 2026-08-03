'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSwipeable } from 'react-swipeable'
import { AnimatePresence } from 'motion/react'
import type { SemesterData, ScheduleEntry, DayOfWeek, RokData, RokEntry } from '@/lib/types'
import { getScheduleForGroup, uniqueSubjectsForGroup } from '@/lib/schedule'
import { reconcileSemester, isFlipPending, acknowledgeFlip } from '@/lib/semester'
import { encodeShare } from '@/lib/share'
import type { SubjectMeta } from '@/lib/subjects'
import { session, app, byGroup, note as noteStore } from '@/lib/storage'
import { useIsDark, useIsHydrated, toggleTheme } from '@/lib/theme'
import { formatDateSr } from '@/lib/date'
import Link from 'next/link'
import FeedbackButton from '@/components/FeedbackButton'
import AppTour, { type TourSlide } from '@/components/AppTour'
import { canvasToFile, shareOrDownloadFile } from '@/lib/shareOrDownload'

const DAYS: DayOfWeek[] = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak']
const DAY_SHORT: Record<DayOfWeek, string> = {
  Ponedeljak: 'Pon', Utorak: 'Uto', Sreda: 'Sre', Četvrtak: 'Čet', Petak: 'Pet'
}
const DAY_OFFSET: Record<DayOfWeek, number> = {
  Ponedeljak: 0, Utorak: 1, Sreda: 2, Četvrtak: 3, Petak: 4
}


const SLOTS = ['08:15', '10:15', '12:15', '14:15', '16:15', '18:15']
const SLOT_LABEL: Record<string, string> = {
  '08:15': '08:15–10:00',
  '10:15': '10:15–12:00',
  '12:15': '12:15–14:00',
  '14:15': '14:15–16:00',
  '16:15': '16:15–18:00',
  '18:15': '18:15–20:00',
}

const COLORS = [
  { bg: '#d6f0ec', text: '#1a5e52', bar: '#60c3ad', darkBg: '#0f3530', darkText: '#8ed8ca' },
  { bg: '#e8e7f5', text: '#44408a', bar: '#9b95c9', darkBg: '#1e1b3d', darkText: '#b8b4e0' },
  { bg: '#cce0f0', text: '#012f4e', bar: '#004b7c', darkBg: '#051e30', darkText: '#7ab5d8' },
  { bg: '#fde6e5', text: '#892d2a', bar: '#f48580', darkBg: '#3d1512', darkText: '#f4a09c' },
  { bg: '#fff4d6', text: '#7a5a00', bar: '#ffcd67', darkBg: '#3d3200', darkText: '#ffd97a' },
  { bg: '#f0d9ec', text: '#7a2e5a', bar: '#d057a0', darkBg: '#3d1a30', darkText: '#e8a8d0' },
]

// Liquid-glass površina (frosted) — koristi se za kartice, dugmad, header, bar
const GLASS = 'liquid-glass'

/* ---------- Ikonice (stroke, currentColor — rade u obe teme) ---------- */
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
const IconCalendar = (p: IconProps) => (
  <svg {...baseIcon(p)}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
)
const IconImage = (p: IconProps) => (
  <svg {...baseIcon(p)}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-4.5-4.5L5 22" /></svg>
)
const IconShare = (p: IconProps) => (
  <svg {...baseIcon(p)}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>
)
const IconEdit = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
)
const IconExam = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" /></svg>
)
const IconSchedule = (p: IconProps) => (
  <svg {...baseIcon(p)}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4M7.5 13h4M7.5 17h7" /></svg>
)
const IconLayers = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></svg>
)
const IconBell = (p: IconProps) => (
  <svg {...baseIcon(p)}>
    <path d="M6 9a6 6 0 0 1 12 0v.75a8.97 8.97 0 0 0 2.31 6.02c.3.33.06.86-.38.98A23.85 23.85 0 0 1 12 18a23.85 23.85 0 0 1-7.93-1.25c-.44-.12-.68-.65-.38-.98A8.97 8.97 0 0 0 6 9.75Z" />
    <path d="M9.5 20a2.5 2.5 0 0 0 5 0" />
  </svg>
)
const IconHidden = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 9 5 9 5s-.9 1.1-2.3 2.4" /><path d="M6.6 6.6C4.4 8 3 10 3 10s4 5 9 5c1.2 0 2.3-.2 3.3-.6" /></svg>
)
const IconInfo = (p: IconProps) => (
  <svg {...baseIcon(p)}><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 11h1v5h1" /></svg>
)
const IconPlus = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M12 5v14M5 12h14" /></svg>
)
const IconBack = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
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
const IconClose = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M18 6 6 18M6 6l12 12" /></svg>
)
const IconWeek = (p: IconProps) => (
  <svg {...baseIcon(p)}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 9v11M15 9v11" /></svg>
)
const IconList = (p: IconProps) => (
  <svg {...baseIcon(p)}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
)

function entryKey(e: ScheduleEntry) {
  return `${e.day}|${e.start}|${e.subject}|${e.type_short}`
}

// Isti predmet/dan/vreme/tip u više sala = jedan logički termin (npr. vežbe
// podeljene na dve sale). Spajamo u jedan blok sa svim salama, da se ne prikazuju
// kao dve odvojene kocke i da skrivanje radi na tom jednom terminu.
function mergeSameSlot(list: ScheduleEntry[]): ScheduleEntry[] {
  const byKey = new Map<string, ScheduleEntry>()
  for (const e of list) {
    const k = entryKey(e)
    const existing = byKey.get(k)
    if (!existing) {
      byKey.set(k, { ...e })
      continue
    }
    const rooms = [...new Set([...existing.room.split(', '), ...e.room.split(', ')])]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'sr', { numeric: true }))
    existing.room = rooms.join(', ')
    existing.groups = [...new Set([...existing.groups, ...e.groups])]
  }
  return [...byKey.values()]
}


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
          <IconClose className="h-4 w-4" />
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

function useSubjectColors(entries: ScheduleEntry[]) {
  const map: Record<string, number> = {}
  let i = 0
  for (const e of entries) {
    if (!(e.subject in map)) {
      map[e.subject] = i % COLORS.length
      i++
    }
  }
  return map
}

export default function RasporedPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [hiddenEntries, setHiddenEntries] = useState<ScheduleEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [manualView, setManualView] = useState<'grid' | 'list' | null>(null)
  const [showIcsHelp, setShowIcsHelp] = useState(false)
  const [showDownloadToast, setShowDownloadToast] = useState(false)
  const [showShareToast, setShowShareToast] = useState(false)
  const [showShareChoice, setShowShareChoice] = useState(false)
  const [allSubjects, setAllSubjects] = useState<string[]>([])
  const [showFlipPopup, setShowFlipPopup] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)
  const [rokovi, setRokovi] = useState<RokData[]>([])
  const [subjectsMeta, setSubjectsMeta] = useState<Record<string, SubjectMeta>>({})
  const [note, setNote] = useState('')
  const noteRef = useRef<HTMLTextAreaElement>(null)

  const isDark = useIsDark()
  const isHydrated = useIsHydrated()

  // Default je uvek "Sedmica" (grid) — i na telefonu i na desktopu; korisnik
  // može ručno na "Lista".
  const view: 'grid' | 'list' = manualView ?? 'grid'
  const meta = isHydrated
    ? {
      group: session.group.get() ?? '',
      year: session.year.get() ?? '',
      lastName: session.lastName.get() ?? '',
      semester: session.semester.get() ?? '',
      program: session.program.get() ?? '',
    }
    : { group: '', year: '', lastName: '', semester: '', program: '' }

  useEffect(() => {
    if (!isHydrated) return

    if (!meta.group || !meta.year) {
      router.replace('/')
      return
    }

    fetch(`/data/${meta.year}god.json`)
      .then(r => r.json())
      .then((data: SemesterData) => {
        // Prevrtanje semestra: resetuj stari izbor predmeta i digni "Nov
        // semestar" popup. Mora pre čitanja fon_subjects (reset ga briše).
        reconcileSemester(data.semester, meta.group)
        if (isFlipPending(data.semester)) setShowFlipPopup(true)

        const all = getScheduleForGroup(data, meta.group)
        setAllSubjects(uniqueSubjectsForGroup(data, meta.group))
        const checked = byGroup.subjects(meta.group).get()
        const hasSaved = Object.keys(checked).length > 0
        let base = hasSaved ? all.filter(e => checked[e.subject] !== false) : all

        const extra = byGroup.extra(meta.group).get()

        // MAGIJA: Filtriramo iz base:
        // 1. Termine koje preneseni predmeti gaze po vremenu (isti dan i vreme)
        // 2. Originalne termine istog predmeta i tipa (P/V) ako smo mu dodali novi termin
        base = base.filter(b => {
          const gaziGaVreme = extra.some(ex => ex.day === b.day && ex.start === b.start)
          const gaziGaPredmet = extra.some(ex => ex.subject === b.subject && ex.type_short === b.type_short)
          return !gaziGaVreme && !gaziGaPredmet
        })
        const merged = [...base]
        for (const item of extra) {
          const exists = merged.some(e =>
            e.subject === item.subject &&
            e.day === item.day &&
            e.start === item.start &&
            e.type_short === item.type_short &&
            e.room === item.room
          )
          if (!exists) merged.push(item)
        }

        setEntries(mergeSameSlot(merged))
        setLoaded(true)

        setHiddenEntries(byGroup.hidden(meta.group).get())
      })
  }, [isHydrated, meta.group, meta.year, router])

  function hasTransferredSubjects(): boolean {
    if (!meta.group) return false
    return (
      byGroup.prevSubjects(meta.group).get().length > 0 ||
      byGroup.otherSem(meta.group).get().length > 0
    )
  }

  // Popup — prvi put opšti tur (deljenje/slika/kalendar/rokovi/notifikacije),
  // sa "Podesi termine" slajdom na početku SAMO ako već ima prenesene/druge
  // semestralne predmete. Ako ih tada nema, taj slajd se preskače u turu — ali
  // ako se kasnije dodaju (npr. preko "Moji predmeti"), prikaže se sam za sebe
  // sledeći put kad se stigne na Raspored. Uvek sa malim zakašnjenjem posle
  // promene taba, ne odmah.
  useEffect(() => {
    if (!isHydrated || !meta.group) return
    const tourSeen = app.appTourSeen.get()
    const transferredSeen = app.prevSubjectsIntroSeen.get()
    const hasTransferred =
      byGroup.prevSubjects(meta.group).get().length > 0 ||
      byGroup.otherSem(meta.group).get().length > 0
    const shouldShow = !tourSeen || (hasTransferred && !transferredSeen)
    if (!shouldShow) return
    const t = setTimeout(() => setShowTour(true), 1500)
    return () => clearTimeout(t)
  }, [isHydrated, meta.group])

  const tourHasTransferredSlide = hasTransferredSubjects()

  function closeTour() {
    app.appTourSeen.set()
    if (tourHasTransferredSlide) app.prevSubjectsIntroSeen.set()
    setShowTour(false)
  }

  const transferredSlide: TourSlide = {
    key: 'prenesene',
    icon: IconLayers,
    title: 'Podesi termine',
    desc: 'Za prenesene i drugosemestralne predmete termin biraš ručno.',
    features: [
      { icon: IconEdit, title: 'Izmena tab', desc: 'Tu biraš termin za svaki takav predmet.' },
    ],
    primaryLabel: 'Idi na Izmenu',
    onPrimary: () => { closeTour(); router.push('/preneseni') },
  }

  const generalSlides: TourSlide[] = [
    {
      key: 'izmena',
      icon: IconEdit,
      title: 'Izmena tab',
      desc: 'Promeni predmete, dodaj termin ili vrati sakrivene.',
      features: [
        { icon: IconList, title: 'Promeni predmete', desc: 'Uključi/isključi izborne, u bilo kom trenutku.' },
        { icon: IconEdit, title: 'Dodaj termin', desc: 'Za prenesene predmete ili drugi termin za trenutni — uz AI predlog.' },
        { icon: IconHidden, title: 'Vrati skrivene', desc: 'Termine koje si ranije sakrio/la.' },
      ],
    },
    {
      key: 'skrivanje',
      icon: IconHidden,
      title: 'Sakrij termine',
      desc: 'Ne odgovara ti nešto? Sakrij ga — vraćaš ga kad hoćeš.',
      features: [
        { icon: IconClose, title: 'Raspored', desc: 'X na terminu ga sakriva.' },
        { icon: IconHidden, title: 'Rokovi', desc: 'Isto, uz spisak skrivenih za vraćanje.' },
      ],
    },
    {
      key: 'info',
      icon: IconInfo,
      title: 'Info o predmetu',
      desc: 'Klikni na termin predemta u rasporedu za katedru, ESPB, napomene i vezane rokove.',
    },
    {
      key: 'deljenje',
      icon: IconShare,
      title: 'Izvezi raspored',
      desc: 'Podeli raspored, sačuvaj ga kao sliku ili izvezi u kalendar telefona.',
      features: [
        { icon: IconShare, title: 'Podeli', desc: 'Dugme u alatkama iznad rasporeda.' },
        { icon: IconImage, title: 'Slika', desc: 'Cela nedelja kao PNG za brzo deljenje.' },
        { icon: IconCalendar, title: 'Kalendar', desc: 'Uvezi termine u Google/Apple kalendar.' },
      ],
    },
    {
      key: 'rokovi',
      icon: IconExam,
      title: 'Rokovi',
      desc: 'Prati ispite i kolokvijume, ili dodaj sopstvene događaje.',
      features: [
        { icon: IconExam, title: 'Rokovi tab', desc: 'Datumi sa FON sajta, plus tvoji dogovori.' },
        { icon: IconPlus, title: 'Dodaj svoj', desc: 'Ispit, kolokvijum ili dogovor sa profesorom.' },
      ],
    },
    {
      key: 'notifikacije',
      icon: IconBell,
      title: 'Notifikacije',
      desc: 'Da ne propustiš rok ili prijavu ispita.',
      features: [
        { icon: IconBell, title: 'Uključi ih', desc: 'Zvonce u Rokovi tabu.' },
      ],
    },
  ]

  // Tur već viđen -> ako se prenesen predmet naknadno pojavio, taj jedan
  // slajd samostalno; inače (prvi put) ceo tur, sa tim slajdom na početku
  // samo ako je relevantan.
  const tourSlides: TourSlide[] = app.appTourSeen.get()
    ? [transferredSlide]
    : tourHasTransferredSlide
      ? [transferredSlide, ...generalSlides]
      : generalSlides

  // Rokovi (ispiti/kolokvijumi) — za sekciju "Vezani rokovi" u panelu predmeta.
  useEffect(() => {
    if (!isHydrated) return
    fetch('/data/rokovi.json')
      .then(r => r.json())
      .then((d: RokData[]) => setRokovi(Array.isArray(d) ? d : []))
      .catch(() => setRokovi([]))
  }, [isHydrated])

  // Metapodaci predmeta (ESPB / katedra / link na FON sajt) — za panel.
  useEffect(() => {
    if (!isHydrated) return
    fetch('/data/subjects-meta.json')
      .then(r => r.json())
      .then((d: Record<string, SubjectMeta>) => setSubjectsMeta(d && typeof d === 'object' ? d : {}))
      .catch(() => setSubjectsMeta({}))
  }, [isHydrated])

  // Beleška raste u visinu prema sadržaju.
  useEffect(() => {
    const el = noteRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [note, selectedSubject])

  // Otvori panel predmeta i učitaj njegovu belešku (bez setState u efektu).
  function openSubject(subject: string) {
    setSelectedSubject(subject)
    setNote(noteStore(subject).get() ?? '')
  }

  function saveNote(value: string) {
    setNote(value)
    if (selectedSubject) noteStore(selectedSubject).set(value)
  }

  // Ima li išta van "Tvoji predmeti" da se ponudi za deljenje (preneseni
  // termini, predmeti iz prethodnih godina, predmeti drugog semestra).
  function hasShareExtras(): boolean {
    if (!meta.group) return false
    return (
      byGroup.extra(meta.group).get().length > 0 ||
      byGroup.prevSubjects(meta.group).get().length > 0 ||
      byGroup.otherSem(meta.group).get().length > 0
    )
  }

  // Klik na "Podeli" — ako ima šta van tekućih predmeta, pitaj šta da uključi
  // (bez toga bi link mogao da stigne prazan, npr. ako ceo raspored zavisi od
  // prenesenog predmeta). Ako nema ništa extra, ne gnjavi pitanjem.
  function openShareFlow() {
    if (hasShareExtras()) setShowShareChoice(true)
    else void shareSchedule(false)
  }

  // Napravi /deli link i podeli ga (native share na mobilnom, inače kopiraj u
  // clipboard + toast). includeExtras: uključuje i prenesene/prethodne/drugi
  // semestar, ne samo čekirane tekuće predmete.
  async function shareSchedule(includeExtras: boolean) {
    setShowShareChoice(false)
    if (!meta.group || !meta.year || allSubjects.length === 0) return
    const checked = byGroup.subjects(meta.group).get()
    const s = allSubjects
      .map((_, i) => i)
      .filter(i => checked[allSubjects[i]] !== false)
    const encoded = encodeShare({
      v: 1,
      y: Number(meta.year),
      g: meta.group,
      n: allSubjects.length,
      s,
      ...(includeExtras
        ? {
            x: byGroup.extra(meta.group).get(),
            p: byGroup.prevSubjects(meta.group).get(),
            o: byGroup.otherSem(meta.group).get(),
          }
        : {}),
    })
    const url = `${window.location.origin}/deli?s=${encoded}`

    if (navigator.share) {
      try {
        await navigator.share({ title: 'FON Raspored', text: `Raspored — grupa ${meta.group}`, url })
        return
      } catch {
        return // korisnik otkazao share sheet — ne kopiraj
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setShowShareToast(true)
      setTimeout(() => setShowShareToast(false), 3000)
    } catch {
      // clipboard nedostupan (npr. http) — tiho odustani
    }
  }

  function dismissFlip() {
    acknowledgeFlip()
    setShowFlipPopup(false)
  }
  function goPickSubjects() {
    acknowledgeFlip()
    setShowFlipPopup(false)
    router.push('/izborni')
  }

  const colorMap = useSubjectColors(entries)

  const hiddenKeys = useMemo(() => new Set(hiddenEntries.map(entryKey)), [hiddenEntries])
  const visibleEntries = useMemo(() => entries.filter(e => !hiddenKeys.has(entryKey(e))), [entries, hiddenKeys])

  // Panel predmeta: vidljivi termini tog predmeta (sedmična slika) + nadolazeći
  // rokovi. Vučemo iz visibleEntries da skrivanje iz panela odmah ukloni red.
  const todayStr = new Date().toISOString().split('T')[0]
  const subjectTermine = selectedSubject
    ? visibleEntries.filter(e => e.subject === selectedSubject)
      .sort((a, b) => DAY_OFFSET[a.day] - DAY_OFFSET[b.day] || a.start.localeCompare(b.start))
    : []
  const subjectRokovi: (RokEntry & { rok: string; tip: RokData['tip'] })[] = selectedSubject
    ? rokovi.flatMap(r => r.entries
      .filter(e => e.subject === selectedSubject && e.date >= todayStr)
      .map(e => ({ ...e, rok: r.rok, tip: r.tip })))
      .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
    : []
  const subjectMeta = selectedSubject ? subjectsMeta[selectedSubject] : undefined

  function hideEntry(e: ScheduleEntry) {
    const key = entryKey(e)
    if (hiddenKeys.has(key)) return
    const next = [...hiddenEntries, e]
    setHiddenEntries(next)
    byGroup.hidden(meta.group).set(next)
  }

  async function downloadPNG() {
    const canvas = document.createElement('canvas')
    const dpr = 2
    const colW = 160
    const rowH = 80
    const headerH = 32
    const timeW = 56
    const padding = 16

    canvas.width = (timeW + colW * 5 + padding * 2) * dpr
    canvas.height = (headerH + rowH * SLOTS.length + padding * 2) * dpr

    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)

    // Pozadina
    ctx.fillStyle = '#f9fafb'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Grid area bela
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(padding + timeW, padding, colW * 5, headerH + rowH * SLOTS.length)

    // Dan headeri
    const dayNames = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet']
    dayNames.forEach((d, i) => {
      ctx.fillStyle = '#6b7280'
      ctx.font = '500 11px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(d, padding + timeW + colW * i + colW / 2, padding + 20)
    })

    // Grid linije
    ctx.strokeStyle = '#f3f4f6'
    ctx.lineWidth = 1

    SLOTS.forEach((_, si) => {
      const y = padding + headerH + rowH * si
      ctx.beginPath()
      ctx.moveTo(padding + timeW, y)
      ctx.lineTo(padding + timeW + colW * 5, y)
      ctx.stroke()
    })

    dayNames.forEach((_, di) => {
      const x = padding + timeW + colW * di
      ctx.beginPath()
      ctx.moveTo(x, padding + headerH)
      ctx.lineTo(x, padding + headerH + rowH * SLOTS.length)
      ctx.stroke()
    })

    // Vreme i blokovi
    SLOTS.forEach((slot, si) => {
      const y = padding + headerH + rowH * si

      // Vreme label
      ctx.fillStyle = '#9ca3af'
      ctx.font = '11px system-ui, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(slot, padding + timeW - 6, y + 16)

      DAYS.forEach((day, di) => {
        const x = padding + timeW + colW * di
        const cell = visibleEntries.filter(e => e.day === day && e.start === slot)

        if (!cell.length) return

        const blockH = (rowH - 8) / cell.length

        cell.forEach((e, bi) => {
          const c = COLORS[colorMap[e.subject]]
          const bx = x + 3
          const by = y + 4 + blockH * bi
          const bw = colW - 6
          const bh = blockH - 3

          // Blok pozadina
          ctx.fillStyle = c.bg
          ctx.beginPath()
          ctx.roundRect(bx, by, bw, bh, 6)
          ctx.fill()

          // Naziv predmeta
          ctx.fillStyle = c.text
          ctx.font = '500 10px system-ui, sans-serif'
          ctx.textAlign = 'left'

          // Wrap tekst
          const words = e.subject.split(' ')
          let line = ''
          let lineY = by + 13
          for (const word of words) {
            const test = line + word + ' '
            if (ctx.measureText(test).width > bw - 8 && line) {
              ctx.fillText(line.trim(), bx + 5, lineY)
              line = word + ' '
              lineY += 12
              if (lineY > by + bh - 8) break
            } else {
              line = test
            }
          }
          if (line) ctx.fillText(line.trim(), bx + 5, lineY)

          // Tip i sala
          ctx.fillStyle = c.text
          ctx.globalAlpha = 0.7
          ctx.font = '10px system-ui, sans-serif'
          ctx.fillText(`${e.type_short} · ${e.room}`, bx + 5, by + bh - 5)
          ctx.globalAlpha = 1
        })
      })
    })

    // Header info
    ctx.fillStyle = '#111827'
    ctx.font = '500 13px system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`${meta.lastName} · Grupa ${meta.group} · ${meta.semester}`, padding + timeW, padding - 4)

    const file = await canvasToFile(canvas, `raspored-${meta.group}.png`)
    await shareOrDownloadFile(file, 'Raspored')
    setShowDownloadToast(true)
    setTimeout(() => setShowDownloadToast(false), 3000)
  }

  function downloadICS() {
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//FON Raspored//SR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ]

    // Datum prvog ponedeljka tekuće sedmice
    const today = new Date()
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))

    visibleEntries.forEach(e => {
      const offset = DAY_OFFSET[e.day]
      const date = new Date(monday)
      date.setDate(monday.getDate() + offset)

      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')

      const [startH, startM] = e.start.split(':')
      const [endH, endM] = e.end.split(':')

      const dtstart = `${dateStr}T${startH}${startM}00`
      const dtend = `${dateStr}T${endH}${endM}00`

      const uid = `${dateStr}-${e.subject.replace(/\s/g, '')}-${e.type_short}@fonraspored`

      lines.push('BEGIN:VEVENT')
      lines.push(`UID:${uid}`)
      lines.push(`DTSTART;TZID=Europe/Belgrade:${dtstart}`)
      lines.push(`DTEND;TZID=Europe/Belgrade:${dtend}`)
      lines.push(`SUMMARY:${e.subject} [${e.type_short}]`)
      lines.push(`LOCATION:Sala ${e.room}`)
      lines.push(`DESCRIPTION:Grupa ${meta.group}`)
      const now = new Date()
      const isLetnji = now.getMonth() >= 1 && now.getMonth() <= 7
      const endDate = isLetnji
        ? `${now.getFullYear()}0630T235959Z`
        : `${now.getFullYear()}0131T235959Z`

      lines.push(`RRULE:FREQ=WEEKLY;UNTIL=${endDate}`)
      lines.push('END:VEVENT')
    })

    lines.push('END:VCALENDAR')

    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
    const link = document.createElement('a')
    link.download = `raspored-${meta.group}.ics`
    link.href = URL.createObjectURL(blob)
    link.click()


  }

  // Export akcije (skidanje slike / kalendar) — NISU navigacija, stoje uz kontrole
  const exportActions = [
    { key: 'podeli', short: 'Podeli', long: 'Podeli raspored', Icon: IconShare, onClick: openShareFlow },
    { key: 'slika', short: 'Slika', long: 'Slika', Icon: IconImage, onClick: () => { void downloadPNG() } },
    { key: 'kalendar', short: 'Kalendar', long: 'Izvezi u kalendar', Icon: IconCalendar, onClick: () => { downloadICS(); setShowIcsHelp(true) } },
  ]
  // Navigacija (desktop toolbar) — Rokovi ide kroz pageSwitch ispod, ne odavde
  const navActions = [
    { key: 'izmena', short: 'Izmena', long: 'Izmena termina', Icon: IconEdit, onClick: () => router.push('/preneseni') },
  ]
  // Raspored/Rokovi — ravnopravan prekidač na desktopu (bez "nazad" hijerarhije)
  const pageSwitch = [
    { key: 'raspored', label: 'Raspored', Icon: IconSchedule, active: true, onClick: () => {} },
    { key: 'rokovi', label: 'Rokovi', Icon: IconExam, active: false, onClick: () => router.push('/rokovi') },
  ] as const

  const isLoading = !isHydrated || !loaded
  const isEmpty = loaded && visibleEntries.length === 0

  return (
    <>
      {/* ---------- Sticky header ---------- */}
      <header>
        <div className="mx-auto max-w-6xl px-3 py-3 sm:px-6 sm:pt-8">

          {/* Naslov + tema + FON */}
          <div className="flex items-start justify-between gap-3 sm:grid sm:grid-cols-[1fr_auto_1fr]">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                Grupa {meta.group || '—'}
              </h1>
              <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
                {meta.program && `${meta.program} · `}{meta.semester}
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
                className={`flex h-9 w-9 items-center justify-center rounded-full text-gray-600 dark:text-gray-300 ${GLASS} hover:bg-white/80 dark:hover:bg-gray-800/70 transition-colors`}
                aria-label="Predmeti"
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
              <a
                href="https://oas.fon.bg.ac.rs/raspored-nastave/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#024c7d]/20 dark:border-[#60c3ad]/25
                           bg-[#024c7d]/10 dark:bg-[#60c3ad]/10 px-3 py-2 text-xs font-semibold backdrop-blur-2xl
                           text-[#024c7d] dark:text-[#60c3ad] hover:bg-[#024c7d]/15 dark:hover:bg-[#60c3ad]/15 transition-colors"
              >
                FON <IconExternal className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* Prikaz (Lista/Sedmica) + export + desktop toolbar */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className={`inline-flex rounded-full p-1 ${GLASS}`}>
              {([['list', 'Lista', IconList], ['grid', 'Sedmica', IconWeek]] as const).map(([v, label, Icon]) => (
                <button
                  key={v}
                  onClick={() => setManualView(v)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors
                    ${view === v
                      ? 'bg-white text-[#024c7d] shadow-sm dark:bg-gray-700 dark:text-[#60c3ad]'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Export (mobilni): male staklene ikonice */}
            <div className="flex items-center gap-2 sm:hidden">
              {exportActions.map(({ key, long, Icon, onClick }) => (
                <button
                  key={key}
                  onClick={onClick}
                  aria-label={long}
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-gray-600 dark:text-gray-300 ${GLASS} hover:bg-white/80 dark:hover:bg-gray-800/70 transition-colors`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </button>
              ))}
            </div>

            {/* Desktop toolbar */}
            <div className="hidden flex-wrap items-center justify-end gap-2 sm:flex">
              <div className="flex items-center gap-2">
                {exportActions.map(({ key, long, Icon, onClick }) => (
                  <button
                    key={key}
                    onClick={onClick}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 ${GLASS} hover:bg-white/80 dark:hover:bg-gray-800/70 transition-colors`}
                  >
                    <Icon className="h-4 w-4 opacity-80" />
                    {long}
                  </button>
                ))}
              </div>
              <div className="mx-1 h-6 w-px bg-white/70 dark:bg-white/15" />
              <div className="flex items-center gap-2">
                {navActions.map(({ key, long, Icon, onClick }) => (
                  <button
                    key={key}
                    onClick={onClick}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 ${GLASS} hover:bg-white/80 dark:hover:bg-gray-800/70 transition-colors`}
                  >
                    <Icon className="h-4 w-4 opacity-80" />
                    {long}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ---------- Sadržaj ---------- */}
      <main className="mx-auto w-full max-w-6xl px-3 pt-5 pb-32 sm:px-6 sm:pb-10">

        {isLoading ? (
          view === 'grid' ? (
            <div className="overflow-hidden">
              {/* Day headers (statični okvir dok se učitava) */}
              <div className="grid grid-cols-[34px_repeat(5,minmax(0,1fr))] gap-0.5 mb-0.5 sm:grid-cols-[56px_repeat(5,minmax(0,1fr))] sm:gap-1 sm:mb-1">
                <div />
                {DAYS.map(d => (
                  <div key={d} className="text-center text-[11px] font-medium text-gray-500 dark:text-gray-400 py-1 sm:text-xs">
                    {DAY_SHORT[d]}
                  </div>
                ))}
              </div>
              {SLOTS.map(slot => (
                <div
                  key={slot}
                  className="grid grid-cols-[34px_repeat(5,minmax(0,1fr))] gap-0.5 mb-0.5 sm:grid-cols-[56px_repeat(5,minmax(0,1fr))] sm:gap-1 sm:mb-1"
                >
                  <div className="text-right pr-1 pt-1 text-[9px] text-gray-400 dark:text-gray-500 leading-tight sm:pr-2 sm:pt-1.5 sm:text-xs">
                    {slot}
                  </div>
                  {DAYS.map(day => (
                    <div key={day} className="min-h-11 rounded-lg bg-gray-100/70 dark:bg-gray-800/60 animate-pulse sm:min-h-20" />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`h-[78px] rounded-2xl ${GLASS} animate-pulse`} />
              ))}
            </div>
          )
        ) : isEmpty ? (
          <div className={`mx-auto mt-10 max-w-sm rounded-2xl border-dashed p-8 text-center ${GLASS}`}>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Nema termina za prikaz</p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Svi termini su sakriveni ili predmeti nisu izabrani. Proveri korak „2. Predmeti“.
            </p>
            <Link
              href="/izborni"
              className="mt-4 inline-flex rounded-lg bg-[#024c7d] px-4 py-2 text-xs font-medium text-white
                         hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0] transition-colors"
            >
              Izaberi predmete
            </Link>
          </div>
        ) : view === 'grid' ? (
          <div className="overflow-hidden">
            <div id="raspored-grid">

              {/* Day headers */}
              <div className="grid grid-cols-[34px_repeat(5,minmax(0,1fr))] gap-0.5 mb-0.5 sm:grid-cols-[56px_repeat(5,minmax(0,1fr))] sm:gap-1 sm:mb-1">
                <div />
                {DAYS.map(d => (
                  <div key={d} className="text-center text-[11px] font-medium text-gray-500 dark:text-gray-400 py-1 sm:text-xs">
                    {DAY_SHORT[d]}
                  </div>
                ))}
              </div>

              {/* Slots */}
              {SLOTS.map(slot => (
                <div
                  key={slot}
                  className="grid grid-cols-[34px_repeat(5,minmax(0,1fr))] gap-0.5 mb-0.5 sm:grid-cols-[56px_repeat(5,minmax(0,1fr))] sm:gap-1 sm:mb-1"
                >
                  <div className="text-right pr-1 pt-1 text-[9px] text-gray-400 dark:text-gray-500 leading-tight sm:pr-2 sm:pt-1.5 sm:text-xs">
                    {slot}
                  </div>
                  {DAYS.map(day => {
                    const cell = visibleEntries.filter(e => e.day === day && e.start === slot)
                    if (!cell.length) {
                      return <div key={day} className="min-h-11 rounded-lg bg-gray-100/60 dark:bg-gray-800/60 border border-gray-200 dark:border-0 outline-none sm:min-h-20" />
                    }
                    return (
                      <div key={day} className="flex flex-col gap-0.5 sm:gap-1">
                        {cell.map((e, i) => {
                          const c = COLORS[colorMap[e.subject]]
                          return (
                            <div
                              key={i}
                              onClick={() => openSubject(e.subject)}
                              style={{ background: isDark ? c.darkBg : c.bg }}
                              className={`group/card flex-1 cursor-pointer rounded-lg p-1.5 min-h-11 relative transition-shadow sm:min-h-20 sm:p-2.5
                                ${selectedSubject === e.subject ? 'ring-2 ring-inset ring-[#024c7d]/50 dark:ring-[#60c3ad]/50' : ''}`}
                            >
                              <button
                                onClick={ev => { ev.stopPropagation(); hideEntry(e) }}
                                style={{ color: isDark ? c.darkText : c.text }}
                                className="absolute top-1 right-1 hidden w-4 h-4 rounded items-center justify-center opacity-0 group-hover/card:opacity-60 hover:opacity-100! transition-opacity text-[10px] leading-none bg-black/10 dark:bg-white/10 sm:flex"
                              >
                                ✕
                              </button>
                              <p style={{ color: isDark ? c.darkText : c.text }} className="text-[10px] font-medium leading-snug line-clamp-2 sm:text-xs sm:pr-4">
                                {e.subject}
                              </p>
                              <p style={{ color: isDark ? c.darkText : c.text }} className="text-[9px] mt-0.5 opacity-70 truncate sm:text-xs sm:mt-1">
                                {e.type_short} · {e.room}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              ))}

            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {DAYS.map(day => {
              const dayEntries = visibleEntries
                .filter(e => e.day === day)
                .sort((a, b) => a.start.localeCompare(b.start))

              if (!dayEntries.length) return null

              return (
                <div key={day}>
                  <h2 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider
                                 mb-2 pb-2 border-b border-gray-200 dark:border-gray-800">
                    {day}
                  </h2>
                  <div className="space-y-1">
                    {dayEntries.map((e, i) => {
                      const c = COLORS[colorMap[e.subject]]
                      return (
                        <SwipeableListItem key={i} onHide={() => hideEntry(e)}>
                          <div className="flex items-center gap-2 py-2.5 border-b border-gray-100 dark:border-gray-800 sm:gap-3">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-300 tabular-nums w-[72px] shrink-0 sm:w-24">
                              {SLOT_LABEL[e.start]}
                            </span>
                            <div className="w-1 self-stretch rounded-full" style={{ background: c.bar }} />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-gray-900 dark:text-gray-100 block truncate">
                                {e.subject}
                              </span>
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                {e.room}
                              </span>
                            </div>
                            <span style={{ background: isDark ? c.darkBg : c.bg, color: isDark ? c.darkText : c.text }} className="text-xs font-medium px-2 py-0.5 rounded-md shrink-0">
                              {e.type_short}
                            </span>
                            <button
                              onClick={() => hideEntry(e)}
                              className="hidden sm:flex w-6 h-6 items-center justify-center rounded-md text-gray-300 dark:text-gray-600 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-400 transition-colors shrink-0 text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        </SwipeableListItem>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Panel predmeta — tap na blok u sedmici otvara info ispod */}
        {selectedSubject && (
          <div className={`mx-auto mt-6 max-w-3xl rounded-2xl p-4 sm:p-5 ${GLASS}`}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="h-5 w-1 shrink-0 rounded-full" style={{ background: COLORS[colorMap[selectedSubject]].bar }} />
                <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{selectedSubject}</h3>
              </div>
              <button
                onClick={() => setSelectedSubject(null)}
                aria-label="Zatvori"
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 ${GLASS} hover:bg-white/80 dark:hover:bg-gray-800/70 transition-colors`}
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            {/* O predmetu — ESPB / katedra / link na FON sajt (ako imamo meta) */}
            {subjectMeta && (
              <div className="mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                {subjectMeta.espb && (
                  <span className="shrink-0 rounded-full bg-[#024c7d]/10 px-2 py-0.5 text-xs font-medium text-[#024c7d] dark:bg-[#60c3ad]/15 dark:text-[#60c3ad]">
                    {/^\d+$/.test(subjectMeta.espb) ? `${subjectMeta.espb} ESPB` : `ESPB: ${subjectMeta.espb}`}
                  </span>
                )}
                {subjectMeta.katedra && (
                  <span className="min-w-0 truncate text-xs text-gray-500 dark:text-gray-400">{subjectMeta.katedra}</span>
                )}
                <a
                  href={subjectMeta.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#024c7d] hover:underline dark:text-[#60c3ad]"
                >
                  FON sajt
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                    <path d="M7 17 17 7M9 7h8v8" />
                  </svg>
                </a>
              </div>
            )}

            {/* Termini u nedelji */}
            <div className="mb-4">
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Termini</h4>
              <div className="space-y-1.5">
                {subjectTermine.map((e, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm">
                    <span className="w-8 shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">{DAY_SHORT[e.day]}</span>
                    <span className="w-24 shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">{SLOT_LABEL[e.start] ?? `${e.start}–${e.end}`}</span>
                    <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">{e.type_short}</span>
                    <span className="flex-1 truncate text-xs text-gray-500 dark:text-gray-400">{e.room}</span>
                    <button
                      onClick={() => hideEntry(e)}
                      aria-label="Sakrij termin"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-300 transition-colors hover:bg-red-50 hover:text-red-400 dark:text-gray-600 dark:hover:bg-red-950/40"
                    >
                      <IconClose className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {subjectTermine.length === 0 && (
                  <p className="text-xs italic text-gray-400 dark:text-gray-500">Svi termini ovog predmeta su skriveni.</p>
                )}
              </div>
            </div>

            {/* Vezani rokovi — samo ako ih ima */}
            {subjectRokovi.length > 0 && (
              <div className="mb-4">
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Rokovi</h4>
                <div className="space-y-1.5">
                  {subjectRokovi.map((e, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-sm">
                      <span className="w-14 shrink-0 text-xs font-medium text-gray-700 dark:text-gray-200">{formatDateSr(e.date)}</span>
                      <span className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">{e.start}</span>
                      <span className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {e.tip === 'ispit' ? 'Ispit' : 'Kolokvijum'} · {e.rok}{e.rooms.length ? ` · ${e.rooms.join(', ')}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lična beleška */}
            <div className="rounded-xl border border-gray-200/80 bg-gray-50/60 p-3 dark:border-gray-700/70 dark:bg-gray-800/40">
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Beleška</h4>
              <textarea
                ref={noteRef}
                value={note}
                onChange={ev => saveNote(ev.target.value)}
                placeholder="Npr. poeni na vežbama, napomene..."
                rows={2}
                className="block max-h-64 min-h-14 w-full resize-none overflow-y-auto rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#024c7d] dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-100 dark:placeholder:text-gray-600 dark:focus:ring-[#60c3ad]"
              />
            </div>
          </div>
        )}
      </main>

      {/* "Nov semestar" — reset predmeta (kredencijali ostaju) */}
      {showFlipPopup && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-4 sm:items-center sm:pb-0"
          onClick={dismissFlip}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/75 bg-white/92 p-6 backdrop-blur-2xl dark:border-white/15 dark:bg-gray-900/90"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="mb-2 text-base font-semibold text-center text-gray-900 dark:text-gray-100">
              Nov semestar - Proveri predmete
            </h2>
            <p className="mb-6 text-sm text-center text-gray-600 dark:text-gray-300">
              Objavljen je raspored za novi semestar. 
              </p>
            <p className="mb-3 text-sm text-center text-gray-600 dark:text-gray-300">
              Ranije izabrani predmeti su
              resetovani, izaberi svoje predmete ponovo da ti raspored i rokovi
              budu tačni.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <button
                onClick={goPickSubjects}
                className="flex-1 rounded-lg py-2.5 text-sm font-medium active:scale-[0.97]
                           bg-[#024c7d] text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d]
                           dark:hover:bg-[#4db3a0] transition-colors"
              >
                Izaberi predmete
              </button>
              <button
                onClick={dismissFlip}
                className={`flex-1 rounded-lg py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 ${GLASS} hover:bg-white/80 dark:hover:bg-gray-800/70 transition-colors`}
              >
                Kasnije
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ICS tutorial modal */}
      {showIcsHelp && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-4 sm:items-center sm:pb-0"
          onClick={() => setShowIcsHelp(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/75 bg-white/92 p-6 backdrop-blur-2xl dark:border-white/15 dark:bg-gray-900/90"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
              Kako dodati u kalendar
            </h2>

            <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs text-white dark:bg-gray-100 dark:text-gray-900">1</span>
                <p>Fajl <strong className="text-gray-900 dark:text-gray-100">raspored.ics</strong> je upravo preuzet na tvoj uređaj.</p>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs text-white dark:bg-gray-100 dark:text-gray-900">2</span>
                <p>Otvori <strong className="text-gray-900 dark:text-gray-100">Google Calendar</strong> na računaru ili telefonu.</p>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs text-white dark:bg-gray-100 dark:text-gray-900">3</span>
                <p>Na računaru: klikni <strong className="text-gray-900 dark:text-gray-100">Podešavanja → Uvoz i izvoz</strong> i odaberi preuzeti fajl.</p>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs text-white dark:bg-gray-100 dark:text-gray-900">4</span>
                <p>Na telefonu: pronađi fajl u Downloads i klikni na njega — kalendar će se otvoriti automatski.</p>
              </div>
            </div>

            <button
              onClick={() => setShowIcsHelp(false)}
              className="mt-6 w-full rounded-lg py-2.5 text-sm font-medium active:scale-[0.97]
                         bg-[#024c7d] text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d]
                         dark:hover:bg-[#4db3a0] transition-colors"
            >
              Razumem
            </button>
          </div>
        </div>
      )}

      {/* Šta uključiti u link za deljenje */}
      {showShareChoice && (
        <div
          className="fixed inset-0 z-100 flex items-end justify-center bg-black/40 px-4 py-6 backdrop-blur-sm sm:items-center"
          onClick={() => setShowShareChoice(false)}
        >
          <div
            className={`w-full max-w-sm rounded-2xl p-5 ring-1 ring-[#024c7d]/15 dark:ring-white/15 ${GLASS}`}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Uključiti i prenesene predmete?</h3>
            <div className="mt-4 space-y-2">
              <button
                onClick={() => { void shareSchedule(true) }}
                className="w-full rounded-xl bg-[#024c7d] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0]"
              >
                Da, svi predmeti
              </button>
              <button
                onClick={() => { void shareSchedule(false) }}
                className={`w-full rounded-xl py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 ${GLASS} hover:bg-white/80 dark:hover:bg-gray-800/70 transition-colors`}
              >
                Ne, samo ovosemestralni
              </button>
            </div>
          </div>
        </div>
      )}

      {showDownloadToast && (
        <div className="fixed bottom-28 left-1/2 z-[100] -translate-x-1/2 animate-bounce sm:bottom-6">
          <div className="flex items-center gap-3 rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white shadow-xl dark:bg-gray-100 dark:text-gray-900">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-400 dark:text-green-600">
              ✓
            </span>
            Slika rasporeda je uspešno preuzeta!
          </div>
        </div>
      )}

      {showShareToast && (
        <div className="fixed bottom-28 left-1/2 z-[100] -translate-x-1/2 animate-bounce sm:bottom-6">
          <div className="flex items-center gap-3 rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white shadow-xl dark:bg-gray-100 dark:text-gray-900">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-400 dark:text-green-600">
              ✓
            </span>
            Link je kopiran!
          </div>
        </div>
      )}

      <AnimatePresence>
        {showTour && <AppTour slides={tourSlides} onClose={closeTour} />}
      </AnimatePresence>
    </>
  )
}
