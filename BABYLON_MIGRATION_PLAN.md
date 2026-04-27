# Babylon.js Upgrade Plan for ARC3D

**Current**: Babylon.js **6.0.0** (cdnjs, single line in `arc3d.html` ~L43)
**Latest stable**: Babylon.js **9.4.1** (April 2026)
**Gap**: 3 major versions (7, 8, 9)

---

## 1. Recommended target & path

**Target: 9.4.1** (latest stable). Take a two-step path to minimise debugging:

1. **Phase A** – Upgrade to **8.16.0** (last 8.x). Fix anything that breaks. Ship.
2. **Phase B** – Upgrade to **9.4.1**. Fix v9-specific issues. Ship.

If you must do it in one shot, jump directly to 9.4.1 — but expect a longer test cycle.

CDN swap (single change in `arc3d.html` line 43):
```html
<!-- Phase A -->
<script src="https://cdn.babylonjs.com/v8.16.0/babylon.js"></script>
<!-- Phase B -->
<script src="https://cdn.babylonjs.com/babylon.js"></script>
```
Use `cdn.babylonjs.com` (official) rather than cdnjs — versions are kept current and the non-minified build gives readable stack traces during the upgrade.

---

## 2. ARC3D's Babylon API surface (audit summary)

What you actually use today, based on a code scan:

| API area | Usage in ARC3D | v9 status |
|---|---|---|
| `BABYLON.MeshBuilder.*` (Cylinder, Box, Polygon, ExtrudePolygon, CreateLines, CreateLineSystem, Sphere) | Heavy | Unchanged |
| `StandardMaterial`, `DynamicTexture` | Heavy (walls, text, hatching) | Unchanged |
| `ArcRotateCamera` (3D) + orthographic camera (2D) | Core | Unchanged |
| `ShadowGenerator` w/ `useBlurExponentialShadowMap`, `blurKernel`, `bias` | Used | Unchanged |
| `HighlightLayer` | Used (`setupHighlightLayer`) | Unchanged |
| `mesh.renderOutline` / `outlineColor` | Heavy (selection) | Unchanged, but **Outline Renderer in 9.0** is a better replacement |
| `enableEdgesRendering(0.95, false)` | Heavy (wall/foundation outlines) | Unchanged |
| `renderingGroupId` 0–3 | Core hierarchy | Unchanged |
| `TransformNode`, `Vector3`, `Color3/4`, `Mesh.metadata` | Core | Unchanged |
| `BABYLON.SceneLoader` | **Not used** (you only export, no runtime imports through it) | Safe |
| Custom shaders / `Effect.ShadersStore` | **Not used** | Safe |
| GLTF / OBJ / IFC loaders | Custom code, not Babylon's loaders | Safe |
| Physics, WebXR, Audio | **Not used** | Safe |

**Conclusion**: Your usage is conservative and almost entirely on stable, non-deprecated APIs. The migration risk is **low**.

---

## 3. Known breaking-change hotspots (v6 → v9)

Things to test/grep for after the upgrade:

1. **Default `Engine` constructor options** — v7 changed some defaults around antialiasing & adaptToDeviceRatio. Verify canvas crispness on hi-DPI screens.
2. **`Scene.useRightHandedSystem`** — confirm yours is unchanged (your code comments say right-handed).
3. **PBR material defaults** — irrelevant, you use `StandardMaterial`.
4. **`LinesMesh` color** — still works via `mesh.color = new BABYLON.Color3(...)`. Verify dimension/grid line colors render.
5. **`enableEdgesRendering` threshold semantics** — unchanged, but the underlying `EdgesRenderer` got rewritten in v8. Visually compare wall/foundation edges before/after.
6. **`HighlightLayer` blur kernel** — output looks slightly different in 8/9. May need to retune `innerGlow`/`outerGlow` if used.
7. **`DynamicTexture.drawText` / `getContext()`** — unchanged.
8. **`MeshBuilder.CreatePolygon`** — earcut.js is still required as a runtime dep (you already include it implicitly). If you see `earcut is not defined`, add `<script src="https://cdn.babylonjs.com/earcut.min.js"></script>`.
9. **`renderOutline`** — still works on v9; an optional `OutlineRenderer` replacement exists.
10. **`scene.pick` / `scene.pickWithRay`** — return shape unchanged.

---

## 4. Concrete upgrades worth adopting (post-migration)

Listed in priority order for a CAD app:

### High value
- **Outline Renderer (v9.0)** — replaces your scattered `mesh.renderOutline = true` blocks (in `selectionTools` and around line 28463–28705). Cleaner, GPU-driven, supports instances and LOD. Worth a focused refactor task.
- **Large World Rendering / Floating Origin (v9.0)** — eliminates 32-bit float jitter on large sites (>~1 km from origin). Useful for site plans, large commercial projects. Opt-in via `scene.floatingOrigin`.
- **Signed Distance Field (SDF) Text (v9.0)** — your dimension labels and annotations are currently `DynamicTexture` planes (line 34362). SDF text stays crisp at any zoom and is the right primitive for CAD labels. Big visible win.

