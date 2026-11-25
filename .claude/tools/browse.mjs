#!/usr/bin/env node
/**
 * Minimal "human hands" for black-box UI testing: drives headless Edge/Chrome
 * over the DevTools Protocol with real mouse and keyboard events.
 *
 * Usage:  node .claude/tools/browse.mjs <script.json> [--port 9333]
 *
 * script.json:
 * {
 *   "viewport": { "width": 390, "height": 844, "mobile": true },
 *   "steps": [
 *     { "goto": "http://localhost:3123/" },
 *     { "wait": 1500 },                                   // ms
 *     { "click": { "text": "90 min" } },                  // visible element whose text/aria-label matches
 *     { "click": { "selector": "article button", "nth": 2 } },
 *     { "key": "Escape" },                                // Tab, Shift+Tab, Enter, Space, ArrowDown, Escape...
 *     { "type": "hello" },                                // into the focused element
 *     { "select": { "label": "Miestas", "option": "Vilnius" } }, // native <select> by aria/label text or selector
 *     { "scroll": 600 },                                  // px down (negative = up)
 *     { "resize": { "width": 1440, "height": 900, "mobile": false } },
 *     { "screenshot": "out/step.png" },                   // viewport only
 *     { "text": 1500 },                                   // visible page text, first N chars
 *     { "focus": true },                                  // what has keyboard focus (role, name)
 *     { "controls": true },                               // interactive elements on screen with names
 *     { "eval": "document.title" }                        // escape hatch; prefer the human steps above
 *   ]
 * }
 *
 * Prints one JSON line per step ({ i, step, ok, result | error }) and finally
 * the console errors / uncaught exceptions the page produced.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const args = process.argv.slice(2)
const scriptPath = args.find(a => !a.startsWith('--'))
const port = Number(args[args.indexOf('--port') + 1] || 9333)
if (!scriptPath) { console.error('usage: browse.mjs <script.json> [--port N]'); process.exit(2) }
const script = JSON.parse(readFileSync(scriptPath, 'utf8'))

const CANDIDATES = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)
const browserPath = CANDIDATES.find(p => existsSync(p))
if (!browserPath) { console.error('No Edge/Chrome found; set BROWSER_PATH'); process.exit(2) }

const sleep = ms => new Promise(r => setTimeout(r, ms))
const profile = mkdtempSync(join(tmpdir(), 'browse-'))
const proc = spawn(browserPath, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'])

let target
for (let i = 0; i < 75 && !target; i++) {
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page') } catch {}
  if (!target) await sleep(200)
}
if (!target) { console.error('browser did not start'); proc.kill(); process.exit(1) }

const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise(r => ws.addEventListener('open', r))
let seq = 0
const pending = new Map()
const problems = []
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id) { pending.get(m.id)?.(m); pending.delete(m.id); return }
  if (m.method === 'Runtime.exceptionThrown') problems.push({ type: 'exception', text: m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text })
  if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning'))
    problems.push({ type: `console.${m.params.type}`, text: m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 300) })
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') problems.push({ type: 'log', text: `${m.params.entry.text} ${m.params.entry.url ?? ''}`.slice(0, 300) })
})
const send = (method, params = {}) => new Promise((r) => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval failed')
  return r.result?.result?.value
}

async function setViewport({ width = 1280, height = 800, mobile = width < 600 } = {}) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile })
  await send('Emulation.setTouchEmulationEnabled', { enabled: !!mobile })
}

/** Locate a visible element like a person would: by its text / accessible name, or a CSS selector. */
const FIND = (q) => `(() => {
  const q = ${JSON.stringify(q)};
  const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'; };
  const name = el => (el.getAttribute('aria-label') || el.innerText || el.value || '').replace(/\\s+/g, ' ').trim();
  let list;
  if (q.selector) list = [...document.querySelectorAll(q.selector)].filter(visible);
  else {
    const all = [...document.querySelectorAll('button, a, [role=button], [role=tab], label, input, select, summary, [tabindex]')].filter(visible);
    const t = q.text.toLowerCase();
    list = all.filter(el => name(el).toLowerCase() === t);
    if (!list.length) list = all.filter(el => name(el).toLowerCase().includes(t));
  }
  const el = list[q.nth || 0];
  if (!el) return null;
  el.scrollIntoView({ block: 'center', inline: 'center' });
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, name: name(el).slice(0, 80), tag: el.tagName.toLowerCase(), matches: list.length };
})()`

async function click(q) {
  const hit = await evaluate(FIND(q))
  if (!hit) throw new Error(`nothing visible matches ${JSON.stringify(q)}`)
  await sleep(150)
  const base = { x: hit.x, y: hit.y, button: 'left', clickCount: 1 }
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...base })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base })
  return hit
}

