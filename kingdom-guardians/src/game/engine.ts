import { HT, HEROES, EDMG, HERO_RESPAWN, COLS, ROWS, TS, W, H, TT, ET, TOWERS, ENEMIES, PATH, PATH_LEN, posAt, waveList, hpScale, TOTAL_WAVES, isBuildable, pathSet, riverSet, treeSet, key, hash } from './data'
import { Save, store } from './save'
import { makeSprites, SC } from './sprites'

export interface Tower { id: number; t: TT; gx: number; gy: number; lv: number; cd: number; ang: number; spent: number }
interface Enemy { id: number; t: ET; hp: number; max: number; d: number; x: number; y: number; slowT: number; slowF: number; ph: number; dir: number; blk: boolean; atk: number }
interface Proj { x: number; y: number; tgt: Enemy; t: TT; dmg: number; splash: number; slow: number; magic: boolean }
interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; c: string; r: number }
interface Bolt { pts: { x: number; y: number }[]; life: number }
interface Ring { x: number; y: number; r: number; max: number; life: number; c: string }
interface Hero { t: HT; x: number; y: number; hp: number; max: number; dead: boolean; rt: number; tx: number | null; ty: number | null; cd: number; sw: number; ang: number; face: number; moving: boolean }
export type Phase = 'idle' | 'playing' | 'over' | 'victory'
export interface Hud {
  gold: number; lives: number; wave: number; phase: Phase; paused: boolean; speed: number; running: boolean; build: TT | null; reward: number
  hero: { t: HT; hp: number; max: number; dead: boolean; rt: number; sel: boolean }
  sel: null | { t: TT; lv: number; dmg: number; range: number; rate: number; upCost: number | null; sell: number }
}

