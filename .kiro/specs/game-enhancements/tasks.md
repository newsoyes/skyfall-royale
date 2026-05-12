# Implementation Plan: Game Enhancements

## Overview

แผนการ implement ฟีเจอร์ 8 ด้านสำหรับ Skyfall Royale โดยแบ่งเป็น 3 กลุ่ม:
- **Client-only**: Mouse Sensitivity, Player NameTag, Team Color, Death Spectate Hint, Damage Dealt UI, Screen Blood Vignette
- **Client + Server**: Ghost Mode After Death
- **Already structured, needs wiring**: Multiple Maps

ทุก task ใช้ TypeScript และ React Three Fiber ตามโครงสร้างที่มีอยู่

---

## Tasks

- [x] 1. เพิ่ม `isGhost` และ `shooterId`/`targetId` ใน protocol types (server + client)
  - [x] 1.1 เพิ่ม `isGhost: boolean` ใน `PlayerState` interface ใน `server/src/types.ts`
    - เพิ่ม field `isGhost: boolean` ต่อจาก `consumables`
    - _Requirements: 8.10_
  - [x] 1.2 เพิ่ม `shooterId`, `targetId`, `targetUsername` ใน `DamageNumber` interface ใน `server/src/types.ts`
    - เพิ่ม 3 fields ใหม่ใน `DamageNumber` interface
    - _Requirements: 6.5_
  - [x] 1.3 sync `PlayerState` และ `DamageNumber` ใน `client/src/types/protocol.ts` ให้ตรงกับ server
    - เพิ่ม `isGhost: boolean` ใน `PlayerState`
    - เพิ่ม `shooterId`, `targetId`, `targetUsername` ใน `DamageNumber`
    - _Requirements: 8.10, 6.5_

- [x] 2. อัปเดต server `GameRoom.ts` สำหรับ Ghost Mode และ DamageNumber fields
  - [x] 2.1 เพิ่ม `isGhost` ใน `InternalPlayer` type และ initialize ใน `addPlayer` / `beginMatch`
    - เพิ่ม `isGhost: boolean` ใน `InternalPlayer` type definition
    - set `isGhost = false` ใน `addPlayer` และ `beginMatch`
    - _Requirements: 8.10_
  - [x] 2.2 set `isGhost = true` เมื่อ player ตายและไม่ได้ spectate ใน `damagePlayer`
    - หลัง `target.alive = false` ให้ set `target.isGhost = true` เมื่อ `target.spectatingId === null`
    - _Requirements: 8.1_
  - [x] 2.3 handle `game:ghostMove` socket event เพื่ออัปเดต ghost position
    - รับ `{ x, y, z, yaw, pitch }` จาก client
    - validate ว่า player มี `alive === false` ก่อน apply
    - clamp position ด้วย `clampToMap`
    - _Requirements: 8.6_
  - [x] 2.4 broadcast `isGhost` ใน snapshot และเพิ่ม `shooterId`/`targetId`/`targetUsername` ใน `DamageNumber` ที่ server สร้าง
    - ใน `snapshot()` method: include `isGhost` ใน player state ที่ส่งออก
    - ใน logic ที่สร้าง `DamageNumber`: เพิ่ม `shooterId`, `targetId`, `targetUsername`
    - _Requirements: 8.6, 6.5_

- [ ] 3. Checkpoint — ตรวจสอบ server types และ ghost logic
  - Ensure all tests pass, ask the user if questions arise.

- [-] 4. Mouse Sensitivity Setting
  - [ ] 4.1 สร้าง utility functions `loadSensitivity` และ `saveSensitivity` ใน `client/src/game/InputControls.tsx`
    - `loadSensitivity()`: อ่านจาก `localStorage` key `skyfall_mouse_sensitivity`, parse เป็น number, clamp ไว้ใน [0.1, 5.0], fallback 1.0 เมื่อ invalid หรือ exception
    - `saveSensitivity(v)`: บันทึกลง localStorage, clamp ก่อนบันทึก
    - _Requirements: 1.1, 1.3, 1.4_
  - [ ]* 4.2 Write property test for sensitivity clamping (Property 1)
    - **Property 1: Sensitivity clamping**
    - **Validates: Requirements 1.1, 1.4**
  - [ ]* 4.3 Write property test for sensitivity delta computation (Property 2)
    - **Property 2: Sensitivity delta computation**
    - **Validates: Requirements 1.2, 1.7**
  - [ ]* 4.4 Write property test for sensitivity localStorage round-trip (Property 3)
    - **Property 3: Sensitivity localStorage round-trip**
    - **Validates: Requirements 1.3**
  - [ ] 4.5 แก้ `InputControls.tsx` ให้ใช้ `userSensitivity` คูณ delta ใน mousemove handler
    - อ่าน sensitivity ด้วย `loadSensitivity()` เมื่อ component mount
    - แก้ `onMouse`: `yaw -= movementX * sens * userSensitivity`
    - เก็บ sensitivity ใน `useRef` เพื่อให้ update ได้ real-time
    - _Requirements: 1.2, 1.7_
  - [ ] 4.6 สร้าง `SensitivityPanel` component ใน `client/src/ui/Hud.tsx`
    - เพิ่ม settings button (⚙️) ที่มุมบนขวาของ HUD
    - `SensitivityPanel`: slider range [0.1, 5.0], step 0.1, แสดงค่าปัจจุบัน
    - เมื่อ slider เปลี่ยน: call `saveSensitivity` และ update ref ใน InputControls
    - ใช้ `useState` สำหรับ panel open/close state
    - _Requirements: 1.5, 1.6_

