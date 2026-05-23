'use server'

import { Redis } from '@upstash/redis'

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
