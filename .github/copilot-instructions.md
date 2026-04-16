# ARC3D™ – AI Agent Guide

## Project Overview

**Product**: ARC3D™ – Professional Architectural CAD Software  
**Company**: HSAN Studios — a Private Limited Company  
**Domain**: HSAN-Studios.com | support@HSAN-Studios.com  
**Architecture**: Single-file monolithic HTML (~131k lines) with CSS, HTML, and 24 vanilla JS ES6 manager classes  
**Rendering**: Babylon.js 6.0 WebGL with dual 2D orthographic / 3D perspective camera modes  
**Storage**: Client-side localStorage + IndexedDB (no backend)  
**Development**: No build system – open `.html` directly in browser  
**Units**: Millimeters (mm) for all user-facing inputs, meters internally

### Files
| File | Purpose |
|------|---------|
| `arc3d.html` | Main app (~131k lines) |
| `index.html` | Marketing landing page / project launcher (~3.8k lines) |
| `arc3d-help.html` | In-app help / keyboard shortcuts reference (~1.5k lines) |
| `ARC3D - Business Plan.html` | Business plan for £250K funding |
| `project-summary.html` | Technical project summary page |
| `cash-forecast-3yr.html` | 3-year cash forecast |
| `arc3d-business-summary.html` | One-page business summary |
| `ARC3D-APP/` | Electron desktop wrapper (synced copy at `ARC3D-APP/app/arc3d.html`) |
| `Backups/` | Manual snapshots – **always create before major refactors** |

## Critical: Code Editing Strategy

**Line numbers drift constantly.** Always search before editing:
```
1. grep_search: "class BuildingTools" → find current line
2. read_file: context ±50 lines around match
3. replace_string_in_file: include 3-5 unchanged lines before/after
```

## Manager Architecture

All 24 managers instantiated in `CADModeler.initializeManagers()` and exposed globally via `window.<name>`.
**Note**: Line numbers below are approximate – always grep to find current location.

### 🔥 Primary (most frequently modified)
```javascript
buildingTools       // Wall/door/window/roof/floor/staircase/surface creation (~37170)
sceneManager        // Babylon.js scene, cameras, lights, visibility (~21163)
uiManager           // Panels, notifications, modals, themes (~30256)
historyManager      // Undo/redo - update when adding new element types (~108252)
fileManager         // JSON serialization - update when adding new metadata (~119129)
appManager          // Keyboard routing, 2D/3D switching (~134451)
```

### ⚙️ Secondary (occasional modifications)
```javascript
settingsManager     // User preferences, grid settings (~32654)
propertiesManager   // Element property panels (~94677)
selectionTools      // Multi-select, lasso selection
measurementTools    // Distance/area measuring
viewportControls    // Camera manipulation
exportTools         // PDF/DXF export (~122689)
```

### 📦 Utility (rarely modified)
```javascript
rulerManager        // On-screen rulers
memoryManager       // Memory optimization
indexedDBStorage    // Large file persistence
utilityTools        // Misc utilities, canvas refresh
analysisTools       // Structural analysis
materialTools       // Material library
renderTools         // Rendering options
cloudStorageManager // Cloud sync placeholder
collaborationTools  // Multi-user placeholder
layerManager        // Layer visibility management (~134033)
projectDatabaseManager  // Project database operations (~109659)
```

## Data Model: Mesh Metadata

All elements are `BABYLON.Mesh` or `TransformNode` with custom metadata:
```javascript
mesh.metadata = {
  type: 'wall',              // 'wall', 'door', 'window', 'roof', 'floor', 'staircase', 'surface'
  wallType: 'cavity',        // 'solid', 'cavity', 'stud'
  startPoint: Vector3,       // 3D coordinates
  endPoint: Vector3,
  thickness: 0.3,            // meters (internal)
  height: 3.0,               // meters (internal) — default changed from 2.7 to 3.0
  baseElevation: 0,          // meters - for multi-story placement
  level: 'ground',           // 'ground', 'first', 'second', etc.
  openingInserts: {}         // Door/window IDs keyed by mesh ID
}
```
Storage: `sceneManager.objects[]` array holds all building elements.

## Multi-Story Support

