// Samo za testove: localStorage i sessionStorage u memoriji (node nema DOM).
// Guard u storage.ts gleda `window`, pa se postavlja globalni `window`.
class MemStorage {
  private m = new Map<string, string>()
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null }
  setItem(k: string, v: string) { this.m.set(k, String(v)) }
  removeItem(k: string) { this.m.delete(k) }
  clear() { this.m.clear() }
  key(i: number) { return [...this.m.keys()][i] ?? null }
  get length() { return this.m.size }
}

// Postavi/ukloni globalni `window` bez sudaranja sa DOM `Window` tipom.
export function postaviMemStorage() {
  ;(globalThis as Record<string, unknown>).window = {
    localStorage: new MemStorage() as unknown as Storage,
    sessionStorage: new MemStorage() as unknown as Storage,
  }
}

export function ukloniStorage() {
  ;(globalThis as Record<string, unknown>).window = undefined
}
