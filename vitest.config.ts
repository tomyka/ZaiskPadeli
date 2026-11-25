import { defineConfig } from 'vitest/config'

// Unit tests cover pure server logic (parsers, time maths, validation).
// They live outside server/ so Nitro's auto-import scan never picks them up.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
