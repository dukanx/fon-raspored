// lib/funkcije.ts
//
// Zajedničko za Cloudflare Pages Functions (functions/api/*): serverski deo
// sajta posle prelaska sa Vercel-a na statički izvoz. Tipovi su namerno ručni
// (bez @cloudflare/workers-types), samo ono što funkcije koriste.

export interface Env {
  GROQ_API_KEY?: string
  UPSTASH_REDIS_REST_URL?: string
  UPSTASH_REDIS_REST_TOKEN?: string
  RESEND_API_KEY?: string
  FEEDBACK_EMAIL?: string
  RESEND_FROM_EMAIL?: string
}

export interface Ctx {
  request: Request
  env: Env
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
