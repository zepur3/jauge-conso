import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Conso, Fenetre } from '../types'

const conso = atom({ plugin: 'jauge-conso', key: 'conso' } as const, null)
const maintenant = atom({ plugin: 'jauge-conso', key: 'maintenant' } as const, 0)
const alertes = atom({ plugin: 'jauge-conso', key: 'alertes' } as const, [] as string[])

const NOMS: Record<string, string> = {
  five_hour: '5 h',
  seven_day: 'Semaine',
  spend_limit: 'Budget',
}
const DUREES: Record<string, number> = {
  five_hour: 5 * 3600_000,
  seven_day: 7 * 24 * 3600_000,
}
const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
const CASES = 20

const deux = (n: number) => String(n).padStart(2, '0')

function heure(ms: number, avecJour: boolean): string {
  const d = new Date(ms)
  const h = `${deux(d.getHours())}:${deux(d.getMinutes())}`
  return avecJour ? `${JOURS[d.getDay()]} ${h}` : h
}

// « 2 h 10 », « 45 min », « 6 j 16 h »
function duree(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h ${deux(min % 60)}`
  return `${Math.floor(h / 24)} j ${h % 24} h`
}

function couleur(pct: number): 'success' | 'warning' | 'error' {
  if (pct >= 80) return 'error'
  if (pct >= 50) return 'warning'
  return 'success'
}

type Rythme = { ok: boolean; texte: string }

// Projette la conso au rythme moyen depuis le début de la fenêtre.
function rythme(f: Fenetre, fin: number, now: number): Rythme | null {
  const longueur = DUREES[f.kind]
  if (!longueur) return null
  if (f.percentUsed >= 100) return { ok: false, texte: 'limite atteinte' }
  const ecoule = longueur - (fin - now)
  // Trop tôt dans la fenêtre pour estimer un rythme fiable.
  if (ecoule < longueur * 0.05 || f.percentUsed < 1) return { ok: true, texte: 'tu tiendras' }
  const parMs = f.percentUsed / ecoule
  const atteinte = now + (100 - f.percentUsed) / parMs
  if (atteinte >= fin) return { ok: true, texte: 'tu tiendras' }
  return { ok: false, texte: `à ce rythme, limite vers ${heure(atteinte, f.kind !== 'five_hour')}` }
}

function versConso(fenetres: Fenetre[], usd: number | undefined): Conso {
  return {
    fenetres: fenetres.map(f => ({ kind: f.kind, percentUsed: f.percentUsed, resetsAt: f.resetsAt })),
    usd,
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    const u = await $.session.usage()
    await update($, conso, () => versConso(u.rateLimits, u.cost?.usd))
    const now = await $.clock.now()
    await update($, maintenant, () => now)
    // Rafraîchit le compte à rebours chaque minute.
    $.clock.every(60_000, async () => {
      const t = await $.clock.now()
      await update($, maintenant, () => t)
    })
    return r
  })

  on('session.measure', async ($, e, next) => {
    await update($, conso, () => versConso(e.rateLimits, e.cost?.usd))
    const now = await $.clock.now()
    await update($, maintenant, () => now)

    // Alertes : une seule fois par fenêtre (clé = type + date de remise).
    const deja = await read($, alertes)
    const nouvelles: string[] = []
    for (const f of e.rateLimits) {
      if (!f.resetsAt || !DUREES[f.kind]) continue
      const nom = NOMS[f.kind] ?? f.kind
      const fin = new Date(f.resetsAt).getTime()
      const cle = `${f.kind}@${f.resetsAt}`
      if (f.percentUsed >= 80) {
        // Au-delà de 80 %, l'alerte 80 % suffit : pas de 2e alerte « rythme ».
        if (deja.includes(`${cle}:80`)) continue
        nouvelles.push(`${cle}:80`)
        $.ui.toast(`⚠ Conso Claude (${nom}) : ${Math.round(f.percentUsed)} % utilisé, remise dans ${duree(fin - now)}`)
        continue
      }
      const r = rythme(f, fin, now)
      if (r && !r.ok && !deja.includes(`${cle}:rythme`)) {
        nouvelles.push(`${cle}:rythme`)
        $.ui.toast(`⚠ Conso Claude (${nom}) : ${r.texte} (remise dans ${duree(fin - now)})`)
      }
    }
    if (nouvelles.length > 0) {
      // Ne garde que les 20 dernières clés.
      await update($, alertes, l => [...(l ?? []), ...nouvelles].slice(-20))
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const c = await read($, conso)
    const now = (await read($, maintenant)) || Date.now()
    const { Box, Text } = $.ui.resolve(e)

    if (!c || c.fenetres.length === 0) {
      return (
        <Box>
          <Text dimColor>Conso Claude : en attente du premier message (les limites arrivent avec la prochaine réponse)</Text>
        </Box>
      )
    }

    const lignes = c.fenetres.map(f => {
      const pct = Math.min(100, Math.max(0, Math.round(f.percentUsed)))
      const pleines = Math.round((pct / 100) * CASES)
      const fin = f.resetsAt ? new Date(f.resetsAt).getTime() : NaN
      const aFin = !Number.isNaN(fin)
      const r = aFin ? rythme(f, fin, now) : null
      return (
        <Box key={f.kind} flexDirection="row">
          <Box width={9}>
            <Text weight="semibold">{NOMS[f.kind] ?? f.kind}</Text>
          </Box>
          <Text>
            <Text color={couleur(pct)}>{'█'.repeat(pleines)}</Text>
            <Text dimColor>{'░'.repeat(CASES - pleines)}</Text>
            <Text color={couleur(pct)}>{`  ${pct} %`}</Text>
            {r ? (
              <Text color={r.ok ? 'success' : 'warning'}>{`   ${r.ok ? '✓' : '⚠'} ${r.texte}`}</Text>
            ) : null}
            {aFin ? <Text dimColor>{`   · remise dans ${duree(fin - now)}`}</Text> : null}
          </Text>
        </Box>
      )
    })

    return (
      <Box flexDirection="column">
        {lignes}
        {c.usd !== undefined ? (
          <Text dimColor>{`Cette session ≈ ${c.usd.toFixed(2).replace('.', ',')} $ (indicatif, inclus dans ton forfait)`}</Text>
        ) : null}
      </Box>
    )
  })
}
