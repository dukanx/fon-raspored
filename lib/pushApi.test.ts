// Pretplata u functions/api/push.ts. Test je ovde, a ne pored nje: Cloudflare
// Pages bi svaki fajl u functions/ objavio kao rutu.
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Lažni Redis: pamti šta bi funkcija upisala.
const upisano: Record<string, string>[] = []
vi.mock('@upstash/redis', () => ({
  Redis: class {
    async hset(_kljuc: string, polja: Record<string, string>) { upisano.push(polja) }
    async hdel() {}
  },
}))

const { onRequestPost } = await import('../functions/api/push')

const env = { UPSTASH_REDIS_REST_URL: 'https://x', UPSTASH_REDIS_REST_TOKEN: 't' }
async function pretplati(telo: object) {
  const request = new Request('https://x/api/push', { method: 'POST', body: JSON.stringify(telo) })
  const res = await onRequestPost({ request, env })
  return { status: res.status, sub: upisano.length ? JSON.parse(Object.values(upisano.at(-1)!)[0]) : null }
}
const osnova = { endpoint: 'https://push/1', keys: { p256dh: 'a', auth: 'b' }, godina: '3', grupa: 'C13' }

describe('POST /api/push', () => {
  beforeEach(() => { upisano.length = 0 })

  it('pamti predmete i dodate termine', async () => {
    const dodat = { godina: 1, grupe: ['A17'], predmet: 'Menadžment', tip: 'V' }
    const { sub } = await pretplati({ ...osnova, predmeti: ['Matematika 1'], dodati: [dodat] })
    expect(sub).toMatchObject({ godina: '3', grupa: 'C13', predmeti: ['Matematika 1'], dodati: [dodat] })
  })

  it('bez predmeta (stara aplikacija) ostaje samo grupa', async () => {
    const { sub } = await pretplati(osnova)
    expect(sub.predmeti).toBeUndefined()
    expect(sub.dodati).toBeUndefined()
  })

  it('neispravan dodat termin se preskače, ostali ostaju', async () => {
    const dobar = { godina: 2, grupe: ['B1'], predmet: 'Statistika', tip: 'P' }
    const { sub } = await pretplati({ ...osnova, dodati: [{ godina: 9, grupe: ['B1'], predmet: 'X', tip: 'P' }, { ...dobar, tip: 'Q' }, dobar] })
    expect(sub.dodati).toEqual([dobar])
  })

  it('predugačak spisak predmeta se ne upisuje', async () => {
    const { sub } = await pretplati({ ...osnova, predmeti: Array.from({ length: 100 }, (_, i) => `P${i}`) })
    expect(sub.predmeti).toBeUndefined()
  })

  it('bez endpoint-a odbija', async () => {
    expect((await pretplati({ keys: {} })).status).toBe(400)
  })
})