### Medium value
- **Snapshot rendering** (v7+) — if a frame is static (typical when user isn't drawing), Babylon can snapshot and reuse it for huge FPS gains on large projects. `scene.snapshotRendering = true` when idle.
- **`thinInstances`** for repeated elements (railings, balusters, stair treads, hatching strokes) — already in v6 but matured a lot. Could replace per-step cylinder/box meshes in staircases.
- **Selection Outline Layer (v9)** — a layer-based alternative to per-mesh outlines, plays nicely with grouped selection (multi-select walls).
- **Frame Graph (v9.0 v1)** — only if you start adding post-processing. Not urgent.

### Low priority / not relevant
- Clustered Lighting, Volumetric Lighting, Textured Area Lights — overkill for CAD.
- Gaussian Splatting, 3D Tiles, Geospatial Camera — not your domain.
- WebXR/Audio improvements — unused.
- Node Particle Editor — irrelevant.
- 3MF Exporter — possibly nice-to-have if you want 3D-printable model export, but you already export GLTF/PDF/DXF.

---

## 5. Migration checklist

### Pre-flight
- [ ] Create backup: `Copy-Item arc3d.html "Backups\backup-pre-babylon-9-$(Get-Date -Format 'yyyyMMdd-HHmmss').html"`
- [ ] Note current load time and FPS on a large reference project for before/after comparison.

### Phase A: 6.0 → 8.16
- [ ] Swap CDN URL to `https://cdn.babylonjs.com/v8.16.0/babylon.js`.
- [ ] Hard-refresh, open DevTools console.
- [ ] Smoke test (each item below):
  - [ ] App boots, loading screen clears.
  - [ ] 2D mode renders with grid + rulers.
  - [ ] Switch to 3D — skybox, shadows, ground appear.
  - [ ] Draw a wall, door, window, roof, floor, staircase — each appears correctly.
  - [ ] Wall hatching renders in 2D.
  - [ ] Wall miters at acute corners look correct.
  - [ ] Selection outlines (`renderOutline`) appear on click.
  - [ ] Edge rendering visible on walls/foundations.
  - [ ] Highlight layer (hover glow) works.
  - [ ] Dimension labels (`DynamicTexture` planes) are readable.
  - [ ] Undo/redo a wall create + move.
  - [ ] Save and reload a project from localStorage/IndexedDB.
  - [ ] PDF / GLTF export.
- [ ] Sync `arc3d.html` → `ARC3D-APP/app/arc3d.html` and smoke test the Electron build.
- [ ] Commit / backup.

### Phase B: 8.16 → 9.4.1
- [ ] Swap CDN URL to `https://cdn.babylonjs.com/babylon.js`.
- [ ] Re-run the same smoke-test list.
- [ ] Pay extra attention to: edge rendering visual fidelity, highlight layer glow, text label crispness, shadow penumbra.
- [ ] Update inline doc/text references to "Babylon.js 6.0" → "Babylon.js 9" (e.g. line 31499 `<li>Babylon.js 3D engine</li>` is generic — leave it; copilot-instructions and the loading screen at line 19315 are fine).

### Post-migration enhancement passes (optional, separate PRs)
1. Replace `mesh.renderOutline` blocks with `OutlineRenderer` API.
2. Convert annotation text + dimension labels to **SDF Text**.
3. Enable **floating origin** for projects with large coordinates.
4. Convert staircase tread/baluster loops to **thin instances**.
5. Toggle **snapshot rendering** when the scene is idle.

---

## 6. Rollback

If something breaks irreversibly:
```powershell
Copy-Item "Backups\backup-pre-babylon-9-YYYYMMDD-HHmmss.html" arc3d.html -Force
Copy-Item arc3d.html "ARC3D-APP\app\arc3d.html" -Force
```
The change is a **one-line CDN URL** plus possibly tiny visual fixes — rollback is trivial.

---

## 7. Effort estimate (qualitative)

- **Phase A (6 → 8)**: small. Most likely 0–3 small fixes. Mostly QA time.
- **Phase B (8 → 9)**: small. 0–2 small fixes.
- **Outline Renderer refactor**: medium.
- **SDF text refactor**: medium.
- **Floating origin**: small (opt-in flag + verify a few hard-coded world thresholds).
- **Thin-instance staircases**: medium.

Total upgrade cost is dominated by QA, not coding. The single-file architecture and conservative API usage make this an unusually low-risk Babylon major upgrade.
