import { TT } from './data'
export interface Save { crystals: number; up: { dmg: number; rate: number; gold: number; hp: number }; unlocked: TT[]; sound: boolean; best: number }
const KEY = 'kingdom-guardians-v1'
export const defaultSave = (): Save => ({ crystals: 0, up: { dmg: 0, rate: 0, gold: 0, hp: 0 }, unlocked: ['archer', 'cannon'], sound: true, best: 0 })
export function load(): Save {
  try { const r = localStorage.getItem(KEY); if (r) return { ...defaultSave(), ...JSON.parse(r) } } catch { /* ignore */ }
  return defaultSave()
}
export function store(s: Save) { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* ignore */ } }
export const UPGRADES: { id: keyof Save['up']; name: string; desc: string; base: number; max: number }[] = [
  { id: 'dmg', name: 'Sát thương tháp', desc: '+10% sát thương mỗi cấp', base: 40, max: 10 },
  { id: 'rate', name: 'Tốc độ bắn', desc: '+8% tốc độ bắn mỗi cấp', base: 40, max: 10 },
  { id: 'gold', name: 'Vàng nhận được', desc: '+10% vàng mỗi cấp', base: 50, max: 10 },
  { id: 'hp', name: 'Máu căn cứ', desc: '+3 mạng mỗi cấp', base: 30, max: 10 },
]
export const UNLOCKS: Partial<Record<TT, number>> = { mage: 150, ice: 250, lightning: 400 }
