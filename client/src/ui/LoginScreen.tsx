import { useState } from 'react'
import { getSocket } from '../net/clientSocket'
import { useSession } from '../store/session'
import { sounds } from '../audio/procedural'

export function LoginScreen() {
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const setUsername = useSession((s) => s.setUsername)
  const setUiPhase = useSession((s) => s.setUiPhase)

  const submit = () => {
    sounds.uiClick()
    const sock = getSocket()
    sock.emit('auth:guest', { username: name.trim() }, (res: { ok?: boolean; username?: string; error?: string }) => {
      if (res?.ok && res.username) {
        setUsername(res.username)
        setUiPhase('lobby')
      } else {
        setErr(res?.error || 'เข้าสู่ระบบล้มเหลว')
      }
    })
  }

  return (
    <div className="flex h-full flex-col items-center justify-center bg-gradient-to-b from-indigo-950 via-slate-950 to-slate-900 px-6">
      <div className="mb-10 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight text-white drop-shadow-lg">Skyfall Royale</h1>
        <p className="mt-3 text-lg text-indigo-200/90">แบทเทิลรอยัล · เบราว์เซอร์ · มุมมองบุคคลที่สาม · หลายผู้เล่น</p>
      </div>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
        <label className="block text-sm font-semibold text-indigo-100">ชื่อผู้เล่น</label>
        <input
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none ring-0 placeholder:text-slate-500 focus:border-indigo-400"
          placeholder="ใส่ชื่อผู้เล่น"
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        {err && <p className="mt-3 text-sm text-rose-400">{err}</p>}
        <button
          type="button"
          className="mt-6 w-full rounded-xl bg-indigo-500 py-3 font-bold text-white shadow-lg transition hover:bg-indigo-400"
          onClick={submit}
        >
          เข้าเล่นแบบผู้เยี่ยมชม
        </button>
      </div>
    </div>
  )
}
