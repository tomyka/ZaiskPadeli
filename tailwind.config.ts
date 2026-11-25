import type { Config } from 'tailwindcss'

/**
 * Brand palette ("midnight ink + orange"). Use these tokens rather than raw
 * Tailwind colours so the look can be changed in one place.
 * - ink: header, selected states, free time slots
 * - ball: the accent (text on ink, primary buttons); `ball-text` is the
 *   darker shade for orange text on light backgrounds (passes contrast)
 * - court: page background and lines
 */
export default <Partial<Config>>{
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#111827', soft: '#1f2937', muted: '#d1d5db' },
        ball: { DEFAULT: '#fb923c', deep: '#ea580c', text: '#c2410c', tint: '#fff7ed' },
        court: { bg: '#f3f4f6', line: '#d1d5db', faint: '#e9eaee' },
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'system-ui', 'sans-serif'],
      },
    },
  },
}
