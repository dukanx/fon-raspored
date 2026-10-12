// Feedback forma (ranije Server Action u app/actions.ts): poruka ide mejlom
// preko Resend REST API-ja.
import { json, type Ctx } from '../../lib/funkcije'

type FeedbackInput = {
  message?: string
  contact?: string
  page?: string
  // Honeypot - botovi popune skrivena polja, pravi korisnici ne. Prazno = OK.
  website?: string
}

export async function onRequestPost({ request, env }: Ctx) {
  const input = ((await request.json().catch(() => null)) ?? {}) as FeedbackInput
  const message = input.message?.trim() ?? ''
  if (input.website) return json({ success: true }) // honeypot - tiho "uspej" da bot ne pokušava dalje
  if (!message) return json({ success: false, error: 'Poruka je prazna.' })
  if (message.length > 4000) return json({ success: false, error: 'Poruka je predugačka.' })
  if (!env.FEEDBACK_EMAIL) return json({ success: false, error: 'Feedback email nije podešen (FEEDBACK_EMAIL).' })

  const contact = input.contact?.trim()
  // Podrazumevani Resend sandbox pošiljalac radi bez verifikacije domena.
  const from = env.RESEND_FROM_EMAIL || 'FON Raspored <onboarding@resend.dev>'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from,
      to: env.FEEDBACK_EMAIL,
      reply_to: contact || undefined,
      subject: 'Feedback - FON Raspored',
      text: [
        message,
        '',
        '---',
        input.page ? `Stranica: ${input.page}` : null,
        contact ? `Kontakt: ${contact}` : 'Kontakt: (nije ostavljen)',
      ].filter(Boolean).join('\n'),
    }),
  })
  if (!res.ok) {
    console.error('Resend greška', res.status, await res.text())
    return json({ success: false, error: 'Slanje nije uspelo, probaj kasnije.' })
  }
  return json({ success: true })
}
