import { NetworkLayer } from './net/NetworkLayer'
import { LoginScreen } from './ui/LoginScreen'
import { LobbyScreen } from './ui/LobbyScreen'
import { WaitingRoom } from './ui/WaitingRoom'
import { GameCanvas } from './game/GameCanvas'
import { Hud } from './ui/Hud'
import { EndScreen } from './ui/EndScreen'
import { InventoryUI } from './ui/InventoryUI'
import { WeaponBar } from './ui/WeaponBar'
import { useSession } from './store/session'

export default function App() {
  const uiPhase = useSession((s) => s.uiPhase)

  return (
    <div className="relative h-full w-full font-display">
      <NetworkLayer />

      {uiPhase === 'login' && <LoginScreen />}
      {uiPhase === 'lobby' && <LobbyScreen />}
      {uiPhase === 'waiting' && <WaitingRoom />}
      {uiPhase === 'playing' && (
        <>
          <GameCanvas />
          <Hud />
          <WeaponBar />
          <InventoryUI />
        </>
      )}
      {uiPhase === 'ended' && <EndScreen />}
    </div>
  )
}
