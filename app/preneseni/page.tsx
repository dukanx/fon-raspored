'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { SemesterData, ScheduleEntry } from '@/lib/types'
import { getScheduleForGroup } from '@/lib/schedule'

const SLOT_LABEL: Record<string, string> = {
  '08:15': '08:15–10:00', '10:15': '10:15–12:00',
  '12:15': '12:15–14:00', '14:15': '14:15–16:00',
  '16:15': '16:15–18:00', '18:15': '18:15–20:00',
}

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

  useEffect(() => {
    const group = sessionStorage.getItem('fon_group')
    const year = sessionStorage.getItem('fon_year')
    if (!group || !year) { router.replace('/'); return }

    fetch(`/data/${year}god.json`)
      .then(r => r.json())
      .then((data: SemesterData) => {
        const all = getScheduleForGroup(data, group)
        const saved = localStorage.getItem(`fon_subjects_${group}`)
        let baseFiltered = saved
          ? all.filter(e => {
            const checked: Record<string, boolean> = JSON.parse(saved)
            return checked[e.subject] !== false
          })
          : all

        const extra = localStorage.getItem(`fon_extra_${group}`)
        if (extra) {
          const extraEntries: ScheduleEntry[] = JSON.parse(extra)
          // Automatsko gaženje: sakrij redovne predmete koji se poklapaju sa dodatim prenesenim
          baseFiltered = baseFiltered.filter(b => !extraEntries.some(ex => ex.day === b.day && ex.start === b.start))
          baseFiltered = [...baseFiltered, ...extraEntries]
        }

        setTrenutniRaspored(baseFiltered)
      })

    const extra = localStorage.getItem(`fon_extra_${group}`)
    if (extra) setExtraTermini(JSON.parse(extra))
  }, [router])

  function obrisiTermin(index: number) {
    const group = sessionStorage.getItem('fon_group')
    const novi = extraTermini.filter((_, i) => i !== index)
    setExtraTermini(novi)
    localStorage.setItem(`fon_extra_${group}`, JSON.stringify(novi))
    // Opciono: refetch da bi se odmah vratio "pregaženi" predmet, ili reload strane
    window.location.reload()
  }

  function handleGodinaSelect(g: number) {
    setGodina(g)
    setOdabraniPredmet('')
    setPredmeti([])
    setDostupniTermini([])
    setPreporuka(null)
    setOdabranoPredavanje(null)
    setOdabraneVezbe(null)
    setDodato(false)

    if (godineData[g]) {
      const unique = [...new Set(godineData[g].entries.map(e => e.subject))].sort()
      setPredmeti(unique)
      return
    }

    setLoadingData(true)
    fetch(`/data/${g}god.json`)
      .then(r => r.json())
      .then((data: SemesterData) => {
        setGodineData(prev => ({ ...prev, [g]: data }))
        const unique = [...new Set(data.entries.map(e => e.subject))].sort()
        setPredmeti(unique)
      })
      .finally(() => setLoadingData(false))
  }

  function handlePredmetSelect(predmet: string) {
    setOdabraniPredmet(predmet)
    setPreporuka(null)
    setOdabranoPredavanje(null)
    setOdabraneVezbe(null)
    setDodato(false)

    if (!godina || !godineData[godina]) return

    const termini = godineData[godina].entries.filter(e => e.subject === predmet)
    setDostupniTermini(termini)
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
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Izmena rasporeda
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
              Ovde možeš da ubaciš <strong>prenesene predmete</strong>, ili da odabereš predmet koji trenutno slušaš kako bi mu <strong>promenio termin</strong>.
            </p>
          </div>
          <button
            onClick={() => router.push('/raspored')}
            className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200
                       rounded-lg bg-white dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700
                       hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
          >
            ← Nazad
          </button>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 space-y-5">

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
                    className="flex items-center gap-3 py-2 px-3 bg-gray-50 dark:bg-gray-800
                     rounded-lg border border-gray-100 dark:border-gray-700"
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
                       transition-colors flex-shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => {
                    const group = sessionStorage.getItem('fon_group')
                    setExtraTermini([])
                    localStorage.removeItem(`fon_extra_${group}`)
                    window.location.reload()
                  }}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  Obriši sve
                </button>
              </div>
            </div>
          )}

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
                  className={`py-2 rounded-lg text-sm font-medium border transition-colors
                    ${godina === g
                      ? 'bg-[#024c7d] text-white border-[#024c7d] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:border-[#60c3ad]'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700 dark:hover:border-gray-500'
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
                <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
              ) : (
                <select
                  value={odabraniPredmet}
                  onChange={e => handlePredmetSelect(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 text-sm
                             text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900
                             focus:outline-none focus:ring-2 focus:ring-[#024c7d] dark:focus:ring-[#60c3ad]
                             focus:border-transparent"
                >
                  <option value="">Odaberi predmet...</option>
                  {predmeti.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              )}
            </div>
          )}

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
                          className={`flex items-center gap-3 py-2 px-3 rounded-lg cursor-pointer
                        transition-colors border
                        ${odabranoPredavanje === e
                              ? 'bg-[#024c7d] border-[#024c7d] dark:bg-[#60c3ad] dark:border-[#60c3ad]'
                              : preklapanje 
                                ? 'bg-orange-50/50 dark:bg-orange-900/10 border-transparent hover:bg-orange-50 dark:hover:bg-orange-900/20' 
                                : 'bg-gray-50 dark:bg-gray-800/60 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700/60'}`}
                        >
                          <input
                            type="checkbox"
                            checked={odabranoPredavanje === e}
                            onChange={() => {
                              setOdabranoPredavanje(prev => prev === e ? null : e)
                              setDodato(false)
                            }}
                            className="flex-shrink-0"
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
                          className={`flex items-center gap-3 py-2 px-3 rounded-lg cursor-pointer
                        transition-colors border
                        ${odabraneVezbe === e
                              ? 'bg-[#024c7d] border-[#024c7d] dark:bg-[#60c3ad] dark:border-[#60c3ad]'
                              : preklapanje 
                                ? 'bg-orange-50/50 dark:bg-orange-900/10 border-transparent hover:bg-orange-50 dark:hover:bg-orange-900/20' 
                                : 'bg-gray-50 dark:bg-gray-800/60 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700/60'}`}
                        >
                          <input
                            type="checkbox"
                            checked={odabraneVezbe === e}
                            onChange={() => {
                              setOdabraneVezbe(prev => prev === e ? null : e)
                              setDodato(false)
                            }}
                            className="flex-shrink-0"
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
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors
                ${loading
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500'
                  : 'bg-[#024c7d] text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0]'}`}
            >
              {loading ? 'Analiziram...' : '✨ Predloži najbolje termine (P + V)'}
            </button>
          )}

          {/* Preporuka */}
          {preporuka && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">AI preporuka</p>
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
                const saved = localStorage.getItem(`fon_extra_${sessionStorage.getItem('fon_group')}`)
                const extra: ScheduleEntry[] = saved ? JSON.parse(saved) : []
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

                localStorage.setItem(
                  `fon_extra_${sessionStorage.getItem('fon_group')}`,
                  JSON.stringify(extra)
                )
                setDodato(true)
                // Reload da bi se osvežio trenutni raspored i prikazala promena odmah
                window.location.reload()
              }}
              disabled={!canAdd}
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors
      ${dodato
                  ? 'bg-green-100 text-green-800 cursor-default dark:bg-green-950/50 dark:text-green-300'
                  : canAdd
                    ? 'bg-[#024c7d] text-white hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0]'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500'}`}
            >
              {dodato ? '✓ Dodato u raspored' : 'Dodaj odabrane termine u raspored'}
            </button>
          )}

        </div>
      </div>
    </main>
  )
}