const KEYS = {
  Escape: { key: 'Escape', code: 'Escape', keyCode: 27 }, Enter: { key: 'Enter', code: 'Enter', keyCode: 13, text: '\r' },
  Tab: { key: 'Tab', code: 'Tab', keyCode: 9 }, Space: { key: ' ', code: 'Space', keyCode: 32, text: ' ' },
  ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 }, ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
  ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 }, ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
}
async function key(spec) {
  const shift = spec.startsWith('Shift+')
  const k = KEYS[shift ? spec.slice(6) : spec]
  if (!k) throw new Error(`unknown key ${spec}`)
  const common = { key: k.key, code: k.code, windowsVirtualKeyCode: k.keyCode, modifiers: shift ? 8 : 0 }
  await send('Input.dispatchKeyEvent', { type: k.text ? 'keyDown' : 'rawKeyDown', ...common, text: k.text })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...common })
}

const FOCUS = `(() => { const el = document.activeElement; if (!el || el === document.body) return 'body (nothing focused)';
  return { tag: el.tagName.toLowerCase(), role: el.getAttribute('role'), name: (el.getAttribute('aria-label') || el.innerText || el.value || '').replace(/\\s+/g,' ').trim().slice(0, 80) }; })()`
const CONTROLS = `(() => [...document.querySelectorAll('button, a, input, select, [role=button], [role=tab]')]
  .filter(el => { const r = el.getBoundingClientRect(); return r.width && r.height && r.bottom > 0 && r.top < innerHeight; })
  .map(el => { const r = el.getBoundingClientRect(); return { tag: el.tagName.toLowerCase(),
    name: (el.getAttribute('aria-label') || el.innerText || el.value || '').replace(/\\s+/g,' ').trim().slice(0, 50),
    size: Math.round(r.width) + 'x' + Math.round(r.height), pressed: el.getAttribute('aria-pressed') || el.getAttribute('aria-current') || undefined }; }))()`

await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable')
await setViewport(script.viewport)

let i = 0
for (const step of script.steps) {
  i++
  const out = { i, step: Object.keys(step)[0] }
  try {
    if (step.goto) { await send('Page.navigate', { url: step.goto }); await sleep(step.settle ?? 4000) }
    else if (step.wait) await sleep(step.wait)
    else if (step.click) { out.result = await click(step.click); await sleep(step.click.settle ?? 600) }
    else if (step.key) { await key(step.key); await sleep(250) }
    else if (step.type) { for (const ch of step.type) await send('Input.dispatchKeyEvent', { type: 'char', text: ch }) }
    else if (step.select) {
      const s = step.select
      out.result = await evaluate(`(() => { const sel = ${JSON.stringify(s.selector || null)} ? document.querySelector(${JSON.stringify(s.selector || '')})
        : [...document.querySelectorAll('select')].find(x => (x.closest('label')?.innerText || x.getAttribute('aria-label') || '').includes(${JSON.stringify(s.label || '')}) && x.getBoundingClientRect().width);
        if (!sel) return 'no select found';
        const opt = [...sel.options].find(o => o.text.trim() === ${JSON.stringify(s.option)} || o.text.includes(${JSON.stringify(s.option)}));
        if (!opt) return 'no option ' + ${JSON.stringify(s.option)} + '; options: ' + [...sel.options].map(o => o.text.trim()).slice(0, 15).join(' | ');
        sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); return 'selected ' + opt.text.trim(); })()`)
      await sleep(800)
    }
    else if (step.scroll) { await evaluate(`window.scrollBy(0, ${Number(step.scroll)})`); await sleep(400) }
    else if (step.resize) { await setViewport(step.resize); await sleep(800) }
    else if (step.screenshot) {
      const file = resolve(step.screenshot)
      mkdirSync(dirname(file), { recursive: true })
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(file, Buffer.from(shot.result.data, 'base64'))
      out.result = file
    }
    else if (step.text) out.result = (await evaluate('document.body.innerText')).replace(/\n{3,}/g, '\n\n').slice(0, step.text)
    else if (step.focus) out.result = await evaluate(FOCUS)
    else if (step.controls) out.result = await evaluate(CONTROLS)
    else if (step.eval) out.result = await evaluate(step.eval)
    else throw new Error('unknown step')
    out.ok = true
  } catch (e) { out.ok = false; out.error = String(e.message || e) }
  console.log(JSON.stringify(out))
}
console.log(JSON.stringify({ problems }))
ws.close(); proc.kill(); process.exit(0)
