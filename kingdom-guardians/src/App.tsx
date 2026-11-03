import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import GameScreen from './GameScreen'
import { Save, load, store, defaultSave, UPGRADES, UNLOCKS } from './game/save'
import { TOWERS, TT } from './game/data'

type Screen = 'menu' | 'game' | 'shop' | 'settings' | 'how'
const page = { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -24 }, transition: { duration: 0.25 } }

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [save, setSave] = useState<Save>(load)
  const [run, setRun] = useState(0)
  const commit = (s: Save) => { store(s); setSave({ ...s }) }
  const back = <button className="btn btn-dark mb-4" onClick={() => setScreen('menu')}>← Quay lại</button>

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,#2f6b3a,#14231a_70%)]">
      <AnimatePresence mode="wait">
        {screen === 'menu' && (
          <motion.div key="menu" {...page} className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
            <h1 className="font-display text-5xl font-black text-amber-300 drop-shadow-[0_4px_0_#78350f]">Kingdom Guardians</h1>
            <p className="mb-4 opacity-80">Bảo vệ vương quốc khỏi bầy quái vật. 💎 {save.crystals} tinh thể</p>
            <button className="btn w-full text-xl" onClick={() => { setRun(r => r + 1); setScreen('game') }}>Play</button>
            <button className="btn btn-dark w-full" onClick={() => setScreen('shop')}>Upgrade</button>
            <button className="btn btn-dark w-full" onClick={() => setScreen('settings')}>Settings</button>
            <button className="btn btn-dark w-full" onClick={() => setScreen('how')}>How to Play</button>
          </motion.div>
        )}
        {screen === 'game' && <motion.div key={'game' + run} {...page}><GameScreen save={save} onExit={() => { setSave({ ...save }); setScreen('menu') }} /></motion.div>}
        {screen === 'shop' && (
          <motion.div key="shop" {...page} className="mx-auto max-w-2xl p-4">
            {back}
            <h2 className="mb-1 font-display text-3xl text-amber-300">Upgrade Shop</h2>
            <p className="mb-4">💎 {save.crystals} tinh thể</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {UPGRADES.map(u => {
                const lv = save.up[u.id], cost = u.base * (lv + 1), maxed = lv >= u.max
                return (
                  <div key={u.id} className="panel p-3">
                    <b>{u.name}</b> <span className="opacity-70">Cấp {lv}/{u.max}</span>
                    <div className="mb-2 text-sm opacity-80">{u.desc}</div>
                    <button className="btn w-full" disabled={maxed || save.crystals < cost}
                      onClick={() => commit({ ...save, crystals: save.crystals - cost, up: { ...save.up, [u.id]: lv + 1 } })}>
                      {maxed ? 'Tối đa' : `Nâng cấp 💎${cost}`}
                    </button>
                  </div>
                )
              })}
              {(Object.keys(UNLOCKS) as TT[]).map(t => {
                const owned = save.unlocked.includes(t), cost = UNLOCKS[t]!
                return (
                  <div key={t} className="panel p-3">
                    <b>{TOWERS[t].name}</b>
                    <div className="mb-2 text-sm opacity-80">{TOWERS[t].desc}</div>
                    <button className="btn w-full" disabled={owned || save.crystals < cost}
                      onClick={() => commit({ ...save, crystals: save.crystals - cost, unlocked: [...save.unlocked, t] })}>
                      {owned ? 'Đã mở khóa' : `Mở khóa 💎${cost}`}
                    </button>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
        {screen === 'settings' && (
          <motion.div key="set" {...page} className="mx-auto max-w-md p-4">
            {back}
            <h2 className="mb-4 font-display text-3xl text-amber-300">Settings</h2>
            <div className="panel mb-3 flex items-center justify-between p-3">
              <span>Âm thanh</span>
              <button className="btn" onClick={() => commit({ ...save, sound: !save.sound })}>{save.sound ? 'Bật' : 'Tắt'}</button>
            </div>
            <div className="panel flex items-center justify-between p-3">
              <span>Xóa toàn bộ tiến trình</span>
              <button className="btn btn-dark" onClick={() => { if (confirm('Xóa tiến trình?')) commit(defaultSave()) }}>Xóa</button>
            </div>
            <p className="mt-4 text-sm opacity-70">Kỷ lục: {save.best}/20 wave</p>
          </motion.div>
        )}
        {screen === 'how' && (
          <motion.div key="how" {...page} className="mx-auto max-w-xl p-4">
            {back}
            <h2 className="mb-3 font-display text-3xl text-amber-300">How to Play</h2>
            <ul className="panel list-disc space-y-2 p-4 pl-8">
              <li>Chọn tháp ở thanh dưới, nhấn vào ô cỏ trống để xây (không xây được trên đường, nước, cây).</li>
              <li>Nhấn vào tháp đã xây để xem thông số, nâng cấp (tối đa cấp 3) hoặc bán (hoàn 70%).</li>
              <li>Nhấn <b>Start Wave</b> để gọi đợt quái. Dùng Pause và Fast Forward (x1/x2/x3) khi cần.</li>
              <li>Quái chạm lâu đài sẽ làm mất mạng (Boss mất 5). Hết mạng là thua, vượt 20 wave là thắng.</li>
              <li>Sau mỗi ván bạn nhận 💎 tinh thể để mua nâng cấp vĩnh viễn trong Upgrade Shop.</li>
              <li>Archer nhanh · Cannon nổ diện rộng · Mage xuyên giáp · Ice làm chậm · Lightning lan nhiều mục tiêu.</li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
