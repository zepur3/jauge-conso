import { expect, test } from 'claude-code/testing'

const BAND = { plugin: 'jauge-conso', component: 'AbovePrompt', props: { hasSurvey: false } } as const
const NOW = Date.parse('2026-11-13T10:00:00Z')

async function monte($: any, on: any, cinqH: number) {
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: { startedAt: 0, context: {}, rateLimits: [] } }))
  on('clock.now', () => ({ value: NOW }))
  on('clock.every', () => ({ value: {} }))
  on('session.measure', (_: any, e: any) => ({ changed: e.changed }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure({
    context: {} as never,
    rateLimits: [
      // fenêtre 5 h : finit à 11:40Z → 3 h 20 écoulées
      { kind: 'five_hour', percentUsed: cinqH, resetsAt: '2026-11-13T11:40:00Z' },
      { kind: 'seven_day', percentUsed: 4, resetsAt: '2026-11-20T00:00:00Z' },
    ],
    cost: { usd: 2.95 },
    changed: ['rateLimits'],
  })
  return $.ui.mount({ ...BAND, surface: 'desktop' } as never)
}

test('rythme tranquille', async ($, on) => {
  const ui = await monte($, on, 27)
  const t = (await ui.find({ type: 'Text', text: /27 %/ }))?.text
  console.log(t)
  expect(t).toContain('✓ tu tiendras')
  expect(t).toContain('remise dans 1 h 40')
  await ui.unmount()
})

test('rythme trop rapide', async ($, on) => {
  const ui = await monte($, on, 80)
  const t = (await ui.find({ type: 'Text', text: /80 %/ }))?.text
  console.log(t)
  expect(t).toContain('⚠ à ce rythme, limite vers')
  await ui.unmount()
})

test('alerte une seule fois quand le rythme est trop rapide', async ($, on) => {
  const toasts: string[] = []
  on('ui.toast', (_: any, e: any) => { toasts.push(e.text ?? JSON.stringify(e)); return { value: undefined } })
  const ui = await monte($, on, 80)
  await $.session.measure({
    context: {} as never,
    rateLimits: [{ kind: 'five_hour', percentUsed: 81, resetsAt: '2026-11-13T11:40:00Z' }],
    changed: ['rateLimits'],
  })
  console.log(toasts)
  expect(toasts.length).toBe(1)
  await ui.unmount()
})
