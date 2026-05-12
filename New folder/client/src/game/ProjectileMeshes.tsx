import { useGame } from '../store/game'
import { NO_PROJECTILES } from './emptyRefs'

export function ProjectileMeshes() {
  const projectiles = useGame((s) => s.snapshot?.projectiles ?? NO_PROJECTILES)
  return (
    <group>
      {projectiles.map((pr) => (
        <mesh key={pr.id} position={[pr.x, pr.y, pr.z]} castShadow>
          <sphereGeometry args={[0.35, 12, 12]} />
          <meshStandardMaterial color="#ffb020" emissive="#ff6b35" emissiveIntensity={0.8} />
        </mesh>
      ))}
    </group>
  )
}
