// Usage: node scripts/logo-icons.mjs <out-dir> public
//   writes public/favicon.svg and <out-dir>/icon-{512,192,32}.html; render each HTML page to a PNG
//   of the same size with .claude/tools/browse.mjs (viewport = icon size, one "screenshot" step),
//   copy icon-512/192.png into public/, and wrap icon-32.png in public/favicon.ico.
// Builds the logo icons from Barlow Condensed Bold's own Z (outline traced at 1000 px:
// 368 x 700, bars 121, diagonal 149 wide) plus the háček, in the header's proportions.
import { writeFileSync } from 'node:fs'
const [out, publicDir] = process.argv.slice(2)
const Z = [[0,0],[368,0],[368,121],[150,579],[368,579],[368,700],[0,700],[0,579],[218,121],[0,121]]
function mark(zHeight, { bold = false, ring = '#111827' } = {}) {
  const s = zHeight / 700, zw = 368 * s
  const cw = zw * 1.027, ch = cw / 1.345, gap = zHeight * 0.0413
  const total = ch + gap + zHeight, top = (200 - total) / 2
  const zTop = top + ch + gap, zLeft = 100 - zw / 2
  const poly = Z.map(([x, y]) => `${(zLeft + x * s).toFixed(2)},${(zTop + y * s).toFixed(2)}`).join(' ')
  const hacek = bold
    ? `<path d="M66 17 L101 46 L136 17" fill="none" stroke="#fb923c" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/><circle cx="101" cy="48" r="20" fill="#fb923c" stroke="${ring}" stroke-width="5"/>`
    : `<path d="M68 19 L101 46 L134 19" fill="none" stroke="#fb923c" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><circle cx="101" cy="48" r="18" fill="#fb923c" stroke="${ring}" stroke-width="4.5"/><path d="M91 40 Q100 48 91 56 M111 40 Q102 48 111 56" fill="none" stroke="#ea580c" stroke-width="2.4" stroke-linecap="round"/>`
  return `<polygon points="${poly}" fill="#ffffff"/><svg x="${(100 - cw / 2).toFixed(2)}" y="${top.toFixed(2)}" width="${cw.toFixed(2)}" height="${ch.toFixed(2)}" viewBox="62 13 78 58" overflow="visible">${hacek}</svg>`
}
const tile = '<rect width="200" height="200" rx="44" fill="#111827"/>'
const bleed = '<rect width="200" height="200" fill="#111827"/>'
writeFileSync(`${publicDir}/favicon.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <!-- Žaisk Padelį mark ("Paukščiukas"): Barlow Condensed Bold's Z with a háček that is a bounce, the ball at the bounce point -->
  ${tile}
  ${mark(118, { bold: true })}
</svg>
`)
const page = (size, body) => `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}">${body}</svg></body></html>`
// App icons: the whole mark within the maskable safe zone (a centred circle of 40% radius)
writeFileSync(`${out}/icon-512.html`, page(512, bleed + mark(96)))
writeFileSync(`${out}/icon-192.html`, page(192, bleed + mark(96)))
writeFileSync(`${out}/icon-32.html`, page(32, tile + mark(118, { bold: true })))
console.log('written')
