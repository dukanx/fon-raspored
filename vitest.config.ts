import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Unit testovi za čistu logiku u lib/ i scripts/ (bez DOM-a), kolocirani kao
// *.test.ts pored fajla. `@/` alias prati tsconfig paths.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
