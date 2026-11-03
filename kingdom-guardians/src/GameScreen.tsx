import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Game, Hud } from './game/engine'
import { W, H, TOWERS, TOWER_ORDER, TOTAL_WAVES, HEROES, HT } from './game/data'
import { Save } from './game/save'
import { makeSfx } from './game/sound'

const ICON: Record<HT, string> = { warrior: '⚔️', archer: '🏹', mage: '🔮' }

function HeroPick({ onPick, onExit }: { onPick: (h: HT) => void; onExit: () => void }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 p-4">
      <h2 className="text-center font-display text-3xl text-amber-300">Chọn tướng của bạn</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(HEROES) as HT[]).map((k, i) => {
          const d = HEROES[k]
          return (
            <motion.button key={k} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} whileHover={{ y: -6 }}
              onClick={() => onPick(k)} className="panel p-4 text-left" style={{ borderColor: d.color }}>
              <div className="text-5xl">{ICON[k]}</div>
              <b className="mt-2 block text-xl">{d.title} · {d.name}</b>
              <p className="mb-2 text-sm opacity-80">{d.desc}</p>
              <div className="text-xs leading-5">❤️ Máu {d.hp} · 🗡 Sát thương {d.dmg}<br />🎯 Tầm {d.range} · 👟 Tốc độ {d.speed}</div>
            </motion.button>
          )
        })}
      </div>
      <button className="btn btn-dark mx-auto" onClick={onExit}>← Quay lại</button>
    </div>
  )
}