Walls, stairs, floors, ceilings, and curtain walls support level-based placement:
- **Level presets**: Ground (0m), 1st (3.0m), 2nd (6.0m), 3rd (9.0m), 4th (12.0m), Basement (-3.0m)
- **Default level height**: 3000mm (changed from 2700mm)
- **Base elevation**: Custom elevation in mm for precise placement
- **Properties**: `baseElevation` (meters), `level` (name string) stored in metadata
- **Methods**: `setWallLevelPreset()`, `setWallBaseElevation()`, `setStairLevelPreset()`, `setStairBaseElevation()`

## View Modes

| Mode | Camera | Switch | Key Features |
|------|--------|--------|--------------|
| 2D | `sceneManager.camera2D` (orthographic) | `appManager.switchTo2D()` | Wall outlines, dimension labels, no skybox |
| 3D | `sceneManager.camera` (ArcRotate) | `appManager.switchTo3D()` | Shadows, skybox, orbit controls |

**Default startup**: 2D mode (set in `CADModeler.init()`)

## Keyboard Shortcuts
```
W          Wall drawing         D          Door
R          Window              Shift+R     Roof
Shift+S    Stairs              2/3         Switch view mode
Ctrl+S     Save                Ctrl+Z/Y    Undo/Redo
Escape     Cancel current tool / close menus
```

## Wall System (Critical)

**Centerline architecture**: Walls positioned on centerline with internal/external face offsets.

Key functions (search to find current lines):
- `createWallHatching()` – Diagonal cross-hatch visualization for 2D mode
- `calculateBothMiterPoints()` – Returns `{ internal, external }` Vector3 for corner joins
- `showSnapIndicator()` – Dark green disc for snap points

**Miter rule**: At acute corners, extend miter points along miter direction – never revert to perpendicular offsets:
```javascript
// ✅ CORRECT: Extend along miter
const miterDir = externalMiter.subtract(internalMiter).normalize();
internalMiter = internalMiter.subtract(miterDir.scale(extension));

// ❌ WRONG: Recalculating destroys miter angle
```

**renderingGroupId hierarchy**: 0=skybox/grid, 1=hatching/highlights, 2=outlines/snap indicators, 3=UI overlays/resize handles

## Persistence

- **Auto-save**: Every 5 minutes to `cadModelerAutoSave` localStorage key
- **IndexedDB**: Primary storage via `ARC3D_DB` database (through `indexedDBStorage`)
- **Folder DB**: `ARC3D_FolderDB` for project folder organisation
- **Cloud config**: `arc3d_cloud_config` / `arc3d_cloud_projects` localStorage keys
- **Fallback**: localStorage if IndexedDB unavailable
- **Quota handling**: On exceeded, 50% of old saves cleared

## Development

```powershell
# Run locally
Start-Process "arc3d.html"

# Create backup before refactoring
Copy-Item arc3d.html "Backups\backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').html"

# Sync to Electron app after editing
Copy-Item arc3d.html "ARC3D-APP\app\arc3d.html"
```

**Browser DevTools debugging**:
```javascript
sceneManager.scene.meshes.length    // Total Babylon.js meshes
sceneManager.objects.length         // Building elements only
sceneManager.objects.filter(o => o.metadata?.type === 'wall')  // All walls
window.buildingTools                // Check manager exists
historyManager.undoStack.length     // Undo states available
```

## Code Style

- ES6 classes, no modules (all globals on `window`)
- `BABYLON.*` namespace for all 3D APIs
- Vanilla DOM (`document.getElementById`), no jQuery
- camelCase methods, lowercase HTML IDs with dashes (e.g., `floor-options-section`)
- Inline event handlers on HTML elements: `onclick="buildingTools?.methodName()"`
- Optional chaining (`?.`) used extensively for null safety

## UI Design Guidelines

- **Option panels**: Minimalist sharp design, no border-radius, monochrome styling
- **SVG icons**: Hidden in option menus (`.wo-icon-svg`, `.section-icon-svg` set to `display: none`)
- **Input alignment**: All inputs right-aligned in option panels via `margin-left: auto`
- **Units display**: Show mm in UI, convert to/from meters in JavaScript
- **Wall confirmation dialog**: Shows length, thickness, height, angle, wall type with mm units

## Adding New Element Types

