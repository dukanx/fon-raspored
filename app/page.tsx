'use client'

import { Fragment, useState, useEffect, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import type { SemesterData } from '@/lib/types'
import { findGroup, getProgramsForYear } from '@/lib/schedule'
import { session, saved, app } from '@/lib/storage'
import { decodeShare } from '@/lib/share'
import { bootDecision, type BootDecision } from '@/lib/waiting'
import type { PendingSemester } from '@/lib/season'
import BlurText from '@/components/BlurText'
import TextType from '@/components/TextType'
import InstallPrompt from '@/components/InstallPrompt'
import WaitingForSchedule from '@/components/WaitingForSchedule'

const GLASS = 'liquid-glass'

// Koliko najduže čekamo odluku Raspored/Rokovi pre nego što odemo na poslednju
// poznatu stranu. Dovoljno da normalna mreža stigne, prekratko da se primeti
// kao zaglavljivanje.
const BOOT_DEADLINE_MS = 1500

// Izgled naslova na početnoj. 'blur' je originalni (BlurText, slova se stapaju
// jednom pri ulasku), 'type' je varijanta sa kucanjem gde se reč pored naslova
// vrti u krug. Menja se samo ovde — obe varijante su ispod, žive u repou.
// `as HeadingStyle` je namerno: bez toga TypeScript suzi tip konstante na
// 'blur' i onda poređenje sa 'type' prijavi kao nemoguće (ts2367).
type HeadingStyle = 'blur' | 'type'
const HEADING_STYLE = 'blur' as HeadingStyle

const TITLE_CLASS =
  'text-2xl font-semibold text-[#024c7d] lg:text-4xl lg:leading-[44px] lg:tracking-[-0.01em] dark:text-[#60c3ad]'

function BlurHeading() {
  return (
    <div className="mb-4 lg:mb-[22px]">
      {/* Ovo je pravi <h1> strane, ne dekoracija. Animacija je i dalje slovo po
          slovo, ali su spanovi u normalnom inline toku (v. BlurText), pa i
          čitač i pretraživač vide frazu "FON Raspored", a `ariaLabel` skida
          rizik da je neki čitač ipak izgovori slovkajući. */}
      <BlurText
        as="h1"
        ariaLabel="FON Raspored"
        text="FON Raspored"
        animateBy="letters"
        direction="top"
        delay={60}
        stepDuration={0.3}
        className={TITLE_CLASS}
      />
      <p className="mt-2 text-[15px] leading-[22px] text-pretty text-gray-500 lg:mt-2.5 lg:text-base dark:text-gray-400">
        Tvoj raspored nastave, ispita i kolokvijuma
      </p>
    </div>
  )
}

function TypedHeading() {
  return (
    // Naslov i reč koja se menja stoje u istom redu ("FON Raspored predavanja"),
    // poravnati po osnovnoj liniji. Flex je tu namerno — TextType sebi hardkoduje
    // `inline-block`, pa se na prirodan inline tok ne može računati.
    <>
      {/* Za razliku od BlurHeading-a, ovde <h1> mora da bude sr-only: tekst se
          kuca, pa u HTML-u pri prvom iscrtavanju ne postoji cela fraza, a flex
          bi ga svejedno razlomio na stavke. Kucanje ostaje aria-hidden
          dekoracija. */}
      <h1 className="sr-only">FON Raspored</h1>
      <div aria-hidden="true" className="mb-4 flex flex-wrap items-baseline gap-x-2 lg:mb-[22px]">
        <TextType
          as="p"
          text="FON Raspored"
          typingSpeed={70}
          initialDelay={150}
          loop={false}
          showCursor={false}
          className={`shrink-0 ${TITLE_CLASS}`}
        />
        {/* `initialDelay` je taman toliko da naslov levo prvo otkuca do kraja
            (150ms + 12 znakova × 70ms), pa da krene ovaj — inače se dva kucanja
            preklapaju i deluje nervozno. */}
        <TextType
          as="span"
          text={['predavanja', 'vežbi', 'ispita', 'kolokvijuma']}
          typingSpeed={55}
          deletingSpeed={30}
          pauseDuration={1800}
          initialDelay={1100}
          loop
          cursorCharacter="|"
          /* Rezervisana širina najduže reči ("kolokvijuma" = 73px + kursor 8px).
             Bez nje odluka o prelomu reda zavisi od reči koja se trenutno kuca, pa
             na uskim ekranima (320px) sadržaj ispod poskakuje na svakom ciklusu.
             Ovako je red ili uvek jedan, ili uvek dva. */
          className="min-w-21 text-sm text-gray-500 dark:text-gray-400"
          cursorClassName="text-gray-400 dark:text-gray-500"
        />
      </div>
    </>
  )
}

// Izvuče share kod iz nalepljenog teksta — bilo pun URL (.../deli?s=KOD) bilo
// sam kod. Omogućava da se deljeni raspored primeni i unutar sveže instalirane
// PWA (na iOS-u home-screen app ima odvojen storage od Safarija).
function extractShareCode(input: string): string {
  const t = input.trim()
  if (!t) return ''
  const m = t.match(/[?&]s=([^&\s]+)/)
  return m ? m[1] : t
}

/* ---------- Pregled rasporeda (dekoracija pored forme) ---------- */

const ICON = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

// Boje predmeta, iste kao COLORS u raspored/rokovi (bg / text / traka).
type Tone = { bg: string; text: string; bar: string; darkBg: string; darkText: string }
const TONE = {
  teal: { bg: '#d6f0ec', text: '#1a5e52', bar: '#60c3ad', darkBg: '#0f3530', darkText: '#8ed8ca' },
  purple: { bg: '#e8e7f5', text: '#44408a', bar: '#9b95c9', darkBg: '#1e1b3d', darkText: '#b8b4e0' },
  blue: { bg: '#cce0f0', text: '#012f4e', bar: '#004b7c', darkBg: '#051e30', darkText: '#7ab5d8' },
  red: { bg: '#fde6e5', text: '#892d2a', bar: '#f48580', darkBg: '#3d1512', darkText: '#f4a09c' },
  yellow: { bg: '#fff4d6', text: '#7a5a00', bar: '#ffcd67', darkBg: '#3d3200', darkText: '#ffd97a' },
  pink: { bg: '#f0d9ec', text: '#7a2e5a', bar: '#d057a0', darkBg: '#3d1a30', darkText: '#e8a8d0' },
} satisfies Record<string, Tone>

// Boje idu kroz CSS promenljive da bi `dark:` varijante radile i uz inline boje.
const toneVars = (t: Tone) =>
  ({ '--bg': t.bg, '--fg': t.text, '--bar': t.bar, '--bg-d': t.darkBg, '--fg-d': t.darkText }) as React.CSSProperties
const TONE_CLASS = 'bg-(--bg) text-(--fg) dark:bg-(--bg-d) dark:text-(--fg-d)'

const EKO = { name: 'Ekonomija', tone: TONE.teal }
const OIKT = { name: 'Osnove informaciono komunikacionih tehnologija', tone: TONE.purple }
const ENG = { name: 'Engleski jezik u informatici', tone: TONE.blue }
const EP = { name: 'Elektronsko poslovanje (NA)', tone: TONE.red }
const MEN = { name: 'Menadžment', tone: TONE.yellow }
const MAT = { name: 'Matematika 1', tone: TONE.pink }
type PreviewSubject = typeof EKO

type PreviewSlot = { subject: PreviewSubject; type: 'P' | 'V'; room: string }
const slot = (subject: PreviewSubject, type: 'P' | 'V', room: string): PreviewSlot => ({ subject, type, room })

// Pravi termini grupe A1 (1. godina, ISiT) iz 1god-zimski.json, zamrznuti ovde
// da početna ne bi učitavala podatke samo zbog dekoracije. Datumi ispita su
// izmišljeni (januarskog roka još nema u rokovi.json).
const PREVIEW_DATA = {
  list: [
    { day: 'Ponedeljak', rows: [
      { time: '08:15-10:00', ...slot(EKO, 'P', 'Amfiteatar 2') },
      { time: '10:15-12:00', ...slot(OIKT, 'P', 'Amfiteatar 2') },
      { time: '12:15-14:00', ...slot(OIKT, 'V', '08, 09, 20') },
    ] },
    { day: 'Utorak', rows: [
      { time: '08:15-10:00', ...slot(ENG, 'P', 'Amfiteatar 1') },
      { time: '10:15-12:00', ...slot(EP, 'P', 'Amfiteatar 1') },
    ] },
    { day: 'Sreda', rows: [
      { time: '08:15-10:00', ...slot(MEN, 'P', 'Amfiteatar 3') },
      { time: '10:15-12:00', ...slot(MAT, 'P', 'Amfiteatar 3') },
    ] },
    { day: 'Četvrtak', rows: [
      { time: '12:15-14:00', ...slot(EKO, 'V', '30') },
      { time: '14:15-16:00', ...slot(ENG, 'V', '30') },
    ] },
  ],
  weekDays: ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak'],
  // Red po terminu, kolona po danu (pon–pet); null je prazan termin.
  week: [
    { time: '08:15', cells: [slot(EKO, 'P', 'Amfiteatar 2'), slot(ENG, 'P', 'Amfiteatar 1'), slot(MEN, 'P', 'Amfiteatar 3'), null, slot(EP, 'V', '60, 61')] },
    { time: '10:15', cells: [slot(OIKT, 'P', 'Amfiteatar 2'), slot(EP, 'P', 'Amfiteatar 1'), slot(MAT, 'P', 'Amfiteatar 3'), null, slot(MAT, 'V', '14')] },
    { time: '12:15', cells: [slot(OIKT, 'V', '08, 09, 20'), null, null, slot(EKO, 'V', '30'), null] },
    { time: '14:15', cells: [null, null, null, slot(ENG, 'V', '30'), null] },
    { time: '16:15', cells: [null, null, null, null, null] },
  ],
  // Januar 2027: 1. pada u petak, pa su pre njega četiri prazna polja.
  calendarOffset: 4,
  exams: {
    6: MEN,
    11: MAT,
    14: EKO,
    16: { ...OIKT, name: 'OIKT' },
    20: ENG,
    27: EP,
  } as Record<number, PreviewSubject>,
} as const

// Telefon prikazuje isečak (dva dana liste, tri dana i četiri termina sedmice),
// desktop sve. Oba isečka su u HTML-u, a CSS bira koji se vidi, pa nema
// razlike između serverskog i klijentskog iscrtavanja.
function PreviewList({ desktop }: { desktop?: boolean }) {
  const days = desktop ? PREVIEW_DATA.list : PREVIEW_DATA.list.slice(2)
  return (
    <div className="flex flex-col gap-5">
      {days.map(d => (
        <div key={d.day} className="min-w-0">
          <p className="mb-2 border-b border-gray-200 pb-2 text-xs font-semibold tracking-[0.05em] text-gray-600 uppercase dark:border-gray-700 dark:text-gray-400">
            {d.day}
          </p>
          {d.rows.map(r => (
            <div
              key={r.time}
              style={toneVars(r.subject.tone)}
              className="mb-1 flex items-center gap-2 border-b border-gray-100 py-2.5 lg:mb-0 lg:gap-2.5 dark:border-gray-800"
            >
              <span className="w-[72px] shrink-0 text-xs font-medium text-gray-500 tabular-nums lg:w-[76px] dark:text-gray-400">
                {r.time}
              </span>
              <div className="w-1 self-stretch rounded-full bg-(--bar)" />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm text-gray-900 dark:text-gray-100">{r.subject.name}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{r.room}</span>
              </div>
              <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${TONE_CLASS}`}>{r.type}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function PreviewWeek({ desktop }: { desktop?: boolean }) {
  const cols = desktop ? 5 : 3
  const rows = desktop ? PREVIEW_DATA.week : PREVIEW_DATA.week.slice(0, 4)
  const empty =
    'min-h-[58px] rounded-[10px] border border-gray-200 bg-gray-100/60 lg:min-h-[84px] dark:border-gray-700/60 dark:bg-gray-800/40'
  return (
    <div className="grid grid-cols-[38px_repeat(3,minmax(0,1fr))] gap-1 lg:grid-cols-[52px_repeat(5,minmax(0,1fr))]">
      <div />
      {PREVIEW_DATA.weekDays.slice(0, cols).map(d => (
        <div key={d} className="py-1 text-center text-xs font-medium text-gray-500 lg:py-1.5 dark:text-gray-400">
          {d}
        </div>
      ))}
      {rows.map(r => (
        <Fragment key={r.time}>
          <div className="pt-1.5 pr-1 text-right text-[10px] text-gray-400 tabular-nums lg:pr-1.5 lg:text-[11px] dark:text-gray-500">
            {r.time}
          </div>
          {r.cells.slice(0, cols).map((c, i) =>
            c ? (
              <div
                key={i}
                style={toneVars(c.subject.tone)}
                className={`min-h-[58px] overflow-hidden rounded-[10px] px-2 py-[7px] lg:min-h-[84px] lg:px-3 lg:py-2.5 ${TONE_CLASS}`}
              >
                <p className="line-clamp-2 text-xs leading-[1.3] font-medium lg:text-[13px] lg:leading-[1.35]">{c.subject.name}</p>
                <p className="mt-[3px] truncate text-[10px] opacity-70 lg:mt-1 lg:text-[11px]">
                  {c.type} · {c.room}
                </p>
              </div>
            ) : (
              <div key={i} className={empty} />
            )
          )}
        </Fragment>
      ))}
    </div>
  )
}

const CAL_DAYS = ['pon', 'uto', 'sre', 'čet', 'pet', 'sub', 'ned']

function PreviewCalendar() {
  const arrow = 'liquid-glass flex size-8 items-center justify-center rounded-lg text-gray-600 dark:text-gray-300'
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className={arrow}>
          <svg {...ICON} className="size-4"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
        </div>
        <p className="text-sm font-semibold text-gray-900 lg:text-[15px] dark:text-gray-100">Januar 2027</p>
        <div className={arrow}>
          <svg {...ICON} className="size-4"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {CAL_DAYS.map(d => (
          <div key={d} className="py-1 text-center text-xs font-medium text-gray-400 dark:text-gray-500">{d}</div>
        ))}
        {Array.from({ length: PREVIEW_DATA.calendarOffset }, (_, i) => <div key={`x${i}`} />)}
        {Array.from({ length: 31 }, (_, i) => {
          const day = i + 1
          const exam = PREVIEW_DATA.exams[day]
          return (
            <div
              key={day}
              className={`min-h-[50px] overflow-hidden rounded-lg border border-gray-100 p-1.5 lg:min-h-24 lg:rounded-[10px] lg:p-2 dark:border-gray-800 ${
                exam ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-900/30'
              }`}
            >
              <span
                className={`mb-1 block text-xs leading-none font-medium lg:text-[13px] ${
                  exam ? 'text-gray-900 dark:text-gray-100' : 'text-gray-300 dark:text-gray-600'
                }`}
              >
                {day}
              </span>
              {exam && (
                <div style={toneVars(exam.tone)} className={`overflow-hidden rounded-sm px-0.5 lg:rounded lg:px-[5px] lg:py-0.5 ${TONE_CLASS}`}>
                  <span className="block truncate text-[9px] leading-[1.25] font-medium lg:text-[11px]">{exam.name}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const PREVIEW_INTERVAL_MS = 4000

// Koliko traje odlazak početne pre prelaza na /izborni (v. `leave-*` u
// globals.css). Toliko se čeka pre navigacije da bi se odlazak video.
const LEAVE_MS = 250
const PREVIEW_TRANSITION = 'opacity .9s ease, transform 1s cubic-bezier(.2,.7,.2,1)'

// Tri sloja (lista, sedmica, kalendar) koji se smenjuju: aktivan izađe
// naniže, a sledeći uđe odozgo. Sloj koji tek dolazi skoči na početnu
// poziciju bez tranzicije, dok je nevidljiv. Čitačima je sakriven, a tap
// prolazi kroz njega.
function LandingPreview({ leaving }: { leaving: boolean }) {
  const [pv, setPv] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setPv(p => (p + 1) % 3), PREVIEW_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  const layerStyle = (i: number): React.CSSProperties => {
    const rel = (i - pv + 3) % 3
    if (rel === 0) return { opacity: 1, transform: 'none', transition: PREVIEW_TRANSITION }
    if (rel === 2) return { opacity: 0, transform: 'translateY(18px)', transition: PREVIEW_TRANSITION }
    return { opacity: 0, transform: 'translateY(-14px)', transition: 'none' }
  }

  const fade = 'linear-gradient(to bottom, #000 var(--fade), transparent 100%)'
  const layers = [
    <Fragment key="list">
      <div className="lg:hidden"><PreviewList /></div>
      <div className="hidden lg:block"><PreviewList desktop /></div>
    </Fragment>,
    <Fragment key="week">
      <div className="lg:hidden"><PreviewWeek /></div>
      <div className="hidden lg:block"><PreviewWeek desktop /></div>
    </Fragment>,
    <PreviewCalendar key="cal" />,
  ]

  return (
    <div
      aria-hidden="true"
      style={{ maskImage: fade, WebkitMaskImage: fade }}
      className={`pointer-events-none relative min-h-[240px] flex-1 overflow-hidden select-none [--fade:35%] lg:mt-10 lg:h-[620px] lg:flex-none lg:[--fade:55%] ${leaving ? 'leave-down' : ''}`}
    >
      {layers.map((layer, i) => (
        <div key={i} style={layerStyle(i)} className="absolute inset-x-0 top-0 px-2 lg:px-0">
          {layer}
        </div>
      ))}
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()

  // undefined: korisnik još nije birao, pa važi sačuvana godina (povratak
  // preko ?edit=1 odmah otvara drugi korak). null: prvi korak, izbor godine.
  const [year, setYear] = useState<number | null | undefined>(undefined)
  const [steppedBack, setSteppedBack] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [program, setProgram] = useState<string | null>(null)
  const [lastName, setLastName] = useState<string | null>(null)
  const [data, setData] = useState<SemesterData | null>(null)
  const [programs, setPrograms] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shareInput, setShareInput] = useState('')
  const [shareError, setShareError] = useState<string | null>(null)
  // Period "čekamo raspored" (v. lib/season): umesto koraka ide WaitingForSchedule.
  const [pending, setPending] = useState<PendingSemester | null>(null)
  const isHydrated = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false
  )

  const storedYear = isHydrated
    ? (() => {
      const raw = saved.year.get()
      if (!raw) return null
      const parsed = Number(raw)
      return Number.isFinite(parsed) ? parsed : null
    })()
    : null

  const selectedYear = year === undefined ? storedYear : year
  const selectedProgram = program ?? (isHydrated ? (saved.program.get() ?? '') : '')
  const enteredLastName = lastName ?? (isHydrated ? (saved.lastName.get() ?? '') : '')

  useEffect(() => {
    if (!isHydrated) return

    // Onboarding je do ovog trenutka sakriven (klasa `fon-booting`, v. skriptu u
    // layout.tsx). Otkrivamo ga čim se zna da preusmerenja nema, i na izlasku sa
    // strane — inače bi klijentska navigacija nazad na `/` zatekla klasu i
    // ostavila prazan ekran.
    const showOnboarding = () => document.documentElement.classList.remove('fon-booting')

    // Korisnik je svesno došao da izmeni podatke (klik na "1. Podaci") — ne preusmeravaj.
    if (new URLSearchParams(window.location.search).get('edit') === '1') {
      showOnboarding()
      return
    }

    // Raspored ili Rokovi (stvarni datumi iz rokovi.json, ne pretpostavljeni
    // akademski kalendar), i da li je period "čekamo raspored" (v. lib/waiting).
    // Do odluke se vidi samo pozadina, a `/data/*.json` je u service workeru
    // network-first — na lošoj vezi bi se čekalo dok mreža ne odustane. Posle
    // ovog roka idemo na poslednju poznatu stranu, kao da čekanja nema.
    function decision(): Promise<BootDecision> {
      return Promise.race([
        bootDecision(),
        new Promise<BootDecision>(resolve =>
          setTimeout(() => resolve({ dest: app.defaultTab.get()?.dest ?? '/raspored', pending: null }), BOOT_DEADLINE_MS)
        ),
      ])
    }

    // U periodu čekanja nema preusmerenja ni za stare korisnike: umesto
    // izbora godine i prezimena, kartica kaže da raspored još nije objavljen.
    function boot(redirect: boolean) {
      void decision().then(({ dest, pending }) => {
        if (pending) {
          setPending(pending)
          showOnboarding()
        } else if (redirect) {
          router.replace(dest)
        } else {
          showOnboarding()
        }
      })
    }

    // Isti tab — sessionStorage ima grupu
    if (session.group.get()) {
      boot(true)
      return showOnboarding
    }
    // Novi tab/browser — localStorage ima grupu (korisnik je već prošao onboarding)
    const savedGroup = saved.group.get()
    const savedYear = saved.year.get()
    if (savedGroup && savedYear) {
      session.group.set(savedGroup)
      session.year.set(savedYear)
      const prog = saved.program.get()
      const name = saved.lastName.get()
      const sem = saved.semester.get()
      if (prog) session.program.set(prog)
      if (name) session.lastName.set(name)
      if (sem) session.semester.set(sem)
      // Postojeći korisnik (već ima sačuvan identitet) — tutorial je samo za nove.
      app.tutorialSeen.set()
      boot(true)
      return showOnboarding
    }

    // Nov korisnik — nema identiteta ni preusmerenja. Onboarding se odmah
    // prikazuje, a ekran čekanja ga zameni ako je period čekanja.
    showOnboarding()
    boot(false)
  }, [isHydrated, router])

  // Drugi korak vodi na /izborni — učitaj je unapred, da posle animacije
  // odlaska ne bi bilo čekanja na mrežu.
  useEffect(() => {
    if (selectedYear !== null) router.prefetch('/izborni')
  }, [selectedYear, router])

  // Učitaj JSON kad se odabere godina
  useEffect(() => {
    if (!selectedYear) return

    fetch(`/data/${selectedYear}god.json`)
      .then(r => r.json())
      .then((d: SemesterData) => {
        setData(d)
        setPrograms(getProgramsForYear(d))

      })
      .catch(() => setError('Greška pri učitavanju podataka.'))
      .finally(() => setLoading(false))
  }, [selectedYear])

  function handleYearSelect(selectedYear: number) {
    setYear(selectedYear)
    setLoading(true)
    setError(null)
    setProgram('')
    setData(null)
  }

  // Tap na godinu odmah vodi na korak 2. Kratko kašnjenje ostavlja vremena da
  // se vidi da je pilula stisnuta pre prelaza.
  function pickYear(n: number) {
    setTimeout(() => {
      handleYearSelect(n)
      setShareOpen(false)
    }, 140)
  }

  function goBack() {
    setYear(null)
    setSteppedBack(true)
    setError(null)
  }

  // Upisuje izbor u session (aktivni tab) + saved (trajno) i vodi na /izborni.
  // sessionLastName dozvoljava fallback na grupu kad prezime nije uneto.
  function commitSelection(
    groupId: string,
    opts: { year: number; program: string; lastName: string; semester: string; sessionLastName?: string }
  ) {
    const yr = String(opts.year)
    session.group.set(groupId)
    session.year.set(yr)
    session.lastName.set(opts.sessionLastName ?? opts.lastName)
    session.semester.set(opts.semester)
    if (opts.program) session.program.set(opts.program)

    saved.group.set(groupId)
    saved.year.set(yr)
    saved.program.set(opts.program)
    saved.lastName.set(opts.lastName)
    saved.semester.set(opts.semester)
  }

  function handleSubmit() {
    if (!data || !enteredLastName.trim() || selectedYear === null) return
    setError(null)

    const raw = enteredLastName.trim()
    const program = selectedProgram || null
    let groupId = findGroup(data, raw, program)
    let usedName = raw

    // Čest slučaj: uneto "Ime Prezime" — probaj samo poslednju reč (prezime).
    if (!groupId && /\s/.test(raw)) {
      const surnameOnly = raw.split(/\s+/).pop() ?? ''
      const retry = surnameOnly ? findGroup(data, surnameOnly, program) : null
      if (retry) {
        groupId = retry
        usedName = surnameOnly
      }
    }

    if (!groupId) {
      setError(
        `Nismo našli grupu za „${raw}". Unesi samo prezime (bez imena), probaj sa kvačicama (č, ć, š, ž, đ) ili bez njih, a možeš i da odabereš grupu direktno ispod.`
      )
      return
    }

    // Sačuvaj izbor pa redirectuj
    commitSelection(groupId, {
      year: selectedYear,
      program: selectedProgram,
      lastName: usedName,
      semester: data.semester,
    })
    goToSubjects()
  }

  // Početna prvo ode (kartica ulevo, pregled naniže), pa tek onda navigacija,
  // gde /izborni ulazi zdesna — kao sledeći korak čarobnjaka. Uz "smanji
  // pokrete" ide se odmah.
  function goToSubjects() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      router.push('/izborni')
      return
    }
    setLeaving(true)
    setTimeout(() => router.push('/izborni'), LEAVE_MS)
  }

  // Otvori deljeni raspored iz nalepljenog linka — vodi na /deli koji radi u
  // istom (PWA) kontekstu, pa se primenjuje na pravi storage.
  function openSharedLink() {
    const code = extractShareCode(shareInput)
    if (!code || !decodeShare(code)) {
      setShareError('Link nije važeći. Nalepi ceo link koji si dobio.')
      return
    }
    router.push(`/deli?s=${code}`)
  }

  const canSubmit =
    selectedYear !== null &&
    enteredLastName.trim().length > 1 &&
    selectedProgram !== '' &&
    !loading &&
    !leaving

  const field =
    'h-10 px-3 rounded-xl border border-[#024c7d]/15 text-sm text-gray-900 dark:text-gray-100 bg-white/70 dark:bg-gray-900/65 dark:border-white/20 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#024c7d] dark:focus:ring-[#60c3ad] focus:border-transparent'
  const label = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
  const primary =
    'bg-[#024c7d] text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0]'
  const primaryDisabled = 'bg-white/60 text-gray-400 cursor-not-allowed dark:bg-gray-800/68 dark:text-gray-500'

  return (
    // Na telefonu kartica i pregled zajedno pune tačno prvi ekran (100dvh bez
    // safe-area pojaseva koje body oduzima paddingom, pa minus gornji padding),
    // a footer je ispod. Na desktopu stoje jedno pored drugog.
    <main data-onboarding className="relative flex min-h-[calc(100dvh-var(--safe-y))] flex-col px-4 pt-5 pb-5 lg:px-14 lg:pt-0 lg:pb-6">
      <div className="flex min-h-[calc(100dvh-var(--safe-y)-20px)] flex-col gap-6 lg:mx-auto lg:grid lg:min-h-0 lg:w-full lg:max-w-[1360px] lg:flex-1 lg:grid-cols-[440px_minmax(0,1fr)] lg:items-center lg:gap-16 lg:pt-12">
        <div className={`flex shrink-0 flex-col gap-3 ${leaving ? 'leave-left' : ''}`}>
          <div className={`rounded-[28px] px-6 pt-8 pb-7 ring-1 ring-[#024c7d]/15 shadow-[0_18px_60px_rgba(2,76,125,0.10)] lg:px-10 lg:pt-11 lg:pb-10 dark:ring-white/15 dark:shadow-[0_18px_60px_rgba(0,0,0,0.35)] ${GLASS}`}>

            {/* <h1> nosi sama varijanta naslova — vidljiv u BlurHeading-u, sr-only
                u TypedHeading-u (v. komentare tamo). Ovde ga namerno nema da strana
                ne bi imala dva h1. */}
            {HEADING_STYLE === 'type' ? <TypedHeading /> : <BlurHeading />}

            {/* U periodu čekanja FON-ovog rasporeda još nema, pa bi ova
                napomena samo gurala poruku o tome naniže. */}
            {!pending && (
              <p className="mb-8 flex items-start gap-1.5 text-xs text-pretty text-gray-500 lg:mb-10 lg:gap-2 lg:text-[13px] lg:leading-[18px] dark:text-gray-400">
                <svg {...ICON} aria-hidden="true" className="mt-px size-3.5 shrink-0 text-[#60c3ad] lg:size-[15px]">
                  <circle cx="12" cy="12" r="9" />
                  <path d="m8.5 12.5 2.5 2.5 4.5-5" />
                </svg>
                <span>Podaci su sa sajta FON-a. Raspored nastave, ispiti i kolokvijumi se redovno osvežavaju.</span>
              </p>
            )}

            {/* Koraci se renderuju uslovno da bi se ulazne animacije pokrenule
                pri svakoj promeni koraka (animacija ide na montiranje). */}
            {pending ? (
              <WaitingForSchedule pending={pending} savedGroup={isHydrated ? saved.group.get() : null} />
            ) : selectedYear === null ? (
              // Pri prvom učitavanju bez animacije, samo pri povratku sa koraka 2.
              <div className={steppedBack ? 'anim-up' : undefined} style={{ animationDuration: '0.4s' }}>
                <p id="godina-label" className="mb-3 text-sm font-medium text-gray-700 lg:text-[15px] lg:leading-[22px] dark:text-gray-300">
                  Izaberi godinu studija
                </p>
                <div role="group" aria-labelledby="godina-label" className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map(y => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => pickYear(y)}
                      className="btn-lift rounded-full border border-[#024c7d]/15 bg-white/70 py-2 text-sm font-medium text-gray-700 hover:bg-white/90 lg:py-[13px] lg:text-base lg:leading-[22px] dark:border-white/20 dark:bg-gray-900/55 dark:text-gray-300 dark:hover:bg-gray-800/70"
                    >
                      {y}.
                    </button>
                  ))}
                </div>

                {/* Nalepi deljeni link — koristi se npr. posle instalacije PWA
                    (iOS home screen app ima odvojen storage od Safarija) */}
                <div className="mt-7 border-t border-[#024c7d]/12 pt-5 lg:mt-9 lg:pt-6 dark:border-white/15">
                  {shareOpen ? (
                    <div className="anim-up mt-3" style={{ animationDuration: '0.35s' }}>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          autoFocus
                          aria-label="Link deljenog rasporeda"
                          value={shareInput}
                          onChange={e => { setShareInput(e.target.value); setShareError(null) }}
                          onKeyDown={e => e.key === 'Enter' && shareInput.trim() && openSharedLink()}
                          placeholder="Nalepi link…"
                          className={`min-w-0 flex-1 ${field}`}
                        />
                        <button
                          type="button"
                          onClick={openSharedLink}
                          disabled={!shareInput.trim()}
                          className={`btn-lift shrink-0 rounded-xl px-4 text-sm font-medium ${shareInput.trim() ? primary : primaryDisabled}`}
                        >
                          Otvori
                        </button>
                      </div>
                      {shareError && (
                        <p className="mt-2 text-xs text-red-500 dark:text-red-400 text-center">{shareError}</p>
                      )}
                    </div>
                  ) : (
                    <p className="flex items-center justify-center gap-1.5 text-[13px] leading-[18px] text-gray-500 dark:text-gray-400">
                      Dobio si nečiji raspored?
                      {/* Padding + negativna margina: veća površina za tap bez
                          pomeranja reda. */}
                      <button
                        type="button"
                        onClick={() => setShareOpen(true)}
                        className="no-hover-lift -my-2.5 px-1 py-2.5 font-medium text-[#024c7d] hover:underline dark:text-[#60c3ad]"
                      >
                        Nalepi link
                      </button>
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div className="anim-left mb-4 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={goBack}
                    aria-label="Nazad na godinu"
                    className={`btn-lift flex size-9 items-center justify-center rounded-full text-gray-600 dark:text-gray-300 ${GLASS}`}
                  >
                    <svg {...ICON} aria-hidden="true" className="size-4 opacity-80">
                      <path d="M19 12H5" />
                      <path d="m12 19-7-7 7-7" />
                    </svg>
                  </button>
                  <span
                    className="anim-pop rounded-full border border-[#024c7d]/15 bg-[#024c7d]/8 px-3 py-1 text-sm font-semibold text-[#024c7d] dark:border-white/15 dark:bg-white/10 dark:text-[#60c3ad]"
                    style={{ animationDelay: '40ms' }}
                  >
                    {selectedYear}. godina
                  </span>
                </div>

                <label htmlFor="program" className={`anim-up ${label}`} style={{ animationDelay: '80ms' }}>
                  Studijski program
                </label>
                {loading ? (
                  <div
                    className="anim-up mb-5 h-10 rounded-xl bg-white/60 dark:bg-gray-800/68 animate-pulse"
                    style={{ animationDelay: '110ms' }}
                  />
                ) : (
                  <select
                    id="program"
                    value={selectedProgram}
                    onChange={e => setProgram(e.target.value)}
                    className={`anim-up mb-5 w-full ${field}`}
                    style={{ animationDelay: '110ms' }}
                  >
                    <option value="">Izaberi program...</option>
                    {programs.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                )}

                <label htmlFor="prezime" className={`anim-up ${label}`} style={{ animationDelay: '170ms' }}>
                  Prezime
                </label>
                <input
                  id="prezime"
                  type="text"
                  value={enteredLastName}
                  onChange={e => setLastName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && canSubmit && handleSubmit()}
                  placeholder="npr. Petrović"
                  className={`anim-up mb-5 w-full ${field}`}
                  style={{ animationDelay: '200ms' }}
                />

                {/* Greška */}
                {error && (
                  <p className="mb-4 rounded-xl border border-red-200/70 bg-red-50/80 px-3 py-2 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
                    {error}
                  </p>
                )}

                {/* Ulazna animacija je na omotaču: `anim-up` ostavlja transform
                    na elementu i pregazio bi podizanje i pritisak (btn-lift). */}
                <div className="anim-up" style={{ animationDelay: '250ms' }}>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className={`btn-lift w-full rounded-xl py-3 text-sm font-medium ${canSubmit ? primary : primaryDisabled}`}
                  >
                    Izaberi predmete
                  </button>
                </div>

                {/* Fallback - ručni odabir grupe */}
                {data && (
                  <div className="mt-6 border-t border-[#024c7d]/15 pt-6 dark:border-white/20">
                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center mb-3">
                      Znaš svoju grupu? Odaberi direktno
                    </p>
                    <select
                      aria-label="Grupa"
                      onChange={e => {
                        if (!e.target.value) return
                        const groupId = e.target.value
                        commitSelection(groupId, {
                          year: selectedYear,
                          program: selectedProgram,
                          lastName: enteredLastName.trim(),
                          sessionLastName: enteredLastName.trim() || groupId,
                          semester: data.semester,
                        })
                        goToSubjects()
                      }}
                      className={`w-full ${field}`}
                    >
                      <option value="">Odaberi grupu...</option>
                      {Object.entries(data.groups)
                        .sort(([a], [b]) => a.localeCompare(b, 'sr', { numeric: true, sensitivity: 'base' }))
                        .map(([id, g]) => (
                          <option key={id} value={id}>
                            {id} — {g.program} ({g.range})
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* U periodu čekanja instalacija je deo same kartice. */}
          {!pending && <InstallPrompt compact />}
        </div>

        <LandingPreview leaving={leaving} />
      </div>

      <footer className={`w-full space-y-1.5 pt-7 text-center text-xs text-gray-400 lg:pt-3 dark:text-gray-600 ${leaving ? 'leave-fade' : ''}`}>
        {/* Bezličan opis, jedina prava rečenica na stranici. Postoji radi pretrage:
            osim <h1> i ove rečenice sve ostalo su dugmad i polja, pa Google
            inače nema šta da poveže sa upitom tipa "raspored nastave FON".
            Ruta je prerenderovana u statički HTML, dakle vidi se i bez JS-a.
            Formulacija prati ostatak aplikacije: "nastava", ne "časovi" —
            ovo je fakultet, ne škola. */}
        <p className="mx-auto max-w-sm leading-relaxed text-balance">
          <strong className="font-medium text-gray-500 dark:text-gray-500">FON Raspored</strong>
          {' '}- raspored nastave, ispitni rokovi i kolokvijumi za studente
          Fakulteta organizacionih nauka u Beogradu.
        </p>
        <p>
          Made by{' '}
          <a
            href="https://github.com/dukanx"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#024c7d] dark:text-[#60c3ad] hover:underline font-medium"
          >
            dukanx
          </a>
        </p>
      </footer>
    </main>
  )
}