export class Game {
  towers: Tower[] = []; enemies: Enemy[] = []; projs: Proj[] = []; parts: Part[] = []; bolts: Bolt[] = []; rings: Ring[] = []
  gold = 150; lives: number; wave = 1; phase: Phase = 'idle'; paused = false; speed = 1; running = false
  queue: ET[] = []; spawnT = 0; gap = 1; selected: Tower | null = null; build: TT | null = null
  hover: { gx: number; gy: number } | null = null; uid = 1; time = 0; reward = 0; bg: HTMLCanvasElement
  dm: number; rm: number; gm: number
  hero: Hero; heroSel = false; spr = makeSprites(); mark: { x: number; y: number; t: number } | null = null
  constructor(public save: Save, public sfx: (n: string) => void, ht: HT) {
    this.hero = this.newHero(ht)
    this.dm = 1 + 0.1 * save.up.dmg; this.rm = 1 + 0.08 * save.up.rate; this.gm = 1 + 0.1 * save.up.gold
    this.lives = 20 + 3 * save.up.hp; this.bg = this.makeBg()
  }
  private newHero(t: HT): Hero { const d = HEROES[t]; return { t, x: 220, y: 200, hp: d.hp, max: d.hp, dead: false, rt: 0, tx: null, ty: null, cd: 0, sw: 0, ang: 0, face: 1, moving: false } }
  private updateHero(dt: number) {
    const h = this.hero, d = HEROES[h.t]
    for (const e of this.enemies) e.blk = false
    if (this.mark) { this.mark.t -= dt; if (this.mark.t <= 0) this.mark = null }
    if (h.dead) { h.rt -= dt; if (h.rt <= 0) { Object.assign(h, this.newHero(h.t)); this.ring(h.x, h.y, '#fde047', 60); this.sfx('build') } return }
    h.moving = false
    if (h.tx !== null && h.ty !== null) {
      const dx = h.tx - h.x, dy = h.ty - h.y, dist = Math.hypot(dx, dy), st = d.speed * dt
      if (dist <= st) { h.x = h.tx; h.y = h.ty; h.tx = null; h.ty = null } else { h.x += dx / dist * st; h.y += dy / dist * st; h.moving = true; h.face = dx >= 0 ? 1 : -1 }
    }
    // ghim: quái ở gần sẽ dừng lại đánh tướng (tối đa d.cap con)
    const near = this.enemies.filter(e => e.hp > 0 && Math.hypot(e.x - h.x, e.y - h.y) <= 28 + ENEMIES[e.t].r).sort((a, b) => b.d - a.d).slice(0, d.cap)
    for (const e of near) {
      e.blk = true; e.atk -= dt
      if (e.atk <= 0) { e.atk = 1; h.hp -= EDMG[e.t] * (1 - d.armor); this.burst(h.x, h.y, '#ef4444', 3) }
    }
    if (h.hp <= 0) { h.hp = 0; h.dead = true; h.rt = HERO_RESPAWN; h.tx = null; h.ty = null; this.heroSel = false; this.burst(h.x, h.y, '#fff', 24); this.sfx('lose'); return }
    if (!near.length) h.hp = Math.min(h.max, h.hp + h.max * 0.02 * dt)
    h.cd -= dt; h.sw = Math.max(0, h.sw - dt * 4)
    if (h.cd > 0) return
    let tg: Enemy | null = null
    for (const e of this.enemies) {
      if (e.hp <= 0 || Math.hypot(e.x - h.x, e.y - h.y) > d.range + ENEMIES[e.t].r) continue
      if (!tg || (e.blk && !tg.blk) || (e.blk === tg.blk && e.d > tg.d)) tg = e
    }
    if (!tg) { h.cd = 0.05; return }
    h.face = tg.x >= h.x ? 1 : -1; h.ang = Math.atan2(tg.y - h.y, tg.x - h.x); h.cd = 1 / (d.rate * this.rm); h.sw = 1
    const dmg = d.dmg * this.dm
    if (h.t === 'warrior') { this.damage(tg, dmg, false); this.burst(tg.x, tg.y, '#fff', 4); this.sfx('archer') }
    else { this.projs.push({ x: h.x, y: h.y - 8, tgt: tg, t: h.t === 'archer' ? 'archer' : 'mage', dmg, splash: h.t === 'mage' ? 38 : 0, slow: 0, magic: h.t === 'mage' }); this.sfx(h.t === 'archer' ? 'archer' : 'mage') }
  }
  hud(): Hud {
    let sel: Hud['sel'] = null
    const s = this.selected
    if (s) { const d = TOWERS[s.t], i = s.lv - 1
      sel = { t: s.t, lv: s.lv, dmg: d.dmg[i] * this.dm, range: d.range[i], rate: d.rate[i] * this.rm, upCost: s.lv < 3 ? d.up[i] : null, sell: Math.floor(s.spent * 0.7) } }
    const h = this.hero; return { hero: { t: h.t, hp: h.hp, max: h.max, dead: h.dead, rt: h.rt, sel: this.heroSel }, gold: this.gold, lives: this.lives, wave: Math.min(this.wave, TOTAL_WAVES), phase: this.phase, paused: this.paused, speed: this.speed, running: this.running, build: this.build, reward: this.reward, sel }
  }
  startWave() {
    if (this.running || this.phase === 'over' || this.phase === 'victory') return
    this.phase = 'playing'; this.running = true; this.queue = waveList(this.wave); this.gap = Math.max(0.4, 1 - this.wave * 0.03); this.spawnT = 0
    this.sfx('wave')
  }
  togglePause() { this.paused = !this.paused }
  cycleSpeed() { this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 3 : 1 }
  selectBuild(t: TT | null) { this.build = this.build === t ? null : t; this.selected = null; this.heroSel = false }
  toggleHero() { if (!this.hero.dead) { this.heroSel = !this.heroSel; this.build = null; this.selected = null } }
  move(px: number, py: number) { this.hover = { gx: Math.floor(px / TS), gy: Math.floor(py / TS) } }
  click(px: number, py: number) {
    const gx = Math.floor(px / TS), gy = Math.floor(py / TS)
    const tw = this.towers.find(t => t.gx === gx && t.gy === gy)
    if (tw) { this.selected = tw; this.build = null; this.heroSel = false; return }
    const h = this.hero
    if (!h.dead && Math.hypot(px - h.x, py - h.y) < 24) { this.toggleHero(); return }
    if (this.heroSel && !h.dead) {
      if (riverSet.has(key(gx, gy))) return
      h.tx = Math.min(W - 10, Math.max(10, px)); h.ty = Math.min(H - 10, Math.max(10, py))
      this.mark = { x: h.tx, y: h.ty, t: 1.2 }; this.heroSel = false; this.sfx('build'); return
    }
    if (this.build && isBuildable(gx, gy)) {
      const c = TOWERS[this.build].cost
      if (this.gold >= c) {
        this.gold -= c; const t: Tower = { id: this.uid++, t: this.build, gx, gy, lv: 1, cd: 0, ang: 0, spent: c }
        this.towers.push(t); this.selected = t; this.build = null; this.ring(gx * TS + 20, gy * TS + 20, TOWERS[t.t].color); this.sfx('build')
      } else this.sfx('no')
      return
    }
    this.selected = null
  }
  upgrade() {
    const s = this.selected; if (!s || s.lv >= 3) return
    const c = TOWERS[s.t].up[s.lv - 1]
    if (this.gold < c) { this.sfx('no'); return }
    this.gold -= c; s.spent += c; s.lv++; this.ring(s.gx * TS + 20, s.gy * TS + 20, '#fde047'); this.sfx('build')
  }
  sell() {
    const s = this.selected; if (!s) return
    this.gold += Math.floor(s.spent * 0.7); this.towers = this.towers.filter(t => t !== s); this.selected = null; this.sfx('coin')
  }
  // ---------- logic ----------
  private ring(x: number, y: number, c: string, max = 40) { this.rings.push({ x, y, r: 4, max, life: 0.4, c }) }
  private burst(x: number, y: number, c: string, n: number) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 40 + Math.random() * 120
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5, max: 0.5, c, r: 2 + Math.random() * 3 }) }
  }
  private damage(e: Enemy, amt: number, magic: boolean) {
    if (e.hp <= 0) return
    e.hp -= magic ? amt : amt * (1 - ENEMIES[e.t].armor)
    if (e.hp <= 0) {
      const g = Math.round(ENEMIES[e.t].gold * this.gm); this.gold += g
      this.burst(e.x, e.y, e.t === 'dragon' ? '#f97316' : '#fbbf24', e.t === 'dragon' ? 40 : 14); this.ring(e.x, e.y, '#fff', e.t === 'dragon' ? 90 : 30); this.sfx('die')
    }
  }
  private fire(tw: Tower): boolean {
    const d = TOWERS[tw.t], i = tw.lv - 1, tx = tw.gx * TS + 20, ty = tw.gy * TS + 20, r = d.range[i]
    let tg: Enemy | null = null
    for (const e of this.enemies) if (e.hp > 0 && Math.hypot(e.x - tx, e.y - ty) <= r + ENEMIES[e.t].r && (!tg || e.d > tg.d)) tg = e
    if (!tg) return false
    tw.ang = Math.atan2(tg.y - ty, tg.x - tx)
    const dmg = d.dmg[i] * this.dm
    if (tw.t === 'lightning') {
      const used = new Set<Enemy>([tg]); const pts = [{ x: tx, y: ty }, { x: tg.x, y: tg.y }]; let cur = tg
      this.damage(tg, dmg, true)
      for (let k = 1; k < d.chain![i]; k++) {
        let nx: Enemy | null = null, nd = 90
        for (const e of this.enemies) if (e.hp > 0 && !used.has(e)) { const dd = Math.hypot(e.x - cur.x, e.y - cur.y); if (dd < nd) { nd = dd; nx = e } }
        if (!nx) break
        used.add(nx); pts.push({ x: nx.x, y: nx.y }); this.damage(nx, dmg * 0.8, true); cur = nx
      }
      this.bolts.push({ pts, life: 0.15 })
    } else {
      this.projs.push({ x: tx + Math.cos(tw.ang) * 14, y: ty + Math.sin(tw.ang) * 14, tgt: tg, t: tw.t, dmg, splash: d.splash ?? 0, slow: d.slow ? d.slow[i] : 0, magic: tw.t === 'mage' || tw.t === 'ice' })
    }
    tw.cd = 1 / (d.rate[i] * this.rm); this.sfx(tw.t); return true
  }
  private end(victory: boolean) {
    this.phase = victory ? 'victory' : 'over'; this.running = false
    this.reward = victory ? 100 + this.lives * 2 : (this.wave - 1) * 4
    this.save.crystals += this.reward; this.save.best = Math.max(this.save.best, victory ? TOTAL_WAVES : this.wave - 1); store(this.save)
    this.sfx(victory ? 'win' : 'lose')
  }
  update(rdt: number) {
    this.time += rdt
    if (this.paused || this.phase === 'over' || this.phase === 'victory') return
    const dt = Math.min(rdt, 0.05) * this.speed
    if (this.running && this.queue.length) {
      this.spawnT -= dt
      if (this.spawnT <= 0) {
        const t = this.queue.shift()!, hp = ENEMIES[t].hp * hpScale(this.wave); this.spawnT = this.gap
        this.enemies.push({ id: this.uid++, t, hp, max: hp, d: 0, x: PATH[0].x, y: PATH[0].y, slowT: 0, slowF: 1, ph: Math.random() * 6, dir: 1, blk: false, atk: 0 })
      }
    }
    this.updateHero(dt)
    for (const e of this.enemies) {
      if (e.hp <= 0) continue
      if (e.slowT > 0) e.slowT -= dt
      if (!e.blk) e.d += ENEMIES[e.t].speed * (e.slowT > 0 ? e.slowF : 1) * dt
      if (e.d >= PATH_LEN) { e.hp = 0; this.lives -= ENEMIES[e.t].lives; this.ring(e.x, e.y, '#ef4444', 50); this.sfx('hurt'); continue }
      const p = posAt(e.d); if (p.x !== e.x) e.dir = p.x > e.x ? 1 : -1; e.x = p.x; e.y = p.y
    }
    this.enemies = this.enemies.filter(e => e.hp > 0)
    for (const t of this.towers) { t.cd -= dt; if (t.cd <= 0 && !this.fire(t)) t.cd = 0.05 }
    for (const p of this.projs) {
      const sp = (p.t === 'archer' ? 460 : p.t === 'cannon' ? 300 : 360) * dt
      const dx = p.tgt.x - p.x, dy = p.tgt.y - p.y, dist = Math.hypot(dx, dy)
      if (p.tgt.hp <= 0 && p.splash === 0) { p.dmg = -1; continue }
      if (dist <= sp + 4) {
        p.dmg < 0 || this.hit(p); p.dmg = -1
      } else { p.x += dx / dist * sp; p.y += dy / dist * sp }
    }
    this.projs = this.projs.filter(p => p.dmg >= 0)
    for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt }
    this.parts = this.parts.filter(p => p.life > 0)
    for (const b of this.bolts) b.life -= dt; this.bolts = this.bolts.filter(b => b.life > 0)
    for (const r of this.rings) r.life -= dt; this.rings = this.rings.filter(r => r.life > 0)
    if (this.lives <= 0) { this.lives = 0; this.end(false); return }
    if (this.running && !this.queue.length && !this.enemies.length) {
      this.running = false; this.gold += 20 + this.wave * 3; this.sfx('coin')
      if (this.wave >= TOTAL_WAVES) this.end(true); else this.wave++
    }
  }
  private hit(p: Proj) {
    if (p.splash > 0) {
      this.ring(p.x, p.y, '#fb923c', p.splash); this.burst(p.x, p.y, '#f97316', 10)
      for (const e of this.enemies) if (Math.hypot(e.x - p.x, e.y - p.y) <= p.splash) this.damage(e, p.dmg, p.magic)
    } else {
      this.damage(p.tgt, p.dmg, p.magic)
      if (p.slow) { p.tgt.slowT = 2; p.tgt.slowF = p.slow }
      this.burst(p.x, p.y, TOWERS[p.t].color, 4)
    }
  }
  // ---------- render ----------
  private makeBg() {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')!
    for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) {
      const k = key(x, y)
      g.fillStyle = (x + y) % 2 ? '#4d8f3a' : '#55993f'; g.fillRect(x * TS, y * TS, TS, TS)
      if (pathSet.has(k)) { g.fillStyle = '#b08850'; g.fillRect(x * TS, y * TS, TS, TS); g.fillStyle = '#9a7541'; g.fillRect(x * TS + 6, y * TS + 8, 5, 4); g.fillRect(x * TS + 24, y * TS + 26, 6, 4) }
      else if (riverSet.has(k)) { g.fillStyle = '#2f7fc1'; g.fillRect(x * TS, y * TS, TS, TS); g.strokeStyle = '#8ec9f2'; g.lineWidth = 2; g.beginPath(); g.moveTo(x * TS + 6, y * TS + 14); g.quadraticCurveTo(x * TS + 14, y * TS + 8, x * TS + 22, y * TS + 14); g.stroke() }
      else if (treeSet.has(k)) {
        g.fillStyle = '#5b3a1e'; g.fillRect(x * TS + 17, y * TS + 24, 6, 12)
        g.fillStyle = '#1f6a2a'; g.beginPath(); g.arc(x * TS + 20, y * TS + 18, 14, 0, 6.28); g.fill()
        g.fillStyle = '#2b8a38'; g.beginPath(); g.arc(x * TS + 16, y * TS + 14, 7, 0, 6.28); g.fill()
      } else if (hash(x + 3, y) < 0.12) { g.fillStyle = '#fde68a'; g.beginPath(); g.arc(x * TS + 10 + hash(y, x) * 20, y * TS + 10 + hash(x, y + 1) * 20, 2.5, 0, 6.28); g.fill() }
    }
    // cổng quái & lâu đài
    g.fillStyle = '#4c1d95'; g.beginPath(); g.arc(PATH[0].x, PATH[0].y, 18, 0, 6.28); g.fill()
    const cx = W - 22, cy = PATH[PATH.length - 1].y
    g.fillStyle = '#d6d3d1'; g.fillRect(cx - 18, cy - 20, 36, 40); g.fillStyle = '#a8a29e'
    for (let i = 0; i < 3; i++) g.fillRect(cx - 18 + i * 14, cy - 27, 8, 8)
    g.fillStyle = '#7c2d12'; g.fillRect(cx - 6, cy, 12, 20); g.fillStyle = '#ef4444'; g.fillRect(cx - 1, cy - 38, 14, 8); g.fillRect(cx - 2, cy - 38, 2, 20)
    return c
  }
  draw(g: CanvasRenderingContext2D) {
    g.drawImage(this.bg, 0, 0)
    const h = this.hover, sel = this.selected
    if (this.build && h && isBuildable(h.gx, h.gy) && !this.towers.some(t => t.gx === h.gx && t.gy === h.gy)) {
      const d = TOWERS[this.build], ok = this.gold >= d.cost
      this.rangeCircle(g, h.gx * TS + 20, h.gy * TS + 20, d.range[0], ok ? '#fff' : '#f87171')
      g.globalAlpha = 0.6; this.drawTower(g, this.build, h.gx * TS + 20, h.gy * TS + 20, 1, 0); g.globalAlpha = 1
    }
    if (sel) this.rangeCircle(g, sel.gx * TS + 20, sel.gy * TS + 20, TOWERS[sel.t].range[sel.lv - 1], '#fde047')
    for (const t of [...this.towers].sort((a, b) => a.gy - b.gy)) this.drawTower(g, t.t, t.gx * TS + 20, t.gy * TS + 20, t.lv, t.ang)
    for (const e of [...this.enemies].sort((a, b) => a.y - b.y)) this.drawEnemy(g, e)
    this.drawHero(g)
    for (const p of this.projs) {
      if (p.t === 'archer') { const a = Math.atan2(p.tgt.y - p.y, p.tgt.x - p.x); g.strokeStyle = '#fef3c7'; g.lineWidth = 2; g.beginPath(); g.moveTo(p.x - Math.cos(a) * 8, p.y - Math.sin(a) * 8); g.lineTo(p.x + Math.cos(a) * 4, p.y + Math.sin(a) * 4); g.stroke() }
      else { g.fillStyle = p.t === 'cannon' ? '#111' : TOWERS[p.t].color; g.shadowColor = TOWERS[p.t].color; g.shadowBlur = p.t === 'cannon' ? 0 : 10; g.beginPath(); g.arc(p.x, p.y, p.t === 'cannon' ? 6 : 5, 0, 6.28); g.fill(); g.shadowBlur = 0 }
    }
    for (const b of this.bolts) {
      g.strokeStyle = '#fef08a'; g.lineWidth = 3; g.shadowColor = '#facc15'; g.shadowBlur = 12; g.beginPath()
      b.pts.forEach((p, i) => { const jx = i ? (Math.random() - 0.5) * 8 : 0, jy = i ? (Math.random() - 0.5) * 8 : 0; i ? g.lineTo(p.x + jx, p.y + jy) : g.moveTo(p.x, p.y) }); g.stroke(); g.shadowBlur = 0
    }
    for (const r of this.rings) { const k = 1 - r.life / 0.4; g.globalAlpha = 1 - k; g.strokeStyle = r.c; g.lineWidth = 3; g.beginPath(); g.arc(r.x, r.y, 4 + (r.max - 4) * k, 0, 6.28); g.stroke(); g.globalAlpha = 1 }
    for (const p of this.parts) { g.globalAlpha = Math.max(0, p.life / p.max); g.fillStyle = p.c; g.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r) }
    g.globalAlpha = 1
  }
  private rangeCircle(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: string) {
    g.fillStyle = 'rgba(255,255,255,.1)'; g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, 6.28); g.fill(); g.stroke()
  }
  private drawTower(g: CanvasRenderingContext2D, t: TT, x: number, y: number, lv: number, ang: number) {
    const c = TOWERS[t].color, h = 22 + lv * 7, b = y + 17, top = b - h, tm = this.time, ty = top - 3
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x, b, 21, 7, 0, 0, 6.28); g.fill()
    const gr = g.createLinearGradient(x - 14, 0, x + 14, 0); gr.addColorStop(0, '#8b8f98'); gr.addColorStop(0.45, '#d6d9df'); gr.addColorStop(1, '#6b7078')
    g.fillStyle = gr; g.fillRect(x - 14, top, 28, h)
    g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 1
    for (let r = top + 6, k = 0; r < b - 6; r += 7, k++) {
      g.beginPath(); g.moveTo(x - 14, r); g.lineTo(x + 14, r)
      for (let q = x - 14 + (k % 2 ? 4 : 11); q < x + 14; q += 14) { g.moveTo(q, r); g.lineTo(q, r + 7) }
      g.stroke()
    }
    g.fillStyle = c; g.fillRect(x - 14, top + 8, 28, 5)
    if (lv >= 2) { g.fillStyle = '#b91c1c'; g.beginPath(); g.moveTo(x - 12, top + 14); g.lineTo(x - 12, top + 30); g.lineTo(x - 8, top + 26); g.lineTo(x - 4, top + 30); g.lineTo(x - 4, top + 14); g.fill() }
    g.fillStyle = '#1c1917'; g.fillRect(x + 4, top + 16, 3, 7)
    g.fillStyle = '#57534e'; g.fillRect(x - 18, b - 7, 36, 7)
    g.fillStyle = '#2a1d12'; g.beginPath(); g.moveTo(x - 5, b - 7); g.lineTo(x - 5, b - 14); g.arc(x, b - 14, 5, Math.PI, 0); g.lineTo(x + 5, b - 7); g.fill()
    g.fillStyle = lv >= 3 ? '#fbbf24' : '#a8a29e'; g.fillRect(x - 18, top - 3, 36, 5)
    for (let i = 0; i < 4; i++) g.fillRect(x - 18 + i * 10, top - 9, 7, 7)
    g.fillStyle = '#fde047'; for (let i = 0; i < lv; i++) { g.beginPath(); g.arc(x - (lv - 1) * 5 + i * 10, b - 3.5, 2.2, 0, 6.28); g.fill() }
    if (t === 'archer') {
      g.fillStyle = '#7c2d12'; g.fillRect(x - 12, ty - 14, 24, 11)
      g.fillStyle = '#b91c1c'; g.beginPath(); g.moveTo(x - 17, ty - 13); g.lineTo(x, ty - 28 - lv * 2); g.lineTo(x + 17, ty - 13); g.fill()
      g.fillStyle = '#1c1917'; g.fillRect(x - 5, ty - 10, 10, 6); g.fillStyle = '#f5cfa0'; g.beginPath(); g.arc(x, ty - 7, 3, 0, 6.28); g.fill()
      g.strokeStyle = '#fef3c7'; g.lineWidth = 1.5; g.beginPath(); g.arc(x + Math.cos(ang) * 8, ty - 7 + Math.sin(ang) * 4, 5, ang - 1.2, ang + 1.2); g.stroke()
    } else if (t === 'cannon') {
      g.fillStyle = '#3f3f46'; g.beginPath(); g.arc(x, ty - 5, 11, 0, 6.28); g.fill()
      g.save(); g.translate(x, ty - 6); g.rotate(ang); g.fillStyle = '#18181b'; g.fillRect(-2, -5, 20 + lv * 2, 10); g.fillStyle = '#52525b'; g.fillRect(14 + lv * 2, -6, 6, 12); g.restore()
      g.fillStyle = '#a1a1aa'; g.beginPath(); g.arc(x, ty - 6, 4, 0, 6.28); g.fill()
    } else if (t === 'mage') {
      g.fillStyle = '#6b21a8'; g.beginPath(); g.moveTo(x - 11, ty); g.lineTo(x - 5, ty - 20 - lv * 3); g.lineTo(x + 5, ty - 20 - lv * 3); g.lineTo(x + 11, ty); g.fill()
      g.fillStyle = '#a855f7'; g.beginPath(); g.moveTo(x - 6, ty - 20 - lv * 3); g.lineTo(x, ty - 30 - lv * 3); g.lineTo(x + 6, ty - 20 - lv * 3); g.fill()
      g.shadowColor = '#d8b4fe'; g.shadowBlur = 14; g.fillStyle = '#e9d5ff'; g.beginPath(); g.arc(x, ty - 36 - lv * 3 + Math.sin(tm * 3) * 3, 5, 0, 6.28); g.fill(); g.shadowBlur = 0
    } else if (t === 'ice') {
      g.fillStyle = '#bae6fd'
      for (const [dx, hh] of [[-9, 14], [0, 22], [9, 16]]) { g.beginPath(); g.moveTo(x + dx - 5, ty); g.lineTo(x + dx, ty - hh - lv * 3); g.lineTo(x + dx + 5, ty); g.fill() }
      g.shadowColor = '#38bdf8'; g.shadowBlur = 10; g.fillStyle = '#e0f2fe'; g.beginPath(); g.arc(x, ty - 5, 3.5, 0, 6.28); g.fill(); g.shadowBlur = 0
    } else {
      const oy = ty - 20 - lv * 2
      g.strokeStyle = '#a1a1aa'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, ty); g.lineTo(x, oy); g.stroke()
      g.shadowColor = '#facc15'; g.shadowBlur = 14 + Math.sin(tm * 12) * 5; g.fillStyle = '#fde047'; g.beginPath(); g.arc(x, oy, 6, 0, 6.28); g.fill(); g.shadowBlur = 0
      if (Math.sin(tm * 9) > 0.6) { g.strokeStyle = '#fef9c3'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, oy); g.lineTo(x + 10, oy - 8); g.lineTo(x + 6, oy - 12); g.stroke() }
    }
  }
  private drawEnemy(g: CanvasRenderingContext2D, e: Enemy) {
    const d = ENEMIES[e.t], x = e.x, y = e.y, r = d.r, spr = this.spr[e.t]
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x, y + r, r + 2, r / 3, 0, 0, 6.28); g.fill()
    let top = y - r - 9
    if (spr) {
      const s = SC[e.t], fr = e.blk ? 0 : Math.floor(this.time * 8 + e.ph) % 2, lunge = e.blk ? Math.sin(this.time * 14 + e.ph) * 2 : 0
      g.save(); g.imageSmoothingEnabled = false; g.translate(x + lunge * e.dir, y - 6); g.scale(e.dir, 1)
      g.drawImage(spr[fr], -8 * s, -8 * s, 16 * s, 16 * s); g.restore(); g.imageSmoothingEnabled = true
      top = y - 6 - 8 * s - 6
    } else {
      const bob = Math.sin(this.time * 6 + e.ph) * 3
      g.fillStyle = '#7f1d1d'; g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x - 32, y - 22 + bob * 3); g.lineTo(x - 8, y + 10); g.fill()
      g.beginPath(); g.moveTo(x + 6, y); g.lineTo(x + 32, y - 22 - bob * 3); g.lineTo(x + 8, y + 10); g.fill()
      g.fillStyle = '#dc2626'; g.beginPath(); g.arc(x, y, r, 0, 6.28); g.fill()
      g.fillStyle = '#fde047'; g.beginPath(); g.arc(x - 7, y - 4, 3, 0, 6.28); g.arc(x + 7, y - 4, 3, 0, 6.28); g.fill()
    }
    if (e.slowT > 0) { g.strokeStyle = '#7dd3fc'; g.lineWidth = 3; g.beginPath(); g.arc(x, y - 4, r + 4, 0, 6.28); g.stroke() }
    const w = Math.max(24, r * 2); g.fillStyle = '#000a'; g.fillRect(x - w / 2, top, w, 5)
    g.fillStyle = e.hp / e.max > 0.5 ? '#22c55e' : e.hp / e.max > 0.25 ? '#eab308' : '#ef4444'; g.fillRect(x - w / 2, top, w * Math.max(0, e.hp / e.max), 5)
  }
  private drawHero(g: CanvasRenderingContext2D) {
    const h = this.hero, d = HEROES[h.t], x = h.x, y = h.y, tm = this.time
    if (this.mark) { const m = this.mark; g.strokeStyle = '#fde047'; g.lineWidth = 3; g.globalAlpha = Math.min(1, m.t); g.beginPath(); g.arc(m.x, m.y, 10 + Math.sin(tm * 10) * 2, 0, 6.28); g.moveTo(m.x - 6, m.y - 6); g.lineTo(m.x + 6, m.y + 6); g.moveTo(m.x + 6, m.y - 6); g.lineTo(m.x - 6, m.y + 6); g.stroke(); g.globalAlpha = 1 }
    if (h.dead) {
      g.fillStyle = '#78716c'; g.beginPath(); g.moveTo(x - 10, y + 12); g.lineTo(x - 10, y - 6); g.arc(x, y - 6, 10, Math.PI, 0); g.lineTo(x + 10, y + 12); g.fill()
      g.fillStyle = '#d6d3d1'; g.fillRect(x - 1.5, y - 10, 3, 12); g.fillRect(x - 5, y - 6, 10, 3)
      g.font = 'bold 13px Nunito, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(Math.ceil(h.rt) + 's', x, y - 22); return
    }
    if (this.heroSel) { this.rangeCircle(g, x, y, d.range, '#fde047'); g.strokeStyle = '#fde047'; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y + 14, 18 + Math.sin(tm * 8) * 2, 7, 0, 0, 6.28); g.stroke() }
    const bob = h.moving ? Math.sin(tm * 14) * 2 : 0
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x, y + 15, 12, 4, 0, 0, 6.28); g.fill()
    g.save(); g.translate(x, y + bob); g.scale(h.face, 1)
    g.fillStyle = '#3f2d20'; g.fillRect(-6, 10, 5, 6); g.fillRect(1, 10, 5, 6)
    g.fillStyle = d.color; g.beginPath(); g.moveTo(-9, h.t === 'mage' ? 14 : 4); g.lineTo(-7, -6); g.lineTo(7, -6); g.lineTo(9, h.t === 'mage' ? 14 : 10); g.fill()
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(-7, 3, 14, 3)
    g.fillStyle = '#f5cfa0'; g.beginPath(); g.arc(0, -12, 7, 0, 6.28); g.fill(); g.fillStyle = '#111'; g.fillRect(2, -13, 2, 2)
    if (h.t === 'warrior') {
      g.fillStyle = '#9ca3af'; g.beginPath(); g.arc(0, -13, 8, Math.PI, 0); g.fill(); g.fillStyle = '#dc2626'; g.fillRect(-1.5, -26, 3, 7)
      g.fillStyle = '#1d4ed8'; g.fillRect(-14, -4, 7, 12); g.fillStyle = '#fbbf24'; g.fillRect(-12, -1, 3, 6)
      g.save(); g.translate(8, 0); g.rotate(-0.6 + h.sw * 1.8); g.fillStyle = '#e5e7eb'; g.fillRect(0, -20, 3, 22); g.fillStyle = '#fbbf24'; g.fillRect(-3, 0, 9, 3); g.restore()
    } else if (h.t === 'archer') {
      g.fillStyle = '#14532d'; g.beginPath(); g.moveTo(-9, -10); g.lineTo(0, -24); g.lineTo(9, -10); g.lineTo(0, -6); g.fill()
      g.strokeStyle = '#92400e'; g.lineWidth = 2; g.beginPath(); g.arc(9 - h.sw * 3, -2, 11, -1.2, 1.2); g.stroke()
      g.strokeStyle = '#fef3c7'; g.lineWidth = 1; g.beginPath(); g.moveTo(9 - h.sw * 3 + 5, -11); g.lineTo(9 - h.sw * 3 + 5, 7); g.stroke()
      g.fillStyle = '#78350f'; g.fillRect(-12, -6, 4, 12)
    } else {
      g.fillStyle = '#6b21a8'; g.beginPath(); g.moveTo(-10, -16); g.lineTo(0, -36); g.lineTo(10, -16); g.fill(); g.fillRect(-11, -17, 22, 3)
      g.strokeStyle = '#92400e'; g.lineWidth = 3; g.beginPath(); g.moveTo(11, 15); g.lineTo(11, -20); g.stroke()
      g.shadowColor = '#d8b4fe'; g.shadowBlur = 8 + h.sw * 14; g.fillStyle = '#e9d5ff'; g.beginPath(); g.arc(11, -24, 5, 0, 6.28); g.fill(); g.shadowBlur = 0
    }
    g.restore()
    const w = 36; g.fillStyle = '#000a'; g.fillRect(x - w / 2, y - 46, w, 6); g.fillStyle = '#38bdf8'; g.fillRect(x - w / 2, y - 46, w * h.hp / h.max, 6)
    g.font = 'bold 11px Nunito, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(d.title, x, y - 50)
  }
}
