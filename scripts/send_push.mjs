// Šalje Web Push notifikacije svim pretplatnicima.
// Pokreće se iz GitHub Actions-a (Node). Pretplate čita iz Upstash Redisa,
// šalje preko VAPID-a, i čisti mrtve pretplate (HTTP 404/410).
//
//   node scripts/send_push.mjs new         -> "dodat je novi raspored ..." (čita pending_notify.json)
//   node scripts/send_push.mjs reminders   -> podsetnici dan pred početak/kraj prijave (čita rokovi.json)
//   node scripts/send_push.mjs nastava "Zimski 2026/27"
//                                          -> "objavljen je raspored nastave" (jednom po semestru)
//   node scripts/send_push.mjs nastava-izmena "Zimski 2026/27" "<oznaka verzije>" <izmene.json>
//                                          -> "raspored nastave je izmenjen" samo onima kojima se
//                                             promenio predmet koji prate (jednom po verziji;
//                                             izmene.json pravi scripts/izmenjene-grupe.ts)
//
// Env: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:),
//      UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import webpush from 'web-push'
import { Redis } from '@upstash/redis'
import { porukaOIzmeni } from './ciljanje.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SUBS_KEY = 'push:subs'
const ROKOVI_FILE = join(__dirname, '..', 'public', 'data', 'rokovi.json')
const PENDING_FILE = join(__dirname, 'pending_notify.json')
// Podsetnici za prijavu vode pravo na eStudent (gde se prijava i radi).
const ESTUDENT_URL = 'https://student.fon.bg.ac.rs/security/login.jsf'

const redis = Redis.fromEnv()

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:nikoladukic04@gmail.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

// --- datumi -----------------------------------------------------------------

// Današnji datum (YYYY-MM-DD) u beogradskoj zoni, nezavisno od TZ runnera.
function todayBelgrade() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Belgrade',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(new Date()) // npr. "2026-05-23"
}

// "05.04.2026." -> "2026-04-05"
function srToIso(s) {
  if (!s) return null
  const m = s.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/)
  if (!m) return null
  const [, d, mo, y] = m
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

// --- payload-i --------------------------------------------------------------

function newRokPayloads() {
  if (!existsSync(PENDING_FILE)) return []
  let roks = []
  try {
    roks = JSON.parse(readFileSync(PENDING_FILE, 'utf-8'))
  } catch {
    return []
  }
  return roks.map((r) => {
    const kind = r.tip === 'ispit' ? 'ispita' : 'kolokvijuma'
    return {
      title: `Novi raspored ${kind}`,
      body: r.rok ? r.rok : `Novi raspored ${kind}.`,
      url: '/rokovi',
      tag: `rok-${r.rok || kind}`,
    }
  })
}

function reminderPayloads() {
  if (!existsSync(ROKOVI_FILE)) return []
  const roks = JSON.parse(readFileSync(ROKOVI_FILE, 'utf-8'))
  const today = todayBelgrade()
  const payloads = []

  for (const r of roks) {
    const dates = (r.prijava_datumi || []).map(srToIso).filter(Boolean).sort()
    if (dates.length === 0) continue

    const start = dates[0]
    const end = dates[dates.length - 1]

    // Jednodnevna prijava (start === end) - samo jedna poruka tog dana.
    if (start === end) {
      if (start === today) {
        payloads.push({
          title: 'Prijava je danas',
          body: `${r.rok} (samo danas) - klikni za eStudent`,
          url: ESTUDENT_URL,
          tag: `prijava-${r.rok}`,
        })
      }
      continue
    }

    if (start === today) {
      payloads.push({
        title: 'Prijava počinje danas',
        body: `${r.rok} - klikni za eStudent`,
        url: ESTUDENT_URL,
        tag: `prijava-start-${r.rok}`,
      })
    }
    if (end === today) {
      payloads.push({
        title: 'Poslednji dan prijave',
        body: `${r.rok} - klikni za eStudent`,
        url: ESTUDENT_URL,
        tag: `prijava-end-${r.rok}`,
      })
    }
  }
  return payloads
}

// Novi semestar u god.json (okida ga notify-nastava.yml posle merge-a).
// Zimski = nova školska godina: aplikacija vraća starog korisnika na izbor
// godine (v. lib/semester.ts), pa poruka to najavi.
function nastavaPayloads(semester) {
  if (!semester) return []
  const isZimski = semester.toLowerCase().startsWith('zimski')
  return [{
    title: `Objavljen je raspored - ${semester}`,
    body: isZimski
      ? 'Nova školska godina: izaberi godinu koju upisuješ i svoje predmete.'
      : 'Izaberi predmete za novi semestar.',
    url: '/raspored',
    tag: `nastava-${semester}`,
  }]
}

