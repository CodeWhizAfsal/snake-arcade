# Snake Arcade

Modern Snake reimagined as a responsive browser game with smooth continuous movement, glowing canvas visuals, themed presentation, mobile swipe input, bonus pickups, obstacles, and a polished intro experience.

## Overview

This project started as a classic Snake implementation and evolved into a more modern arcade-style web game:

- Continuous snake motion instead of block-by-block tile jumps
- Curved glowing snake body rendered on `canvas`
- Multiple maps with obstacle layouts
- Adjustable difficulty and visual themes
- Responsive intro screen and mobile-friendly controls
- Persistent high score, sound toggle, and light/dark mode

The game runs directly in the browser with no frontend framework and no external runtime dependencies beyond a local static server.

## Features

### Gameplay

- Smooth snake steering with directional input
- Regular food that increases score and snake length
- Bonus food that appears after every fourth food
- Bonus value that decays over time if ignored
- Game over on wall, self, or obstacle collision
- Pause, restart, and replay flow

### Maps

- `Classic Stream`
  Open playfield tuned for flow
- `Gate Run`
  Twin barrier lanes with tight passageways
- `Cross Roads`
  Central cross-style obstacle layout
- `Pulse Pillars`
  Floating circular obstructions in open space

### Difficulty

- `Easy`
  Slower movement and gentler turning
- `Medium`
  Balanced default experience
- `Hard`
  Faster speed and sharper reactions required

### Presentation

- Full-screen landing scene with layered game-style UI
- Glassmorphism panels and animated background treatment
- Modern game-inspired fonts: `Orbitron` + `Rajdhani`
- Theme selector: `Classic`, `Neon`, `Retro`
- Light/dark appearance toggle
- Canvas particle effects and glow styling

### UX

- Keyboard controls for desktop
- Swipe controls for touch devices
- On-screen buttons for mobile fallback
- Local high score persistence with `localStorage`
- Lightweight sound effects via Web Audio
- Haptic feedback support where available

## Project Structure

```text
.
|-- index.html
|-- styles.css
|-- package.json
|-- src/
|   |-- game.js
|   `-- main.js
`-- tests/
    `-- run-tests.js
```

### Key Files

- [index.html](./index.html)
  App shell, intro screen, HUD, overlays, and controls
- [styles.css](./styles.css)
  Visual system, layout, intro scene styling, and responsive rules
- [src/game.js](./src/game.js)
  Core simulation:
  continuous movement, turning, collisions, food placement, maps, bonus cycle
- [src/main.js](./src/main.js)
  Canvas rendering, input handling, audio, particles, UI state, and persistence
- [tests/run-tests.js](./tests/run-tests.js)
  Logic verification for movement, collisions, bonus behavior, and placement rules

## How to Run

### Option 1: Python static server

From the project directory:

```bash
python -m http.server 4173
```

Then open:

[http://localhost:4173](http://localhost:4173)

### Option 2: npm script

```bash
npm start
```

This uses the same Python static server under the hood.

## Controls

### Desktop

- `Arrow keys` to steer
- `W A S D` to steer
- `Space` to pause/resume

### Mobile / Touch

- Swipe on the game board to change direction
- Use on-screen directional buttons as fallback

## Testing

Run the test suite with:

```bash
node tests/run-tests.js
```

Or:

```bash
npm test
```

The tests currently cover:

- Continuous forward motion
- Smooth turning behavior
- Growth when food is eaten
- Map and difficulty switching
- Wall and obstacle collision
- Safe item placement
- Trail trimming logic
- Bonus food spawn and decay
- Bonus score collection

## Design Notes

The visual direction aims for a lightweight arcade aesthetic:

- Deep dark base with neon accents
- Soft glow and blur instead of heavy borders
- Floating intro layout rather than a form-like start page
- Curved snake body to avoid the old square-block look

The current renderer uses `canvas` instead of DOM cells so the snake can feel fluid and alive.

## Technical Notes

- No React or build tooling required
- No extra gameplay libraries
- `requestAnimationFrame` drives rendering
- Simulation advances on fixed ticks based on chosen difficulty
- High score and user preferences are stored in `localStorage`

## Possible Next Steps

- Add screenshots or a gameplay GIF to the README
- Add a live demo via GitHub Pages
- Introduce spline-based body tapering for an even smoother snake
- Add a leaderboard or daily challenge mode
- Add subtle background particles behind the intro scene

## License

No license file has been added yet. If you plan to share or reuse the project publicly, consider adding an explicit license such as MIT.
