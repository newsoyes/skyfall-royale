# Requirements Document

## Introduction

ฟีเจอร์ชุดนี้เป็นการปรับปรุงประสบการณ์การเล่นเกม Skyfall Royale (Battle Royale บน React Three Fiber + Node.js + Socket.IO) ใน 8 ด้าน ได้แก่ การตั้งค่าความไวเมาส์, ป้ายชื่อผู้เล่น, สีทีม, แมพหลายสไตล์, คำแนะนำ spectate หลังตาย, UI สถิติความเสียหาย, เอฟเฟกต์เลือดที่ขอบจอ และโหมดผีหลังตาย

---

## Glossary

- **Game**: ระบบเกม Skyfall Royale โดยรวม
- **Client**: ฝั่ง React Three Fiber ที่ทำงานในเบราว์เซอร์ของผู้เล่น
- **Server**: ฝั่ง Node.js + Socket.IO ที่จัดการ game state
- **Snapshot**: ข้อมูล game state ที่ server ส่งมาให้ client ทุก 40ms
- **Player**: ผู้เล่นที่มีชีวิตอยู่ในเกม
- **Ghost**: ผู้เล่นที่ตายแล้วและอยู่ในโหมดผี สามารถบินได้อิสระ
- **Teammate**: ผู้เล่นที่อยู่ในทีมเดียวกัน (teamId เดียวกัน) ในโหมด duo หรือ squad
- **HUD**: Heads-Up Display — UI ที่แสดงทับบนหน้าจอระหว่างเล่น
- **Sensitivity**: ค่าความไวของเมาส์ที่ใช้คูณกับ movementX/movementY
- **NameTag**: ป้ายชื่อผู้เล่นที่แสดงเหนือหัวตัวละครใน 3D world
- **Vignette**: เอฟเฟกต์ขอบจอมืดหรือแดงที่แสดงเมื่อโดนยิง
- **DamageLog**: บันทึกความเสียหายที่ผู้เล่นได้รับและส่งออกไปในแมทช์นั้น
- **HitZone**: ตำแหน่งที่โดนยิง — `head` (หัว) หรือ `body` (ตัว)
- **SpectateHint**: ข้อความแนะนำให้กด Spacebar เพื่อเปลี่ยนเป้าหมาย spectate
- **MapId**: ตัวระบุแมพ เช่น `island`, `desert`, `snow`, `city`
- **InputControls**: คอมโพเนนต์ที่จัดการ keyboard + pointer-lock สำหรับการควบคุมกล้อง
- **WorldPlayers**: คอมโพเนนต์ที่ render ตัวละครผู้เล่นทั้งหมดใน 3D scene
- **GameScene**: คอมโพเนนต์หลักที่ประกอบ 3D scene ทั้งหมด

---

## Requirements

### Requirement 1: ตั้งค่าความไวเมาส์ (Mouse Sensitivity Setting)

**User Story:** As a Player, I want to adjust mouse sensitivity, so that I can control camera movement speed to match my preference and hardware setup.

#### Acceptance Criteria

1. THE Game SHALL provide a sensitivity setting with a numeric range from 0.1 to 5.0 (relative multiplier, default 1.0).
2. WHEN the Player adjusts the sensitivity slider, THE InputControls SHALL apply the new sensitivity value to all subsequent mouse movement calculations within the same session.
3. THE Game SHALL persist the sensitivity value in `localStorage` under the key `skyfall_mouse_sensitivity` so that the value is restored on next page load.
4. WHEN the stored sensitivity value is absent or outside the valid range [0.1, 5.0], THE Game SHALL use the default value of 1.0.
5. THE HUD SHALL display a sensitivity settings panel accessible via a settings button (⚙️) visible during gameplay.
6. WHEN the sensitivity settings panel is open, THE Game SHALL continue to process all other game inputs normally without interruption.
7. THE InputControls SHALL compute camera yaw and pitch delta as: `delta = movementPixels × baseSensitivity × userSensitivity`, where `baseSensitivity` is the existing constant `0.0022`.

---

### Requirement 2: ป้ายชื่อผู้เล่นเหนือหัว (Player Name Tag Above Head)

**User Story:** As a Player, I want to see other players' names displayed above their heads, so that I can identify teammates and enemies quickly during combat.

#### Acceptance Criteria

