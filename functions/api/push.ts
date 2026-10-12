// Pretplata na Web Push notifikacije (ranije Server Action u app/actions.ts).
// Pretplate su u Redis hash-u: field = endpoint, value = JSON(subscription).
// Endpoint je jedinstven po uređaju/browseru pa služi kao prirodni ključ.
import { Redis } from '@upstash/redis'
import { json, type Ctx } from '../../lib/funkcije'

const SUBS_KEY = 'push:subs'

const redis = (env: Ctx['env']) =>
  new Redis({ url: env.UPSTASH_REDIS_REST_URL ?? '', token: env.UPSTASH_REDIS_REST_TOKEN ?? '' })

export async function onRequestPost({ request, env }: Ctx) {
  const sub = (await request.json().catch(() => null)) as { endpoint?: string } | null
  if (!sub?.endpoint) return json({ success: false, error: 'Nevažeća pretplata' }, 400)
  await redis(env).hset(SUBS_KEY, { [sub.endpoint]: JSON.stringify(sub) })
  return json({ success: true })
}

export async function onRequestDelete({ request, env }: Ctx) {
  const { endpoint } = ((await request.json().catch(() => null)) ?? {}) as { endpoint?: string }
  if (!endpoint) return json({ success: false, error: 'Nedostaje endpoint' }, 400)
  await redis(env).hdel(SUBS_KEY, endpoint)
  return json({ success: true })
}
