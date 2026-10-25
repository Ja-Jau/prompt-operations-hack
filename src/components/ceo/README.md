# POV: You are the CEO

Both CEO prototypes are hidden from the public app. There is no CEO navigation
entry or public route, and `AppShell.tsx` imports neither prototype.

`CeoGame.tsx` preserves the navy-and-blue decision-card game, with five decisions,
a 20-second timer and the Velho-focused results screen.

The FPS experiment is preserved as `CeoFpsGame.tsx`, `OfficeWorld.tsx`,
`office-engine.ts`, `office.css` and `src/lib/ceo/day.ts`. It has no public
route, navigation entry or import from the visible game. Its Three.js and Rapier
code is therefore outside the active application import graph. To resume work on
it, explicitly wire `CeoFpsGame` into a development entry point.

## Preserved FPS experiment

A five-minute first-person office day. `CeoFpsGame.tsx` owns the itinerary, timed
three-choice conversations, pause state and results. `OfficeWorld.tsx` loads the
browser-only renderer on demand; `office-engine.ts` builds the office with
Three.js and runs Rapier physics at a fixed 60 Hz. These libraries are retained as dependencies for the hidden experiment;
the public app does not load them.

The player starts at reception and receives seven appointments across Finance,
Operations, the café and the boardroom. `src/lib/ceo/day.ts` sets their release
and expiry times. Unanswered appointments count as missed; the day ends after
300 active seconds. Each conversation allows up to 20 seconds, capped by the
appointment deadline. The clock pauses in the pause menu and when the page is
hidden. Answers and feedback do not stop the workday.

Desktop: WASD to walk, mouse to look, Shift to sprint, Space to jump, E to talk,
open doors, pick up or drop a carton; F to throw; M to expand the floor plan;
Escape to pause. Arrow keys provide movement and turning when mouse capture is
unavailable. Touch devices have a movement stick, drag-to-look and action buttons.

The office includes glass partitions and movable doors, furnishing collision,
character gravity and ground snapping, dynamic cartons with friction, restitution
and continuous collision detection, a coffee machine, inspectable notes, walking
colleagues, a city skyline and a boardroom presentation. Geometry, materials and
textures are built locally; no external model or texture service is required.
Sound is opt-in. Reduced motion disables camera bob. WebGL2 and WebAssembly are
required; a startup or context failure presents a retry and another-game option.
NPCs follow simple room/doorway routes; this is an office simulation with stylised
characters, not a photorealistic character or dialogue system.