1. WHEN a Player is alive and visible in the 3D scene, THE WorldPlayers SHALL render a NameTag displaying the player's `username` above the player's head mesh at a fixed vertical offset of 0.4 units above the head sphere center.
2. THE NameTag SHALL always face the camera (billboard behavior) regardless of the player's yaw rotation.
3. WHEN the distance between the local Player and another player exceeds 80 units, THE WorldPlayers SHALL hide that player's NameTag to reduce visual clutter.
4. THE NameTag for a Teammate SHALL use the color `#60a5fa` (blue-400).
5. THE NameTag for an enemy Player SHALL use the color `#fb7185` (rose-400).
6. THE NameTag for the local Player (self) SHALL NOT be rendered.
7. WHEN a Player is skydiving, THE WorldPlayers SHALL render the NameTag at the same relative offset above the head.
8. IF the `teamMode` in the Snapshot is `solo`, THEN THE WorldPlayers SHALL render all NameTags in the enemy color `#fb7185`.

---

### Requirement 3: สีทีม (Team Color — Blue for Teammates)

**User Story:** As a Player in duo or squad mode, I want teammates' character models to appear in blue, so that I can instantly distinguish friends from enemies in combat.

#### Acceptance Criteria

1. WHEN the `teamMode` in the Snapshot is `duo` or `squad`, THE WorldPlayers SHALL render the torso mesh of Teammates using the material color `#3b82f6` (blue-500).
2. WHEN the `teamMode` in the Snapshot is `solo`, THE WorldPlayers SHALL render all other players' torso meshes using the existing enemy color `#fb7185`.
3. THE WorldPlayers SHALL render the local Player's torso mesh using the existing self color `#5eead4` regardless of team mode.
4. WHEN a player's `teamId` changes during a match (e.g., due to reconnect), THE WorldPlayers SHALL update the torso material color within one render frame.
5. THE minimap in the HUD SHALL render Teammate dots in color `#60a5fa` (blue-400) and enemy dots in color `#fb7185` (rose-400) when `teamMode` is `duo` or `squad`.

---

### Requirement 4: แมพหลายสไตล์ (Multiple Maps — Different Styles/Themes)

**User Story:** As a Player, I want to play on maps with different visual themes, so that each match feels fresh and offers varied tactical environments.

#### Acceptance Criteria

1. THE Game SHALL support at least 4 distinct MapIds: `island`, `desert`, `snow`, and `city`, each with unique terrain height functions, sky colors, fog colors, and vegetation density.
2. WHEN a room is created, THE Server SHALL accept a `mapId` parameter and store it in the room configuration.
3. WHEN a match starts, THE Client SHALL call `setActiveMap(mapId)` with the mapId received from the server to switch the active terrain and visual style.
4. THE WaitingRoom UI SHALL display the current map's `nameTH` and `descTH` to all players before the match starts.
5. WHEN the active map changes, THE GameScene SHALL update `ambientLight` intensity, `directionalLight` position, sky color, fog color, and terrain geometry to match the new map's `MapDef`.
6. THE LobbyScreen SHALL allow the room host to select a map from the list of available MapIds before starting the match.
7. WHEN a map is selected, THE Server SHALL broadcast the updated `mapId` to all players in the room via `room:update`.

---

### Requirement 5: คำแนะนำ Spectate หลังตาย (Death Spectate Hint)

**User Story:** As a Player who has just died, I want to see a clear hint that I can press Spacebar to spectate other players, so that I know how to continue watching the match.

#### Acceptance Criteria

1. WHEN the local Player's `alive` field transitions from `true` to `false` in the Snapshot, THE HUD SHALL display a SpectateHint overlay within one render frame.
2. THE SpectateHint SHALL display the text "กด [Space] เพื่อดูผู้เล่นอื่น" prominently in the center of the screen.
3. WHEN the local Player has a non-null `spectatingId`, THE HUD SHALL display the text "กด [Space] เพื่อเปลี่ยนเป้าหมาย" instead of the initial hint.
4. THE SpectateHint SHALL remain visible for the entire duration that the local Player is dead (i.e., `alive === false`).
5. WHEN there are no alive players remaining to spectate (i.e., `snapshot.remaining === 0`), THE HUD SHALL hide the SpectateHint.
6. THE SpectateHint SHALL be visually distinct from other HUD elements, using a semi-transparent dark background panel with white text.

---

### Requirement 6: UI สถิติความเสียหายหลังตาย (Damage Dealt UI / Hit Log)

**User Story:** As a Player who has just died, I want to see a damage statistics panel showing who I shot, where I hit them, and total damage dealt, so that I can review my combat performance.