function Battle({ save, hero, onExit }: { save: Save; hero: HT; onExit: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const game = useRef<Game | null>(null)
  const [hud, setHud] = useState<Hud | null>(null)

  useEffect(() => {
    const g = new Game(save, makeSfx(() => save.sound), hero); game.current = g
    let raf = 0, last = performance.now()
    const loop = (now: number) => {
      g.update((now - last) / 1000); last = now
      const c = cv.current
      if (c) g.draw(c.getContext('2d')!)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const iv = setInterval(() => setHud(g.hud()), 100)
    return () => { cancelAnimationFrame(raf); clearInterval(iv) }
  }, [save, hero])

  const pos = (e: React.PointerEvent) => {
    const r = cv.current!.getBoundingClientRect()
    return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)]
  }
  const g = game.current
  if (!hud || !g) return <canvas ref={cv} width={W} height={H} className="hidden" />
  const act = (f: () => void) => () => { f(); setHud(g.hud()) }
  const hd = HEROES[hud.hero.t]

  return (
    <div className="mx-auto flex min-h-screen max-w-[1100px] flex-col gap-2 p-2">
      <div className="panel flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-lg font-extrabold">
        <button className="btn btn-dark !py-1" onClick={onExit}>Menu</button>
        <span>🪙 {hud.gold}</span><span>❤️ {hud.lives}</span><span>🌊 Wave {hud.wave}/{TOTAL_WAVES}</span>
      </div>
      <div className="relative">
        <canvas ref={cv} width={W} height={H} className="w-full rounded-xl border-4 border-amber-900"
          onPointerMove={e => { const [x, y] = pos(e); g.move(x, y) }}
          onPointerDown={e => { const [x, y] = pos(e); g.move(x, y); g.click(x, y); setHud(g.hud()) }}
          onPointerLeave={() => { g.hover = null }} />
        <AnimatePresence>
          {(hud.phase === 'over' || hud.phase === 'victory') && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 grid place-items-center rounded-xl bg-black/70">
              <motion.div initial={{ scale: 0.7 }} animate={{ scale: 1 }} className="panel p-6 text-center">
                <h2 className={`font-display text-4xl ${hud.phase === 'victory' ? 'text-amber-300' : 'text-red-400'}`}>{hud.phase === 'victory' ? 'Victory!' : 'Game Over'}</h2>
                <p className="my-3">Phần thưởng: 💎 {hud.reward} tinh thể</p>
                <button className="btn" onClick={onExit}>Về menu</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn" disabled={hud.running} onClick={act(() => g.startWave())}>▶ Start Wave</button>
        <button className="btn btn-dark" onClick={act(() => g.togglePause())}>{hud.paused ? 'Resume' : 'Pause'}</button>
        <button className="btn btn-dark" onClick={act(() => g.cycleSpeed())}>⏩ x{hud.speed}</button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={act(() => g.toggleHero())} className={`panel flex items-center gap-3 p-2 text-left transition sm:w-72 ${hud.hero.sel ? 'ring-4 ring-amber-300' : ''} ${hud.hero.dead ? 'opacity-60' : ''}`}>
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg text-3xl" style={{ background: hd.color + '66' }}>{hud.hero.dead ? '🪦' : ICON[hud.hero.t]}</div>
          <div className="min-w-0 flex-1 text-xs">
            <b className="text-sm">{hd.title} · {hd.name}</b>
            <div className="my-1 h-2 overflow-hidden rounded bg-black/60"><div className="h-full bg-sky-400" style={{ width: `${(hud.hero.hp / hud.hero.max) * 100}%` }} /></div>
            <div>{hud.hero.dead ? `Hồi sinh sau ${Math.ceil(hud.hero.rt)}s` : hud.hero.sel ? 'Bấm vào bản đồ để di chuyển' : 'Bấm để điều động tướng'}</div>
          </div>
        </button>
        <div className="grid flex-1 grid-cols-5 gap-2">
          {TOWER_ORDER.map(t => {
            const d = TOWERS[t], ok = save.unlocked.includes(t)
            return (
              <button key={t} disabled={!ok} onClick={act(() => g.selectBuild(t))}
                className={`panel flex flex-col items-center p-2 text-xs transition disabled:opacity-40 ${hud.build === t ? 'ring-4 ring-amber-300' : ''} ${hud.gold < d.cost ? 'opacity-70' : ''}`}>
                <span className="mb-1 h-6 w-6 rounded-full border-2 border-white/70" style={{ background: d.color }} />
                <b className="leading-tight">{d.name.replace(' Tower', '')}</b>
                <span>{ok ? `🪙 ${d.cost}` : '🔒 Khóa'}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="panel min-h-[86px] p-3 text-sm">
        {hud.sel ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <b className="text-base">{TOWERS[hud.sel.t].name} – Cấp {hud.sel.lv}/3</b>
              <div>Sát thương {hud.sel.dmg.toFixed(0)} · Tầm bắn {hud.sel.range} · Tốc độ {hud.sel.rate.toFixed(1)}/s</div>
              <div className="opacity-70">{TOWERS[hud.sel.t].desc}</div>
            </div>
            <div className="flex gap-2">
              {hud.sel.upCost !== null && <button className="btn" disabled={hud.gold < hud.sel.upCost} onClick={act(() => g.upgrade())}>Nâng cấp 🪙{hud.sel.upCost}</button>}
              <button className="btn btn-dark" onClick={act(() => g.sell())}>Bán 🪙{hud.sel.sell}</button>
            </div>
          </div>
        ) : hud.build ? <div><b>{TOWERS[hud.build].name}</b> – {TOWERS[hud.build].desc} Nhấn vào ô cỏ trống để xây.</div>
          : <div className="opacity-80">Chọn tháp để xây, nhấn vào tháp để nâng cấp. Nhấn vào tướng (hoặc thẻ tướng) rồi nhấn vị trí trên bản đồ để điều động. Quái chạm vào tướng sẽ dừng lại đánh nhau.</div>}
      </div>
    </div>
  )
}

export default function GameScreen({ save, onExit }: { save: Save; onExit: () => void }) {
  const [hero, setHero] = useState<HT | null>(null)
  if (!hero) return <HeroPick onPick={setHero} onExit={onExit} />
  return <Battle save={save} hero={hero} onExit={onExit} />
}
