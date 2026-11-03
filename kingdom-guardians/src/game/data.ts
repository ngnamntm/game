export const COLS = 24, ROWS = 13, TS = 40, W = COLS * TS, H = ROWS * TS
export type TT = 'archer' | 'cannon' | 'mage' | 'ice' | 'lightning'
export type ET = 'goblin' | 'orc' | 'skeleton' | 'knight' | 'dragon'
export interface TowerDef {
  name: string; color: string; cost: number; up: [number, number]; desc: string
  dmg: number[]; range: number[]; rate: number[]; splash?: number; slow?: number[]; chain?: number[]
}
export const TOWER_ORDER: TT[] = ['archer', 'cannon', 'mage', 'ice', 'lightning']
export const TOWERS: Record<TT, TowerDef> = {
  archer: { name: 'Archer Tower', color: '#65a30d', cost: 60, up: [50, 100], desc: 'Bắn tên nhanh, sát thương trung bình.',
    dmg: [12, 20, 32], range: [120, 135, 150], rate: [2, 2.4, 3] },
  cannon: { name: 'Cannon Tower', color: '#57534e', cost: 100, up: [80, 150], desc: 'Đại bác gây sát thương diện rộng.',
    dmg: [30, 50, 80], range: [110, 120, 130], rate: [0.7, 0.8, 0.9], splash: 55 },
  mage: { name: 'Mage Tower', color: '#9333ea', cost: 90, up: [75, 140], desc: 'Phép thuật, xuyên giáp.',
    dmg: [28, 46, 72], range: [125, 140, 155], rate: [1, 1.1, 1.3] },
  ice: { name: 'Ice Tower', color: '#38bdf8', cost: 80, up: [60, 120], desc: 'Làm chậm kẻ địch.',
    dmg: [5, 8, 12], range: [105, 115, 125], rate: [1, 1.2, 1.4], slow: [0.5, 0.4, 0.3] },
  lightning: { name: 'Lightning Tower', color: '#facc15', cost: 130, up: [100, 180], desc: 'Sét lan nhiều mục tiêu.',
    dmg: [18, 28, 42], range: [115, 125, 140], rate: [0.9, 1.1, 1.3], chain: [3, 4, 6] },
}
export interface EnemyDef { name: string; hp: number; speed: number; gold: number; armor: number; r: number; lives: number }
export const ENEMIES: Record<ET, EnemyDef> = {
  goblin: { name: 'Goblin', hp: 40, speed: 90, gold: 5, armor: 0, r: 9, lives: 1 },
  orc: { name: 'Orc', hp: 170, speed: 45, gold: 12, armor: 0.1, r: 14, lives: 1 },
  skeleton: { name: 'Skeleton', hp: 80, speed: 65, gold: 8, armor: 0, r: 11, lives: 1 },
  knight: { name: 'Dark Knight', hp: 260, speed: 55, gold: 20, armor: 0.4, r: 13, lives: 2 },
  dragon: { name: 'Dragon Boss', hp: 1800, speed: 40, gold: 200, armor: 0.2, r: 22, lives: 5 },
}
export const TOTAL_WAVES = 20
export function hpScale(w: number) { return 1 + (w - 1) * 0.2 }
export function waveList(n: number): ET[] {
  const a: ET[] = []
  for (let i = 0; i < 4 + n; i++) a.push('goblin')
  if (n >= 2) for (let i = 0; i < n; i++) a.push('skeleton')
  if (n >= 3) for (let i = 0; i < Math.floor(n / 2); i++) a.push('orc')
  if (n >= 7) for (let i = 0; i < Math.floor((n - 5) / 2) + 1; i++) a.push('knight')
  if (n >= 10 && n % 5 === 0) for (let i = 0; i < n / 10 | 0 || 1; i++) a.push('dragon')
  // trộn xác định để mỗi wave đa dạng nhưng ổn định
  return a.map((t, i) => ({ t, k: (i * 7919 + n * 104729) % 1000 })).sort((x, y) => x.k - y.k).map(o => o.t)
}
export const PATH_TILES = [[0, 2], [5, 2], [5, 9], [11, 9], [11, 3], [17, 3], [17, 10], [23, 10]]
export const PATH = PATH_TILES.map(([x, y]) => ({ x: x * TS + TS / 2, y: y * TS + TS / 2 }))
const SEG: number[] = []; let acc = 0
for (let i = 1; i < PATH.length; i++) { acc += Math.hypot(PATH[i].x - PATH[i - 1].x, PATH[i].y - PATH[i - 1].y); SEG.push(acc) }
export const PATH_LEN = acc
export function posAt(d: number) {
  let i = 0
  while (i < SEG.length - 1 && d > SEG[i]) i++
  const s0 = i === 0 ? 0 : SEG[i - 1], t = Math.min(1, (d - s0) / (SEG[i] - s0))
  return { x: PATH[i].x + (PATH[i + 1].x - PATH[i].x) * t, y: PATH[i].y + (PATH[i + 1].y - PATH[i].y) * t }
}
export const key = (x: number, y: number) => x + ',' + y
export const pathSet = new Set<string>()
for (let i = 1; i < PATH_TILES.length; i++) {
  const [x0, y0] = PATH_TILES[i - 1], [x1, y1] = PATH_TILES[i]
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) pathSet.add(key(x, y))
}
export const hash = (x: number, y: number) => Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1
export const riverSet = new Set<string>(), treeSet = new Set<string>()
for (let x = 0; x < 4; x++) for (let y = 10; y < 13; y++) riverSet.add(key(x, y))
for (let x = 4; x < 8; x++) riverSet.add(key(x, 12))
for (let x = 13; x < 16; x++) for (let y = 6; y < 8; y++) riverSet.add(key(x, y))
for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) {
  const k = key(x, y); if (!pathSet.has(k) && !riverSet.has(k) && hash(x, y) < 0.1) treeSet.add(k)
}
export const isBuildable = (x: number, y: number) =>
  x >= 0 && y >= 0 && x < COLS && y < ROWS && ![pathSet, riverSet, treeSet].some(s => s.has(key(x, y)))

export const EDMG: Record<ET, number> = { goblin: 6, orc: 16, skeleton: 9, knight: 20, dragon: 45 }
export type HT = 'warrior' | 'archer' | 'mage'
export interface HeroDef { name: string; title: string; hp: number; dmg: number; range: number; rate: number; speed: number; armor: number; cap: number; color: string; desc: string }
export const HEROES: Record<HT, HeroDef> = {
  warrior: { name: 'Đấu sĩ', title: 'Aldric', hp: 450, dmg: 24, range: 34, rate: 1.4, speed: 95, armor: 0.3, cap: 3, color: '#dc2626', desc: 'Cận chiến, trâu bò, ghim được 3 quái cùng lúc.' },
  archer: { name: 'Xạ thủ', title: 'Lyra', hp: 240, dmg: 18, range: 160, rate: 1.8, speed: 105, armor: 0.1, cap: 2, color: '#16a34a', desc: 'Bắn xa, tốc độ cao nhưng mỏng máu.' },
  mage: { name: 'Pháp sư', title: 'Merlin', hp: 200, dmg: 34, range: 140, rate: 0.9, speed: 85, armor: 0, cap: 2, color: '#9333ea', desc: 'Phép nổ lan, xuyên giáp.' },
}
export const HERO_RESPAWN = 25
