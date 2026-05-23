// Šalje Web Push notifikacije svim pretplatnicima.
// Pokreće se iz GitHub Actions-a (Node). Pretplate čita iz Upstash Redisa,
// šalje preko VAPID-a, i čisti mrtve pretplate (HTTP 404/410).
//
//   node scripts/send_push.mjs new         -> "dodat je novi raspored ..." (čita pending_notify.json)
//   node scripts/send_push.mjs reminders   -> podsetnici dan pred početak/kraj prijave (čita rokovi.json)
//
// Env: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:),
//      UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import webpush from 'web-push'
import { Redis } from '@upstash/redis'

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

function tomorrowBelgrade() {
  const [y, m, d] = todayBelgrade().split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + 1)
  return dt.toISOString().slice(0, 10)
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
      body: r.rok ? `Dodat je: ${r.rok}` : `Dodat je novi raspored ${kind}.`,
      url: '/rokovi',
      tag: `rok-${r.rok || kind}`,
    }
  })
}

function reminderPayloads() {
  if (!existsSync(ROKOVI_FILE)) return []
  const roks = JSON.parse(readFileSync(ROKOVI_FILE, 'utf-8'))
  const tomorrow = tomorrowBelgrade()
  const payloads = []

  for (const r of roks) {
    const dates = (r.prijava_datumi || []).map(srToIso).filter(Boolean).sort()
    if (dates.length === 0) continue

    const start = dates[0]
    const end = dates[dates.length - 1]
    const kind = r.tip === 'ispit' ? 'ispit' : 'kolokvijum'

    if (start === tomorrow) {
      payloads.push({
        title: 'Sutra počinje prijava',
        body: `Prijava za ${r.rok} počinje sutra. Tapni za eStudent.`,
        url: ESTUDENT_URL,
        tag: `prijava-start-${r.rok}`,
      })
    }
    // Ako je prijava jednodnevna, ne dupliraj (start === end).
    if (end === tomorrow && end !== start) {
      payloads.push({
        title: 'Sutra je poslednji dan prijave',
        body: `Sutra je poslednji dan za prijavu: ${r.rok}. Tapni za eStudent.`,
        url: ESTUDENT_URL,
        tag: `prijava-end-${r.rok}`,
      })
    } else if (end === tomorrow && end === start) {
      // jednodnevna prijava — "sutra je prijava"
      payloads[payloads.length - 1].title = 'Sutra je prijava'
      payloads[payloads.length - 1].body = `Sutra je prijava za ${r.rok} (samo taj dan). Tapni za eStudent.`
      void kind
    }
  }
  return payloads
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

async function sendAll(payloads) {
  if (payloads.length === 0) {
    console.log('Nema notifikacija za slanje.')
    return
  }
  const subs = await getSubscriptions()
  console.log(`Pretplatnika: ${subs.length}, poruka: ${payloads.length}`)
  if (subs.length === 0) return

  const dead = []
  let sent = 0
  for (const payload of payloads) {
    const data = JSON.stringify(payload)
    for (const { endpoint, sub } of subs) {
      try {
        await webpush.sendNotification(sub, data)
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
  console.log(`Poslato ${sent} notifikacija.`)
}

// --- main -------------------------------------------------------------------

const mode = process.argv[2]
let payloads = []
if (mode === 'new') payloads = newRokPayloads()
else if (mode === 'reminders') payloads = reminderPayloads()
else {
  console.error("Upotreba: node scripts/send_push.mjs <new|reminders>")
  process.exit(1)
}

await sendAll(payloads)
