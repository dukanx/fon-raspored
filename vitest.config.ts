import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Unit testovi za čistu logiku u lib/ (bez DOM-a). Testovi su kolocirani kao
// lib/*.test.ts. `@/` alias prati tsconfig paths.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
})