// Izmenjen raspored istog semestra (sale, termini, novi predmeti). `version`
// razlikuje izmene, pa svaka stigne jednom.
// Tekst se piše za svakog pretplatnika posebno (zaIzmene).
function nastavaIzmenaPayloads(semester, version) {
  if (!semester || !version) return []
  return [{
    title: 'Raspored nastave je izmenjen',
    url: '/raspored',
    tag: `nastava-izmena-${semester}-${version}`,
  }]
}

// Izmena ide samo onima kojima se promenilo nešto njihovo (v. ciljanje.mjs).
function zaIzmene(fajl) {
  const izmene = JSON.parse(readFileSync(fajl, 'utf-8'))
  return (payload, sub) => {
    const body = porukaOIzmeni(izmene, sub)
    return body ? { ...payload, body } : null
  }
}

// --- slanje -----------------------------------------------------------------

async function getSubscriptions() {
  const all = await redis.hgetall(SUBS_KEY) // { endpoint: subJSON, ... }
  if (!all) return []
  return Object.entries(all).map(([endpoint, val]) => ({
    endpoint,
    sub: typeof val === 'string' ? JSON.parse(val) : val,
  }))
}

// `za` bira poruku za pretplatu (null = preskoči); podrazumevano svima ista.
async function sendAll(payloads, za = (payload) => payload) {
  if (payloads.length === 0) {
    console.log('Nema notifikacija za slanje.')
    return
  }
  const subs = await getSubscriptions()
  console.log(`Pretplatnika: ${subs.length}, poruka: ${payloads.length}`)
  if (subs.length === 0) return

  const dead = []
  let sent = 0
  let preskoceno = 0
  for (const payload of payloads) {
    for (const { endpoint, sub } of subs) {
      const poruka = za(payload, sub)
      if (!poruka) {
        preskoceno++
        continue
      }
      try {
        await webpush.sendNotification(sub, JSON.stringify(poruka))
        sent++
      } catch (err) {
        const code = err?.statusCode
        if (code === 404 || code === 410) dead.push(endpoint)
        else console.error(`Greška (${code}) za ${endpoint.slice(0, 40)}...`)
      }
    }
  }

  if (dead.length > 0) {
    await redis.hdel(SUBS_KEY, ...dead)
    console.log(`Uklonjeno ${dead.length} mrtvih pretplata.`)
  }
  console.log(`Poslato ${sent} notifikacija${preskoceno ? `, preskočeno ${preskoceno} (nije im se ništa promenilo)` : ''}.`)
}

// Dedup: workflow se pokreće više puta dnevno (zbog nepouzdanog GitHub cron-a),
// pa podsetnik za isti rok/fazu šaljemo samo jednom dnevno.
async function dedupeReminders(payloads) {
  const today = todayBelgrade()
  const out = []
  for (const p of payloads) {
    const key = `sent:${today}:${p.tag}`
    const fresh = await redis.set(key, '1', { nx: true, ex: 172800 }) // 2 dana
    if (fresh) out.push(p)
    else console.log(`Preskočeno (već poslato danas): ${p.tag}`)
  }
  return out
}

// Obaveštenje o novom rasporedu šaljemo samo jednom po semestru - FON ume da
// re-objavi isti raspored sa ispravkama, a ni ponovljen workflow ne sme da
// pošalje duplikat.
async function dedupeNastava(payloads) {
  const out = []
  for (const p of payloads) {
    const fresh = await redis.set(`sent:${p.tag}`, '1', { nx: true, ex: 60 * 60 * 24 * 200 })
    if (fresh) out.push(p)
    else console.log(`Preskočeno (već poslato): ${p.tag}`)
  }
  return out
}

// --- main -------------------------------------------------------------------

const mode = process.argv[2]
let payloads = []
let za
if (mode === 'new') payloads = newRokPayloads()
else if (mode === 'reminders') payloads = await dedupeReminders(reminderPayloads())
else if (mode === 'nastava') payloads = await dedupeNastava(nastavaPayloads(process.argv[3]))
else if (mode === 'nastava-izmena') {
  payloads = await dedupeNastava(nastavaIzmenaPayloads(process.argv[3], process.argv[4]))
  za = zaIzmene(process.argv[5])
} else {
  console.error('Upotreba: node scripts/send_push.mjs <new|reminders|nastava "<semestar>"|nastava-izmena "<semestar>" "<verzija>" <izmene.json>>')
  process.exit(1)
}

await sendAll(payloads, za)
