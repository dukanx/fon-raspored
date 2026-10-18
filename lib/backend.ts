// lib/backend.ts
//
// Pozivi serverskog dela (Cloudflare Pages Functions u functions/api/*).
// Ranije su ovo bile Server Actions u app/actions.ts; statički izvoz ih ne
// podržava, pa su sad obični zahtevi. Iste funkcije i isti odgovori, pa se
// pozivi u aplikaciji ne menjaju.

type Rezultat = { success: boolean; error?: string }

async function posalji(url: string, method: 'POST' | 'DELETE', body: unknown): Promise<Rezultat> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return (await res.json()) as Rezultat
  } catch {
    return { success: false, error: 'Nema veze sa serverom, probaj ponovo.' }
  }
}

export type WebPushSubscription = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

// Uz pretplatu idu grupa, čekirani predmeti i dodati termini, da notifikacija o
// izmeni rasporeda stigne samo onima kojima se promenilo nešto njihovo.
// `predmeti` nema dok student ništa ne čekira (tada prati celu grupu).
export type PushPodaci = {
  godina: string
  grupa: string
  predmeti?: string[]
  dodati: { godina: number; grupe: string[]; predmet: string; tip: 'P' | 'V' }[]
}

export const subscribeUser = (sub: WebPushSubscription, podaci: PushPodaci | null) =>
  posalji('/api/push', 'POST', { ...sub, ...podaci })

export const unsubscribeUser = (endpoint: string) => posalji('/api/push', 'DELETE', { endpoint })

export const submitFeedback = (input: { message: string; contact?: string; page?: string; website?: string }) =>
  posalji('/api/feedback', 'POST', input)
