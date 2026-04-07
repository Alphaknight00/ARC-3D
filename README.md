# ARC3D™

**Professional Architectural CAD Software**

By [HSAN Studios](https://HSAN-Studios.com) — A Private Limited Company

---

## About

ARC3D™ is a browser-based architectural CAD application for designing buildings in 2D and 3D. Built with Babylon.js for real-time WebGL rendering, it runs entirely client-side with no backend or build step required.

## Live Demo

**[https://alphaknight00.github.io/Arc3d.github.io/](https://alphaknight00.github.io/Arc-3d)**

> Hosted on GitHub Pages. Works in any modern WebGL-capable browser (Chrome, Edge, Firefox).

## Features

- **2D & 3D Design** — Switch between orthographic floor plans and 3D perspective views
- **Wall System** — Solid, cavity, and stud walls with automatic miter joining
- **Building Elements** — Doors, windows, roofs, floors, staircases, foundations, beams, columns
- **Measurements** — Automatic dimensioning, area calculations, smart grid snapping
- **Multi-Story** — Level-based placement with preset and custom elevations
- **Text Annotations** — Resizable text labels with font/style customisation
- **Export** — PDF and DXF output with title blocks
- **Undo/Redo** — Full history tracking for all operations
- **Auto-Save** — Periodic saves to IndexedDB and localStorage

## Tech Stack

| Technology | Purpose |
|---|---|
| Babylon.js 6.0 | 3D/2D WebGL rendering engine |
| JavaScript ES6 | Application logic (24 manager classes) |
| HTML5 / CSS3 | UI framework |
| jsPDF | PDF export |
| Earcut | Polygon triangulation |
| Font Awesome 6.4 | UI icons |
| IndexedDB | Project storage |
| Electron | Desktop app wrapper |

## Files

| File | Description |
|---|---|
| `arc3d.html` | Main application |
| `index.html` | Marketing landing page & project launcher |
| `arc3d-help.html` | Help & keyboard shortcuts reference |
| `ARC3D-APP/` | Electron desktop wrapper |
| `Backups/` | Manual snapshots |

## Getting Started

No build system required. Open `index.html` in a modern browser to access the landing page, or open `arc3d.html` directly to launch the app.

### GitHub Pages Hosting

This repo is configured for GitHub Pages:

1. Push to the `main` branch
2. Go to **Settings → Pages**
3. Set source to **Deploy from a branch** → `main` / `/ (root)`
4. Your site will be live at `https://<username>.github.io/<repo-name>/`

The entry point is `index.html` (served automatically by GitHub Pages). All assets (vendor JS, fonts, styles) are included — no build step needed.

### Desktop App (Electron)

```bash
cd ARC3D-APP
npm install
npm start
```

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `W` | Wall drawing |
| `D` | Door placement |
| `R` | Window placement |
| `Shift+R` | Roof |
| `Shift+S` | Stairs |
| `2` / `3` | Switch 2D / 3D view |
| `Ctrl+S` | Save project |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `Escape` | Cancel current tool |

## Units

All user-facing inputs are in **millimeters (mm)**. Internal calculations use **metres**.

## Browser Support

Requires a WebGL-capable browser. Tested on Chrome, Edge, and Firefox.

## Repository Structure

```
index.html             ← Landing page (entry point)
arc3d.html             ← Main CAD application
arc3d-help.html        ← Help & shortcuts reference
build/vendor/          ← Babylon.js, jsPDF, Earcut, Font Awesome
styles/                ← CSS
ARC3D-APP/             ← Electron desktop wrapper
LICENSE                ← Proprietary license
```

## License

Proprietary — see [LICENSE](LICENSE) for full terms.

## Contact

**HSAN Studios**
- Web: [HSAN-Studios.com](https://HSAN-Studios.com)
- Email: support@HSAN-Studios.com

---

© 2026 HSAN Studios. All Rights Reserved. ARC3D™ is a trademark of HSAN Studios.
