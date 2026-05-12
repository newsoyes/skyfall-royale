/**
 * Procedural audio engine — ไม่ใช้ไฟล์เสียงภายนอก
 * ใช้ Web Audio API สร้างเสียงทุกอย่างแบบ synthesis
 */

const ctx = typeof window !== 'undefined' ? new AudioContext() : null

// ── Master gain ───────────────────────────────────────────────────────────────
const master = ctx ? ctx.createGain() : null
if (master && ctx) {
  master.gain.value = 0.7
  master.connect(ctx.destination)
}

function out() { return master ?? ctx?.destination ?? null }

// ── Utility ───────────────────────────────────────────────────────────────────

function osc(freq: number, type: OscillatorType, startTime: number, endTime: number, gainVal: number, freqEnd?: number) {
  if (!ctx || !out()) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, startTime)
  if (freqEnd !== undefined) o.frequency.exponentialRampToValueAtTime(freqEnd, endTime)
  g.gain.setValueAtTime(gainVal, startTime)
  g.gain.exponentialRampToValueAtTime(0.0001, endTime)
  o.connect(g)
  g.connect(out()!)
  o.start(startTime)
  o.stop(endTime + 0.01)
}

function noise(dur: number, gainVal: number, filterFreq = 2000, startTime?: number) {
  if (!ctx || !out()) return
  const t = startTime ?? ctx.currentTime
  const bufSize = Math.floor(ctx.sampleRate * dur)
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buf
  const filt = ctx.createBiquadFilter()
  filt.type = 'bandpass'
  filt.frequency.value = filterFreq
  filt.Q.value = 0.8
  const g = ctx.createGain()
  g.gain.setValueAtTime(gainVal, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(filt)
  filt.connect(g)
  g.connect(out()!)
  src.start(t)
  src.stop(t + dur)
}

// ── Sound effects ─────────────────────────────────────────────────────────────

export const sounds = {
  uiClick() {
    if (!ctx) return
    const t = ctx.currentTime
    osc(800, 'sine', t, t + 0.06, 0.04, 600)
  },

  weaponSwitch() {
    if (!ctx) return
    const t = ctx.currentTime
    osc(300, 'triangle', t, t + 0.04, 0.03, 500)
    osc(500, 'triangle', t + 0.03, t + 0.07, 0.02, 700)
  },

  footstep() {
    if (!ctx) return
    const t = ctx.currentTime
    noise(0.04, 0.025 + Math.random() * 0.01, 150 + Math.random() * 80)
    osc(60 + Math.random() * 20, 'sine', t, t + 0.04, 0.015)
  },

  shoot(w: string) {
    if (!ctx) return
    const t = ctx.currentTime
    if (w === 'pistol') {
      // เสียงปืนพก — crack สั้นๆ
      noise(0.06, 0.18, 1200)
      osc(180, 'sawtooth', t, t + 0.08, 0.12, 60)
      osc(400, 'square', t, t + 0.04, 0.06, 80)
    } else if (w === 'ar') {
      // เสียง AR — ดังกว่า มี body
      noise(0.07, 0.22, 1500)
      osc(140, 'sawtooth', t, t + 0.09, 0.15, 50)
      osc(600, 'square', t, t + 0.03, 0.08, 100)
    } else if (w === 'smg') {
      // เสียง SMG — เบากว่า AR
      noise(0.05, 0.14, 1800)
      osc(200, 'sawtooth', t, t + 0.06, 0.1, 80)
    } else if (w === 'shotgun') {
      // เสียงลูกซอง — ดังมาก กระจาย
      noise(0.12, 0.35, 800)
      osc(100, 'sawtooth', t, t + 0.15, 0.2, 30)
      osc(300, 'square', t, t + 0.06, 0.1, 60)
      noise(0.08, 0.15, 3000, t + 0.02)
    } else if (w === 'sniper') {
      // เสียงซุ่มยิง — ดังมาก crack ยาว
      noise(0.1, 0.28, 2500)
      osc(120, 'sawtooth', t, t + 0.18, 0.22, 40)
      osc(800, 'sine', t, t + 0.05, 0.08, 200)
    } else if (w === 'rpg') {
      // เสียง RPG — ดังมาก bass หนัก
      noise(0.15, 0.3, 400)
      osc(60, 'sawtooth', t, t + 0.25, 0.3, 20)
      osc(200, 'square', t, t + 0.1, 0.15, 40)
    }
  },

  hitmarker() {
    if (!ctx) return
    const t = ctx.currentTime
    osc(1200, 'square', t, t + 0.04, 0.04, 900)
    osc(900, 'square', t + 0.02, t + 0.06, 0.03, 700)
  },

  headshotMarker() {
    if (!ctx) return
    const t = ctx.currentTime
    osc(1600, 'sine', t, t + 0.06, 0.06, 1200)
    osc(800, 'sine', t + 0.03, t + 0.09, 0.04, 600)
  },

  reload(w?: string) {
    if (!ctx) return
    const t = ctx.currentTime
    if (w === 'shotgun') {
      // เสียงปั๊มลูกซอง
      osc(180, 'sawtooth', t, t + 0.06, 0.06, 120)
      osc(300, 'triangle', t + 0.08, t + 0.14, 0.04, 200)
    } else if (w === 'sniper') {
      // เสียงบรรจุกระสุนซุ่มยิง
      osc(220, 'sine', t, t + 0.1, 0.05, 180)
      osc(440, 'triangle', t + 0.12, t + 0.2, 0.04, 350)
    } else {
      // เสียง mag click ทั่วไป
      osc(250, 'triangle', t, t + 0.06, 0.05, 180)
      noise(0.04, 0.04, 600, t + 0.05)
      osc(350, 'sine', t + 0.1, t + 0.16, 0.04, 280)
    }
  },

  reloadDone() {
    if (!ctx) return
    const t = ctx.currentTime
    osc(500, 'sine', t, t + 0.05, 0.04, 600)
    osc(700, 'sine', t + 0.04, t + 0.09, 0.03, 800)
  },

  explosion() {
    if (!ctx || !out()) return
    const t = ctx.currentTime
    // Low boom
    osc(60, 'sawtooth', t, t + 0.5, 0.35, 20)
    osc(120, 'square', t, t + 0.3, 0.2, 30)
    // Crack
    noise(0.2, 0.4, 600)
    noise(0.15, 0.25, 2000, t + 0.05)
    // Sub bass
    osc(40, 'sine', t, t + 0.6, 0.3, 15)
  },

  killAnnouncement() {
    if (!ctx) return
    const t = ctx.currentTime
    osc(600, 'sine', t, t + 0.08, 0.06, 800)
    osc(900, 'sine', t + 0.06, t + 0.14, 0.05, 1100)
    osc(1200, 'sine', t + 0.12, t + 0.2, 0.04, 1400)
  },

  doubleKill() {
    if (!ctx) return
    const t = ctx.currentTime
    osc(500, 'sine', t, t + 0.07, 0.06, 700)
    osc(700, 'sine', t + 0.05, t + 0.12, 0.06, 900)
    osc(900, 'sine', t + 0.1, t + 0.17, 0.05, 1100)
    osc(1100, 'sine', t + 0.15, t + 0.22, 0.04, 1300)
  },

  pickup() {
    if (!ctx) return
    const t = ctx.currentTime
    osc(400, 'sine', t, t + 0.06, 0.04, 600)
    osc(600, 'sine', t + 0.05, t + 0.11, 0.04, 800)
    osc(800, 'sine', t + 0.1, t + 0.16, 0.03, 1000)
  },

  downed() {
    if (!ctx) return
    const t = ctx.currentTime
    // เสียงล้มลง — ต่ำลงเรื่อยๆ
    osc(300, 'sawtooth', t, t + 0.4, 0.1, 80)
    noise(0.25, 0.08, 300)
    osc(150, 'sine', t + 0.1, t + 0.5, 0.06, 50)
  },

  revived() {
    if (!ctx) return
    const t = ctx.currentTime
    // เสียงฟื้นคืน — สูงขึ้น
    osc(400, 'sine', t, t + 0.12, 0.05, 700)
    osc(600, 'sine', t + 0.1, t + 0.22, 0.05, 900)
    osc(900, 'sine', t + 0.2, t + 0.32, 0.04, 1100)
  },

  /** เสียงกระสุนโดนวัสดุต่างๆ */
  hitMaterial(mat: 'flesh' | 'rock' | 'wood' | 'metal') {
    if (!ctx) return
    const t = ctx.currentTime
    if (mat === 'flesh') {
      // เสียงโดนคน — นุ่ม มี thud
      noise(0.04, 0.12, 500)
      osc(120, 'sine', t, t + 0.06, 0.06, 80)
    } else if (mat === 'rock') {
      // เสียงโดนหิน — แข็ง กระเด็น
      noise(0.05, 0.18, 3500)
      osc(800, 'square', t, t + 0.03, 0.05, 400)
      noise(0.03, 0.08, 6000, t + 0.02)
    } else if (mat === 'wood') {
      // เสียงโดนไม้ — ทึบ
      noise(0.06, 0.14, 800)
      osc(200, 'sawtooth', t, t + 0.05, 0.06, 100)
      osc(400, 'triangle', t, t + 0.04, 0.04, 200)
    } else if (mat === 'metal') {
      // เสียงโดนโลหะ — กังวาน
      noise(0.04, 0.1, 2000)
      osc(1200, 'sine', t, t + 0.08, 0.05, 600)
      osc(600, 'sine', t + 0.02, t + 0.12, 0.04, 300)
    }
  },

  ambientWind() {
    if (!ctx || !out()) return
    noise(2.0, 0.015, 300)
  },
}

export function resumeAudio() {
  void ctx?.resume()
}

export function startAmbientPad() {
  if (!ctx || !out()) return () => {}
  const padGain = ctx.createGain()
  padGain.gain.value = 0.008
  padGain.connect(out()!)
  const oscs = [110, 165, 220, 330].map((f, i) => {
    const o = ctx!.createOscillator()
    o.type = 'sine'
    o.frequency.value = f + i * 0.3  // slight detune
    o.connect(padGain)
    o.start()
    return o
  })
  return () => {
    oscs.forEach((o) => { try { o.stop() } catch { /* ignore */ } })
    padGain.disconnect()
  }
}

export function tryFootstep(prevAt: number, speed: number, grounded: boolean) {
  if (!grounded || speed < 2.2) return prevAt
  const now = performance.now()
  const interval = speed > 9 ? 220 : 300
  if (now - prevAt > interval) {
    sounds.footstep()
    return now
  }
  return prevAt
}
