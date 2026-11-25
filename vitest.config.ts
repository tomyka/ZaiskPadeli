import { defineConfig } from 'vitest/config'

// Unit tests cover pure logic: server parsers, time maths and validation
// (tests/server) and the page's session, availability and prefs logic (tests/app).
// They live outside server/ and app/ so Nitro's and Nuxt's auto-import scans never pick them up.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