- [ ] 5. Player NameTag Above Head
  - [ ] 5.1 เพิ่ม `<Html>` NameTag ใน `WorldPlayers.tsx` ใน `buildPlayerObject`
    - import `Html` จาก `@react-three/drei`
    - สร้าง NameTag element ใน `buildPlayerObject` ที่ position `y = 1.92`
    - เก็บ ref ไว้ใน `root.userData.nameTagEl` เพื่อ update ใน `useFrame`
    - _Requirements: 2.1, 2.2_
  - [ ] 5.2 สร้าง helper `getNameTagColor(p, playerId, teamMode)` และ logic ซ่อน/แสดง NameTag ตาม distance และ relationship
    - ซ่อน NameTag เมื่อ `p.id === playerId` (self)
    - ซ่อนเมื่อ distance > 80 units
    - สี `#60a5fa` สำหรับ teammate, `#fb7185` สำหรับ enemy/solo
    - อัปเดตใน `useFrame` loop
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_
  - [ ]* 5.3 Write property test for NameTag visibility by distance (Property 4)
    - **Property 4: NameTag visibility by distance**
    - **Validates: Requirements 2.3**
  - [ ]* 5.4 Write property test for NameTag color by relationship (Property 5)
    - **Property 5: NameTag color by relationship**
    - **Validates: Requirements 2.4, 2.5, 2.6, 2.8**

- [ ] 6. Team Color — Blue for Teammates
  - [ ] 6.1 เพิ่ม `matTeammate` material และ `getTorsoMaterial` helper ใน `WorldPlayers.tsx`
    - เพิ่ม `const matTeammate = new THREE.MeshStandardMaterial({ color: '#3b82f6', roughness: 0.45 })`
    - สร้าง `getTorsoMaterial(p, playerId, myTeamId, teamMode)` function
    - อัปเดต torso material ใน `useFrame` เมื่อ teamId หรือ teamMode เปลี่ยน
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [ ]* 6.2 Write property test for torso material color by relationship (Property 6)
    - **Property 6: Torso material color by relationship**
    - **Validates: Requirements 3.1, 3.2, 3.3**
  - [ ] 6.3 แก้ `MinimapDots` ใน `Hud.tsx` ให้ใช้สีทีม
    - รับ `teamMode` และ `myTeamId` เป็น props
    - dot สี `#60a5fa` สำหรับ teammate, `#fb7185` สำหรับ enemy
    - _Requirements: 3.5_
  - [ ]* 6.4 Write property test for minimap dot color by relationship (Property 7)
    - **Property 7: Minimap dot color by relationship**
    - **Validates: Requirements 3.5**

- [ ] 7. Checkpoint — ตรวจสอบ NameTag, Team Color, Sensitivity
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Multiple Maps — WaitingRoom display
  - [ ] 8.1 แก้ `client/src/ui/WaitingRoom.tsx` ให้แสดง `nameTH` และ `descTH` ของแมพปัจจุบัน
    - อ่าน `room.mapId` จาก session store
    - import `getMap` จาก `client/src/game/maps/mapRegistry`
    - แสดง `map.nameTH` และ `map.descTH` ใน WaitingRoom UI
    - _Requirements: 4.4_
  - [ ]* 8.2 Write property test for map registry completeness (Property 8)
    - **Property 8: Map registry completeness**
    - **Validates: Requirements 4.1**
  - [ ]* 8.3 Write property test for map round-trip via setActiveMap (Property 9)
    - **Property 9: Map round-trip via setActiveMap**
    - **Validates: Requirements 4.3, 4.5**
  - [ ]* 8.4 Write property test for WaitingRoom displays correct map info (Property 10)
    - **Property 10: WaitingRoom displays correct map info**
    - **Validates: Requirements 4.4**

