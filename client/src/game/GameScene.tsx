import { Sky } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { TerrainIsland } from './TerrainIsland'
import { InstancedTrees, InstancedRocks, Ruins } from './InstancedNature'
import { ThirdPersonCamera } from './ThirdPersonCamera'
import { WorldPlayers } from './WorldPlayers'
import { ZoneRing } from './ZoneRing'
import { StormWall } from './StormWall'
import { PickupMeshes } from './PickupMeshes'
import { ProjectileMeshes } from './ProjectileMeshes'
import { VehicleMeshes } from './VehicleMeshes'
import { SmokeMeshes } from './SmokeMeshes'
import { Tracers } from './Tracers'
import { InputControls } from './InputControls'
import { CombatController } from './CombatController'
import { GameFxLoop } from './GameFxLoop'
import { DamageNumbers } from './DamageNumbers'
import { getActiveMap } from './terrain'

export function GameScene() {
  const map = getActiveMap()

  return (
    <>
      <ambientLight intensity={map.style.ambientIntensity} />
      <directionalLight castShadow position={map.style.sunPosition} intensity={1.35} />
      <Sky sunPosition={map.style.sunPosition} turbidity={4} mieCoefficient={0.005} />
      <color attach="background" args={[map.skyColor]} />
      <fog attach="fog" args={[map.fogColor, 80, 500]} />
      <TerrainIsland />
      <InstancedTrees />
      <InstancedRocks />
      <Ruins />
      <ZoneRing />
      <StormWall />
      <PickupMeshes />
      <ProjectileMeshes />
      <VehicleMeshes />
      <SmokeMeshes />
      <WorldPlayers />
      <Tracers />
      <DamageNumbers />
      <ThirdPersonCamera />
      <InputControls active />
      <CombatController active />
      <GameFxLoop />

      <EffectComposer multisampling={0}>
        <Bloom luminanceThreshold={0.92} intensity={0.22} mipmapBlur={false} />
      </EffectComposer>
    </>
  )
}
