let ctx: AudioContext | null = null
const P: Record<string, [number, number, OscillatorType, number]> = {
  archer: [700, 0.04, 'triangle', 0.03], cannon: [90, 0.18, 'sawtooth', 0.08], mage: [520, 0.12, 'sine', 0.05], ice: [900, 0.1, 'sine', 0.04],
  lightning: [200, 0.12, 'square', 0.04], die: [300, 0.12, 'square', 0.04], build: [440, 0.12, 'triangle', 0.06], coin: [880, 0.12, 'sine', 0.05],
  no: [120, 0.15, 'square', 0.05], hurt: [150, 0.3, 'sawtooth', 0.08], wave: [330, 0.4, 'triangle', 0.07], win: [660, 0.8, 'triangle', 0.08], lose: [100, 0.8, 'sawtooth', 0.08],
}
export function makeSfx(enabled: () => boolean) {
  return (n: string) => {
    if (!enabled() || !P[n]) return
    try {
      ctx ??= new AudioContext(); const [f, d, type, v] = P[n], o = ctx.createOscillator(), g = ctx.createGain()
      o.type = type; o.frequency.setValueAtTime(f, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(f * 0.6, ctx.currentTime + d)
      g.gain.setValueAtTime(v, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d)
      o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + d)
    } catch { /* ignore */ }
  }
}