- [ ] 9. Death Spectate Hint
  - [ ] 9.1 Refactor overlay "คุณถูกกำจัด" ใน `Hud.tsx` เป็น `SpectateHint` component
    - สร้าง `SpectateHint` component ภายใน `Hud.tsx`
    - แสดงเมื่อ `me && !me.alive && snapshot.remaining > 0`
    - ข้อความ: `spectatingId` non-null → "กด [Space] เพื่อเปลี่ยนเป้าหมาย", null → "กด [Space] เพื่อดูผู้เล่นอื่น"
    - ซ่อนเมื่อ `snapshot.remaining === 0`
    - ใช้ semi-transparent dark background panel
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  - [ ]* 9.2 Write property test for SpectateHint visibility (Property 11)
    - **Property 11: SpectateHint visibility**
    - **Validates: Requirements 5.1, 5.4, 5.5**
  - [ ]* 9.3 Write property test for SpectateHint text by spectatingId (Property 12)
    - **Property 12: SpectateHint text by spectatingId**
    - **Validates: Requirements 5.2, 5.3**

- [ ] 10. Damage Dealt UI / Hit Log Panel
  - [ ] 10.1 เพิ่ม `hitLog` slice ใน `client/src/store/game.ts`
    - เพิ่ม type `HitLogEntry { targetId, targetUsername, damage, isHead, at }`
    - เพิ่ม `hitLog: HitLogEntry[]`, `appendHit`, `resetHitLog` ใน `GameSlice`
    - cap hitLog ที่ 200 entries
    - _Requirements: 6.5, 6.6_
  - [ ] 10.2 populate `hitLog` จาก `damageNumbers` ใน snapshot ใน `NetworkLayer.tsx`
    - ใน `onState` handler: filter `damageNumbers` ที่ `shooterId === playerId`
    - call `appendHit` สำหรับแต่ละ entry ที่ตรงเงื่อนไข
    - reset hitLog เมื่อ match เริ่มใหม่ (`match:start` event)
    - _Requirements: 6.5, 6.6_
  - [ ] 10.3 สร้าง `DamageLogPanel` component ใน `Hud.tsx`
    - แสดงเมื่อ `me && !me.alive`
    - แสดง total damage จาก `me.damageDealt`
    - list ศัตรูแต่ละคน: username, จำนวน hits, total damage
    - dark semi-transparent background, วางด้านขวาของจอ ไม่ทับ minimap
    - _Requirements: 6.1, 6.3, 6.4, 6.7_
  - [ ] 10.4 สร้าง body silhouette SVG พร้อม hit markers ใน `DamageLogPanel`
    - inline SVG แสดง front-view human silhouette
    - head zone: วงกลมบนสุด, body zone: สี่เหลี่ยมกลาง
    - hit markers: `●` สีอำพัน `#f59e0b` (head) หรือสีแดง `#ef4444` (body)
    - _Requirements: 6.2, 6.8_
  - [ ]* 10.5 Write property test for DamageLog panel visibility (Property 13)
    - **Property 13: DamageLog panel visibility**
    - **Validates: Requirements 6.1**
  - [ ]* 10.6 Write property test for DamageLog total damage display (Property 14)
    - **Property 14: DamageLog total damage display**
    - **Validates: Requirements 6.3**
  - [ ]* 10.7 Write property test for HitLog aggregation correctness (Property 15)
    - **Property 15: HitLog aggregation correctness**
    - **Validates: Requirements 6.4, 6.5**
  - [ ]* 10.8 Write property test for hit marker color by zone (Property 16)
    - **Property 16: Hit marker color by zone**
    - **Validates: Requirements 6.8**