#### Acceptance Criteria

1. WHEN the local Player's `alive` field transitions from `true` to `false`, THE HUD SHALL display a DamageLog panel on the right side of the screen.
2. THE DamageLog panel SHALL display a silhouette of a human body (front view) with hit markers indicating `head` or `body` zones for each hit recorded during the match.
3. THE DamageLog panel SHALL display the total damage dealt by the local Player, sourced from `me.damageDealt` in the Snapshot.
4. THE DamageLog panel SHALL list each unique enemy player that the local Player damaged, showing: the enemy's `username`, the number of hits, and the total damage dealt to that enemy.
5. THE Client SHALL maintain a local `hitLog` array during the match, appending an entry `{ targetId, targetUsername, damage, isHead, at }` each time a `damageNumbers` entry appears in the Snapshot that originated from the local Player's shots.
6. WHEN the local Player dies and respawns (in future game modes), THE Client SHALL reset the `hitLog` array.
7. THE DamageLog panel SHALL use a dark semi-transparent background and be positioned on the right side of the screen without overlapping the minimap.
8. THE human body silhouette SHALL be rendered as a dark SVG shape, with head hit markers shown in amber (`#f59e0b`) and body hit markers shown in red (`#ef4444`).

---

### Requirement 7: เอฟเฟกต์เลือดที่ขอบจอเมื่อโดนยิง (Screen Blood Vignette Effect When Hit)

**User Story:** As a Player, I want to see a red vignette effect at the screen edges when I take damage, so that I have a clear visual feedback that I am being hit.

#### Acceptance Criteria

1. WHEN the local Player receives damage (i.e., `lastHitDamage` is set in the game store), THE HUD SHALL display a Vignette overlay covering the screen edges with a red radial gradient.
2. THE Vignette SHALL appear within one render frame of the damage event and fade out over a duration of 600ms.
3. THE Vignette opacity at peak SHALL scale with the damage amount: damage ≥ 50 produces opacity 0.85; damage between 20 and 49 produces opacity 0.55; damage below 20 produces opacity 0.30.
4. WHEN multiple damage events occur within the fade-out period, THE HUD SHALL reset the Vignette to its peak opacity for the new damage event.
5. THE Vignette SHALL be rendered as a CSS `radial-gradient` from transparent at center to `rgba(180, 0, 0, opacity)` at the edges, covering the full viewport.
6. THE Vignette SHALL NOT interfere with pointer events or other HUD interactions.
7. WHEN the local Player's `hp` drops below 30, THE HUD SHALL display a persistent low-health Vignette at opacity 0.20 in addition to the hit flash effect.

---

### Requirement 8: โหมดผี (Ghost Mode After Death)

**User Story:** As a Player who has died, I want to enter ghost mode and fly freely through the map, so that I can explore the battlefield and watch the match from any angle.

#### Acceptance Criteria

1. WHEN the local Player's `alive` field transitions to `false` and the Player is not spectating another player, THE Client SHALL activate Ghost Mode, enabling free-flight camera movement.
2. WHILE in Ghost Mode, THE InputControls SHALL allow the Ghost to move in all 6 directions (forward, backward, left, right, up, down) using WASD + Space (up) + Shift (down) at a speed of 20 units per second.
3. WHILE in Ghost Mode, THE InputControls SHALL NOT send movement input packets to the Server (ghost movement is client-side only).
4. THE WorldPlayers SHALL render Ghost players as semi-transparent (opacity 0.35) grey-colored meshes using material color `#9ca3af` (gray-400).
5. WHEN a Ghost player's position is included in the Snapshot (server tracks ghost position for visibility), THE WorldPlayers SHALL render the Ghost mesh at the server-reported position for other players.
6. THE Server SHALL broadcast the Ghost player's position in the Snapshot so that other alive players can see the Ghost in the world.
7. THE Ghost mesh SHALL NOT cast shadows and SHALL NOT have collision with terrain or other players.
8. WHEN the local Player is in Ghost Mode, THE HUD SHALL display a "โหมดผี 👻" indicator in the top-center of the screen.
9. WHEN the local Player switches from Ghost Mode to spectating a specific player (by pressing Space), THE Client SHALL deactivate Ghost Mode and follow the spectated player's camera.
10. THE Server SHALL add a `isGhost` boolean field to `PlayerState` to indicate whether a dead player is in ghost mode, and THE Client SHALL use this field to determine ghost rendering.
