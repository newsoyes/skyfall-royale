import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { GameScene } from './GameScene'
import { GameBindings } from './GameBindings'

/** Full-screen WebGL view — only mounted while `uiPhase === 'playing'`. */
export function GameCanvas() {
  return (
    <div className="absolute inset-0">
      <GameBindings />
      <Canvas
        shadows
        dpr={[1, 1.25]}
        gl={{ powerPreference: 'high-performance', antialias: true, stencil: false }}
        camera={{ fov: 72, near: 0.25, far: 650 }}
      >
        <Suspense fallback={null}>
          <GameScene />
        </Suspense>
      </Canvas>
    </div>
  )
}