- [ ] 11. Checkpoint — ตรวจสอบ SpectateHint และ DamageLog
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Screen Blood Vignette Effect
  - [ ] 12.1 สร้าง `hitOpacity(damage)` helper function และ `BloodVignette` component ใน `Hud.tsx`
    - `hitOpacity`: return 0.85 เมื่อ `d >= 50`, 0.55 เมื่อ `20 <= d < 50`, 0.30 เมื่อ `d < 20`
    - `BloodVignette`: รับ `hp` และ `lastHit` props
    - ใช้ `useRef` สำหรับ animation timestamp (ไม่ใช้ `useState`)
    - CSS `radial-gradient` จาก transparent ตรงกลาง ไปยัง `rgba(180, 0, 0, opacity)` ที่ขอบ
    - `pointer-events: none`
    - _Requirements: 7.1, 7.2, 7.5, 7.6_
  - [ ] 12.2 implement hit flash fade-out (600ms) และ low-health persistent vignette
    - hit flash: fade จาก peak opacity ใน 600ms โดยใช้ `requestAnimationFrame` หรือ CSS transition
    - เมื่อ damage event ใหม่เข้ามาระหว่าง fade: reset ไปที่ peak opacity
    - low-health: opacity 0.20 เมื่อ `hp < 30` (persistent, ไม่ fade)
    - _Requirements: 7.2, 7.3, 7.4, 7.7_
  - [ ] 12.3 เพิ่ม `BloodVignette` เข้าใน `Hud` component
    - pass `hp={displayPlayer?.hp ?? 100}` และ `lastHit={hit}` ให้ `BloodVignette`
    - _Requirements: 7.1_
  - [ ]* 12.4 Write property test for vignette opacity mapping (Property 17)
    - **Property 17: Vignette opacity mapping**
    - **Validates: Requirements 7.3**
  - [ ]* 12.5 Write property test for low-health persistent vignette (Property 18)
    - **Property 18: Low-health persistent vignette**
    - **Validates: Requirements 7.7**

- [ ] 13. Ghost Mode After Death
  - [ ] 13.1 เพิ่ม `ghostPosition` slice ใน `client/src/store/game.ts`
    - เพิ่ม `ghostPosition: { x, y, z, yaw, pitch } | null`
    - เพิ่ม `setGhostPosition` action
    - _Requirements: 8.1_
  - [ ] 13.2 implement ghost movement ใน `InputControls.tsx`
    - detect ghost mode: `me && !me.alive && !me.spectatingId`
    - WASD = horizontal movement, Space = up, Shift = down, speed = 20 units/sec
    - อัปเดต `ghostPosition` ใน game store โดยตรง (ไม่ส่ง `game:input` ไปยัง server)
    - ส่ง `game:ghostMove` event ไปยัง server ทุก 50ms (เหมือน input tick)
    - _Requirements: 8.2, 8.3_
  - [ ] 13.3 implement ghost free-fly camera ใน `ThirdPersonCamera.tsx`
    - เมื่อ ghost mode active: first-person free-fly
    - `camera.position = ghostPosition + eye offset`
    - `camera.lookAt = ghostPosition + forward * 80`
    - _Requirements: 8.1_
  - [ ] 13.4 เพิ่ม `matGhost` material และ render ghost mesh ใน `WorldPlayers.tsx`
    - เพิ่ม `const matGhost = new THREE.MeshStandardMaterial({ color: '#9ca3af', transparent: true, opacity: 0.35 })`
    - เมื่อ `p.isGhost === true`: ใช้ `matGhost` สำหรับ torso, `castShadow = false`
    - render ghost mesh ที่ server-reported position
    - _Requirements: 8.4, 8.5, 8.7_
  - [ ]* 13.5 Write property test for ghost mode activation condition (Property 19)
    - **Property 19: Ghost mode activation condition**
    - **Validates: Requirements 8.1, 8.9**
  - [ ]* 13.6 Write property test for ghost mesh rendering (Property 20)
    - **Property 20: Ghost mesh rendering**
    - **Validates: Requirements 8.4, 8.7**
  - [ ] 13.7 เพิ่ม ghost indicator ใน `Hud.tsx`
    - แสดง "โหมดผี 👻" ที่ top-center เมื่อ ghost mode active
    - ซ่อนเมื่อ ghost mode inactive
    - _Requirements: 8.8_
  - [ ]* 13.8 Write property test for ghost HUD indicator (Property 21)
    - **Property 21: Ghost HUD indicator**
    - **Validates: Requirements 8.8**
  - [ ] 13.9 handle Space key สำหรับ switch จาก Ghost Mode ไป Spectate ใน `InputControls.tsx` / `NetworkLayer.tsx`
    - เมื่อกด Space ขณะ ghost mode: emit `game:spectate` เพื่อ cycle spectate target
    - server set `isGhost = false`, `spectatingId = <next alive player>`
    - _Requirements: 8.9_

- [ ] 14. Final Checkpoint — ตรวจสอบทุก feature
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks ที่มี `*` เป็น optional สามารถข้ามได้เพื่อ MVP ที่เร็วขึ้น
- แต่ละ task อ้างอิง requirements เฉพาะเพื่อ traceability
- Property tests ใช้ [fast-check](https://github.com/dubzzz/fast-check) ตาม Testing Strategy ใน design
- Ghost Mode (Task 2 + 13) ต้องทำ server และ client พร้อมกันเพราะมี protocol changes
- Multiple Maps (Task 8) ส่วนใหญ่มีโครงสร้างแล้ว เพียงแค่ต้องเชื่อม WaitingRoom UI
