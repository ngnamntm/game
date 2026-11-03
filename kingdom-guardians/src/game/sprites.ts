// Sprite pixel 16x16, 2 khung chân để tạo hoạt ảnh chạy
const BODY = [
  '................', '................', '.kk..kkkkkk..kk.', 'kggkkggggggkkggk', '.kggggggggggggk.',
  '..kggeggggeggk..', '..kggggggggggk..', '...kggwkkwggk...', '....kkggggkk....',
  '...kbbbbbbbbk.s.', '..kgbbbbbbbbgks.', '..kgkbbbbbbkgks.', '...kkbbbbbbkk.h.', '....kbbkkbbk....',
]
const LEGS_A = ['....kgk..kgk....', '...kkkk..kkkk...']
const LEGS_B = ['...kgk....kgk...', '..kkkk....kkkk..']
const BASE: Record<string, string> = { k: '#222034', g: '#6abe30', e: '#fbf236', w: '#ffffff', b: '#8f563b', s: '#cbdbfc', h: '#663931' }
const PAL: Record<string, Record<string, string>> = {
  goblin: BASE,
  orc: { ...BASE, g: '#4b692f', e: '#df3e23', b: '#595652', s: '#9badb7' },
  skeleton: { ...BASE, g: '#e0e4ec', e: '#d95763', b: '#9badb7' },
  knight: { ...BASE, g: '#76728a', b: '#45283c', e: '#ff3b3b', s: '#fbf236', h: '#222034' },
}
export const SC: Record<string, number> = { goblin: 2.3, orc: 3, skeleton: 2.4, knight: 2.8 }
function build(rows: string[], pal: Record<string, string>) {
  const c = document.createElement('canvas'); c.width = 16; c.height = 16; const g = c.getContext('2d')!
  rows.forEach((r, y) => [...r.padEnd(16, '.')].forEach((ch, x) => { const col = pal[ch]; if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1) } }))
  return c
}
export function makeSprites() {
  const out: Record<string, [HTMLCanvasElement, HTMLCanvasElement]> = {}
  for (const k of Object.keys(PAL)) out[k] = [build([...BODY, ...LEGS_A], PAL[k]), build([...BODY, ...LEGS_B], PAL[k])]
  return out
}
