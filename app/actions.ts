'use server'

import { Redis } from '@upstash/redis'
import { Resend } from 'resend'

// Pretplate čuvamo u Redis hash-u: field = endpoint, value = JSON(subscription).
// Endpoint je jedinstven po uređaju/browseru pa služi kao prirodni ključ za dedup.
const SUBS_KEY = 'push:subs'

// Lazy init — ne diramo env pri importu modula (da lokalni build bez Upstash-a ne pukne).
let _redis: Redis | null = null
function getRedis() {
  if (!_redis) _redis = Redis.fromEnv()
  return _redis
}

type WebPushSubscription = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export async function subscribeUser(sub: WebPushSubscription) {
  if (!sub?.endpoint) return { success: false, error: 'Nevažeća pretplata' }
  await getRedis().hset(SUBS_KEY, { [sub.endpoint]: JSON.stringify(sub) })
  return { success: true }
}

export async function unsubscribeUser(endpoint: string) {
  if (!endpoint) return { success: false, error: 'Nedostaje endpoint' }
  await getRedis().hdel(SUBS_KEY, endpoint)
  return { success: true }
}

// Lazy init — isti razlog kao getRedis (ne diramo env pri importu modula).
let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

type FeedbackInput = {
  message: string
  contact?: string
  page?: string
  // Honeypot — botovi popune skrivena polja, pravi korisnici ne. Prazno = OK.
  website?: string
}

export async function submitFeedback(input: FeedbackInput) {
  const message = input.message?.trim() ?? ''
  if (input.website) return { success: true } // honeypot — tiho "uspej" da bot ne pokušava dalje
  if (!message) return { success: false, error: 'Poruka je prazna.' }
  if (message.length > 4000) return { success: false, error: 'Poruka je predugačka.' }

  const to = process.env.FEEDBACK_EMAIL
  if (!to) return { success: false, error: 'Feedback email nije podešen (FEEDBACK_EMAIL).' }

  try {
    const contact = input.contact?.trim()
    // Podrazumevani Resend sandbox pošiljalac radi bez verifikacije domena.
    // Kad se domen verifikuje u Resend-u, postavi RESEND_FROM_EMAIL na npr.
    // "FON Raspored <feedback@tvojdomen.com>".
    const from = process.env.RESEND_FROM_EMAIL || 'FON Raspored <onboarding@resend.dev>'
    const res = await getResend().emails.send({
      from,
      to,
      replyTo: contact || undefined,
      subject: 'Feedback — FON Raspored',
      text: [
        message,
        '',
        '---',
        input.page ? `Stranica: ${input.page}` : null,
        contact ? `Kontakt: ${contact}` : 'Kontakt: (nije ostavljen)',
      ].filter(Boolean).join('\n'),
    })
    if (res.error) throw new Error(res.error.message)
    return { success: true }
  } catch (e) {
    console.error(e)
    return { success: false, error: 'Slanje nije uspelo, probaj kasnije.' }
  }
}