When adding a new building element type, update these locations:
1. **buildingTools** – Creation logic and tool activation
2. **historyManager** – Add case in `switch (mesh.metadata.type)` for undo/redo serialization
3. **fileManager** – Add case in save/load for project persistence
4. **propertiesManager** – Add case for property panel display
5. **sceneManager.objects** – Push new elements to this array for tracking

Search for existing `case 'wall':` patterns to find all switch statements that need updating.

## Text Annotation System

Text annotations are `BABYLON.Mesh` planes with `DynamicTexture` rendering.
- **Type**: `mesh.metadata.type === 'annotationText'`
- **Storage**: `buildingTools.drawingTexts[]` + `sceneManager.objects[]`
- **Resize**: 4 corner handles + bounding box outline (`_textResizeBox`), uniform diagonal scaling
- **Drag**: Ground-plane ray intersection (`_pickGroundPlane()`) for cursor tracking
- **Properties**: font, fontSize, color, bold, italic, underline, align, opacity, background, border

## Event Handling: Pointer Move Priority

**Critical**: In `sceneManager.handlePointerMove()`, active drag handlers MUST run BEFORE hover/cursor checks. Otherwise hover detection returns early and blocks drag updates (e.g., text resize shrinking fails when cursor passes over the text mesh).

Order:
1. Active drags (text resize, title block move, title block resize, hatch resize)
2. Hover/cursor checks (dimension lines, columns, text, annotations, resize handles)
3. Default cursor reset

## Resize Handle Pattern

Used by text annotations, title blocks, and hatches:
```javascript
// Show: create handles + bounding box → store in array
showXxxResizeHandles(mesh)    // Creates handle meshes, stores in this.xxxResizeHandles[]
clearXxxResizeHandles()       // Disposes all handles + bounding box
isXxxResizeHandle(mesh)       // Returns true if mesh is a resize handle
startXxxHandleDrag(handle)    // Records initial state for drag
handleXxxResizeDrag(point)    // Applies scaling + repositions handles
endXxxHandleDrag()            // Saves metadata + records history
```
Handle metadata: `{ isTextResizeHandle: true, cornerIndex, corner, cursor, parentText }`

## Staircase System

Staircases support three shapes with full 3D geometry:
- **Straight**: Single or multi-flight with landings (double-click to finalize multi-flight)
- **U-Shaped**: Two parallel flights with 180° landing
- **Spiral**: Helical steps around a central pole

### Staircase Metadata
```javascript
mesh.metadata = {
  type: 'staircase',
  stairType: 'straight',       // 'straight', 'u-shaped', 'spiral'
  stepCount: 14,
  stepHeight: 0.214,           // meters
  stepDepth: 0.25,             // meters
  totalHeight: 3.0,            // meters
  width: 0.9,                  // meters
  hasRailings: true,
  flipped: false,
  stairMaterial: 'concrete',   // 'wood', 'concrete', 'steel', 'stone', 'glass'
  baseElevation: 0,            // meters
  level: 'ground',
  startPoint: Vector3,
  endPoint: Vector3
}
```

### Staircase Components
- **Steps/treads**: Individual box meshes per step
- **Stringers**: Custom parallelogram prism geometry with vertical-cut ends aligned to risers
- **Railings**: Follow stringer slope, aligned with stringer outer edges
- **Landings**: Flat slab meshes connecting flights (U-shaped and multi-flight)
- **2D Dimensions**: Auto-generated run, width, rise, and landing depth annotations (`_createStaircaseDimensions()`)

### Multi-Flight Stairs
- `_stairFlights[]` array tracks `{start, end, direction, riserCount}` per flight
- Click to place each flight direction, double-click to finalize
- Variable landing depth calculated from flight geometry
- Stringers and railings generated per-flight with landing connectors

## Surface Tool

Point-by-point polygon tool for pathways and uneven terrain surfaces.
- **Activation**: Surface tool button or keyboard shortcut
- **Creation**: Click to place boundary points, double-click to close polygon
- **Interior points**: Optional elevation control points within the boundary
- **Triangulation**: Delaunay triangulation for mesh generation
- **Metadata type**: `'surface'` with `boundaryPoints`, `interiorPoints`, `elevation`, `thickness`
- **Selection**: Custom outline rendering for boundary + vertical edges
