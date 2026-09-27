# TEDDIS

A futuristic falling-block puzzle game for desktop and mobile browsers. Classic,
tight, arcade-style gameplay with an original high-tech interface.

Built with **Next.js 16**, **React 19**, **TypeScript** and **Tailwind CSS 4**.
Everything runs in the browser: no backend, no accounts, no environment
variables.

## Gameplay

- 10×20 playfield with a hidden spawn buffer; pieces enter just above the field
- Seven tetromino shapes, **7-bag randomizer** (every bag holds each piece once)
- **Super Rotation System** with wall and floor kicks, clockwise and counter-clockwise
- Ghost piece, hold (once per piece), five-piece next queue
- **Lock delay** of 500 ms with move reset (up to 15 resets, restored when the piece falls lower)
- Delayed auto-shift for held movement (150 ms / 35 ms on keyboard, 170 ms / 50 ms on touch)
- Guideline gravity curve: 1 row/s at level 1, speeding up every 10 lines up to ~20G at level 20
- Selectable start level (1–15), pause with a short READY/GO before resuming

### Scoring

| Action | Points (× level) |
| --- | --- |
| Single / Double / Triple | 100 / 300 / 500 |
| Four lines (**TEDDIS**) | 800 |
| T-spin (0 / 1 / 2 / 3 lines) | 400 / 800 / 1200 / 1600 |
| Mini T-spin (0 / 1 / 2 lines) | 100 / 200 / 400 |
| Back-to-back four-line or T-spin clear | ×1.5 |
| Combo | 50 × combo count |
| All clear (1 / 2 / 3 / 4 lines) | +800 / 1200 / 1800 / 2000 (3200 back-to-back) |
| Soft drop / hard drop | 1 / 2 per row |

## Controls

| Keyboard | Action |
| --- | --- |
| ← → | Move (hold to auto-shift) |
| ↓ | Soft drop |
| Space | Hard drop |
| ↑ or X | Rotate clockwise |
| Z | Rotate counter-clockwise |
| C or Shift | Hold |
| P or Esc | Pause / resume |
| R | Restart |
| M | Mute / unmute |
| Enter | Start from the menu |

On touch devices the game shows dedicated buttons (hold ◀ ▶ to slide). The
board also accepts gestures: tap to rotate, drag to move or soft drop, flick
down to hard drop and flick up to hold.

The best score and settings (sound, visual effects, start level) are stored in
`localStorage`. Visual effects default to reduced when the system asks for
reduced motion, and can be toggled in the menus.

## Development

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm start          # serve the production build
npm run lint
npm run typecheck
npm test           # engine unit tests (Vitest)
```

## Deployment

The project deploys to [Vercel](https://vercel.com) with zero configuration:
import the repository (framework preset **Next.js**) and deploy. The page is
fully static and needs no environment variables.

## Architecture

```
app/          Next.js App Router entry: layout, page, global styles, icons, manifest
components/   React UI: layouts, board canvas, HUD panels, overlays, touch controls
game/         Framework-free engine: pieces, SRS kicks, collision, 7-bag, scoring, input (DAS/ARR)
hooks/        React bindings: store selector, layout mode and touch detection
lib/          Runtime glue: game controller (loop, input routing), canvas renderer, audio, storage
```

- `game/engine.ts` owns the rules and the clock. It is pure TypeScript, driven
  by `update(dt)` and action methods, and fully unit tested in `game/__tests__`.
- `lib/controller.ts` runs a single `requestAnimationFrame` loop, routes keyboard
  and touch input, and exposes a snapshot store consumed with
  `useSyncExternalStore`, so React only re-renders when HUD values change.
- `lib/renderer.ts` draws the playfield on a canvas using pre-rendered block
  sprites and cached layers; effects never block input.
- Sound effects are synthesized with the Web Audio API — there are no audio files.

## Credits

TEDDIS uses original branding, artwork and sounds. Fonts: Oxanium and
JetBrains Mono (SIL Open Font License), self-hosted at build time by `next/font`.
