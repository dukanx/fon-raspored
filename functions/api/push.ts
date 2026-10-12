// Pretplata na Web Push notifikacije (ranije Server Action u app/actions.ts).
// Pretplate su u Redis hash-u: field = endpoint, value = JSON(subscription).
// Endpoint je jedinstven po uređaju/browseru pa služi kao prirodni ključ.
// Uz pretplatu se pamte godina i grupa (ako ih ima), za ciljane notifikacije
// u scripts/send_push.mjs.
import { Redis } from '@upstash/redis'
import { json, type Ctx } from '../../lib/funkcije'

const SUBS_KEY = 'push:subs'

// Bez tajni (ili kad Redis ne odgovori) vraća urednu grešku umesto pada
// funkcije (Cloudflare tada vraća "error code: 1101" bez JSON-a).
async function uRedisu(env: Ctx['env'], posao: (r: Redis) => Promise<unknown>) {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    console.error('Upstash tajne nisu podešene')
    return json({ success: false, error: 'Notifikacije trenutno nisu dostupne.' }, 500)
  }
  try {
    await posao(new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN }))
    return json({ success: true })
  } catch (e) {
    console.error('Upstash greška', e)
    return json({ success: false, error: 'Notifikacije trenutno nisu dostupne.' }, 500)
  }
}

type Pretplata = { endpoint?: string; keys?: unknown; godina?: unknown; grupa?: unknown }

// Kratka oznaka ("3", "C13") ili ništa; sve drugo se ne upisuje.
const oznaka = (v: unknown) => (typeof v === 'string' && /^[\w-]{1,8}$/.test(v) ? v : undefined)

export async function onRequestPost({ request, env }: Ctx) {
  const body = (await request.json().catch(() => null)) as Pretplata | null
  if (!body?.endpoint || !body.keys) return json({ success: false, error: 'Nevažeća pretplata' }, 400)
  const sub = { endpoint: body.endpoint, keys: body.keys, godina: oznaka(body.godina), grupa: oznaka(body.grupa) }
  return uRedisu(env, r => r.hset(SUBS_KEY, { [sub.endpoint]: JSON.stringify(sub) }))
}

export async function onRequestDelete({ request, env }: Ctx) {
  const { endpoint } = ((await request.json().catch(() => null)) ?? {}) as { endpoint?: string }
  if (!endpoint) return json({ success: false, error: 'Nedostaje endpoint' }, 400)
  return uRedisu(env, r => r.hdel(SUBS_KEY, endpoint))
}
