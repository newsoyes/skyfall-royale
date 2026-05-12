import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'

const BASE_SENS = 0.0022
const SENS_MIN = 0.1
const SENS_MAX = 5.0
const SENS_KEY = 'skyfall_mouse_sensitivity'

/** Clamp sensitivity to [0.1, 5.0] */
function clampSensitivity(v: number): number {
  return Math.max(SENS_MIN, Math.min(SENS_MAX, v))
}

/** Load mouse sensitivity from localStorage. Falls back to 1.0 on invalid/missing value. */
export function loadSensitivity(): number {
  try {
    const raw = localStorage.getItem(SENS_KEY)
    if (raw === null) return 1.0
    const parsed = parseFloat(raw)
    if (!isFinite(parsed)) return 1.0
    return clampSensitivity(parsed)
  } catch {
    return 1.0
  }
}

/** Save mouse sensitivity to localStorage (clamped). */
export function saveSensitivity(v: number): void {
  try {
    const clamped = clampSensitivity(v)
    localStorage.setItem(SENS_KEY, String(clamped))
  } catch {
    // ignore storage errors
  }
}

/** Keyboard + pointer-lock look; writes `window.__lastInput` for the network tick. */
export function InputControls({ active }: { active: boolean }) {
  const keys = useRef<Record<string, boolean>>({})
  const userSensitivity = useRef<number>(loadSensitivity())
  const { gl } = useThree()

  // Expose sensitivity ref via window so SensitivityPanel can update it without prop drilling
  useEffect(() => {
    window.__sensitivity = userSensitivity
  }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true
      if (e.code === 'Space') e.preventDefault()
    }
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  useEffect(() => {
    if (!active) return
    const canvas = gl.domElement
    const onClick = () => {
      void canvas.requestPointerLock()
    }
    canvas.addEventListener('click', onClick)
    return () => canvas.removeEventListener('click', onClick)
  }, [active, gl])

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement) return
      window.__lastInput.yaw -= e.movementX * BASE_SENS * userSensitivity.current
      window.__lastInput.pitch -= e.movementY * BASE_SENS * userSensitivity.current
      window.__lastInput.pitch = Math.max(-1.45, Math.min(1.45, window.__lastInput.pitch))
    }
    window.addEventListener('mousemove', onMouse)
    return () => window.removeEventListener('mousemove', onMouse)
  }, [gl])

  useEffect(() => {
    if (!active) return
    let raf = 0
    const loop = () => {
      const k = keys.current
      let fwd = 0
      let str = 0
      if (k.KeyW || k.ArrowUp) fwd += 1
      if (k.KeyS || k.ArrowDown) fwd -= 1
      if (k.KeyD || k.ArrowRight) str += 1
      if (k.KeyA || k.ArrowLeft) str -= 1
      window.__lastInput.fwd = fwd
      window.__lastInput.str = str
      window.__lastInput.jump = !!k.Space
      window.__lastInput.sprint = !!(k.ShiftLeft || k.ShiftRight)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [active])

  return null
}
