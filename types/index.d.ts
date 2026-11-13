export type Fenetre = { kind: string; percentUsed: number; resetsAt?: string }
export type Conso = { fenetres: Fenetre[]; usd?: number }

declare module 'claude-code' {
  interface PluginState {
    'jauge-conso': { conso: Conso | null; maintenant: number; alertes: string[] }
  }
}
