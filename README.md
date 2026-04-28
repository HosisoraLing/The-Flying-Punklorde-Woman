# The Flying Punklorde

An Honkai: Star Rail themed Flappy Bird game featuring Silver Wolf.

## How to Play

Open `index.html` in a browser. Click or tap to flap and avoid pipes.

## Features

- **Silver Wolf as the protagonist** — pixel art style, auto-shooting blue ray bullets
- **Boss battle at score 76** — Herta (黑塔) appears with her puppet army
- **Dialogue system** — JSON-driven story scenes between Silver Wolf and Herta
- **Power-ups** — hearts, bullet time, laser weapon, bullet split, bullet tracking
- **Boss mechanics** — laser beams with telegraph warnings, diamond bullets, puppet spawns
- **Half-heart HP system** — 3 hearts total, laser deals 1 heart, diamond deals half
- **Sound effects** — synthesized via Web Audio API
- **Leaderboard** — local score tracking
- **Responsive** — works on desktop and mobile

## Boss Fight

At score 76, the game transitions into a boss battle:

1. WARNING banner appears, pipes stop spawning
2. Silver Wolf moves to center screen
3. Herta descends from above
4. Dialogue scenes play out
5. Battle begins — dodge lasers, destroy puppets, take down Herta (300 HP)

## Controls

- **Click / Tap / Space** — Flap
- **P** — Pause
- **M** — Mute

## Tech

Single-file HTML5 Canvas game. No dependencies. Pure JavaScript with Web Audio API for sound.

## License

Fan-made game. Honkai: Star Rail characters belong to HoYoverse.
