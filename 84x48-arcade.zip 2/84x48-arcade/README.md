# 84x48 Arcade

Six original pocket games drawn on an 84 by 48 pixel monochrome LCD, the grid early mobile phones used. Built with vanilla JavaScript and Canvas: no dependencies, no build step.

## Games

| Game | Goal |
| --- | --- |
| Snake | Eat, grow, avoid the walls and your own tail |
| Bricks | Clear the wall with three lives |
| Blaster | Auto-firing ship against an incoming swarm |
| Pairs | Match nine pairs in the fewest moves |
| Racer | Change lanes as traffic speeds up |
| 2P Duel | Two-player paddle duel over a 4-digit room ID, first to five |

## Controls

| Input | Action |
| --- | --- |
| Arrows / WASD | Move |
| Enter / Space | OK, start, launch, flip |
| Esc / Backspace | Back to the menu |
| M | Sound on or off |

On touch screens, use the keys under the handset screen.

## Multiplayer

2P Duel connects two browsers peer-to-peer with [PeerJS](https://peerjs.com) (WebRTC), loaded on demand from unpkg. One player picks **Host a game** and shares the 4-digit ID; the other picks **Join with ID**. The host runs the simulation and streams state; the guest sends paddle input. It needs the page to be served over HTTPS (GitHub Pages is fine) and uses the free public PeerJS broker for the handshake.

## Feedback

The feedback form has no backend: it builds an email draft (rating, game, message) addressed to the maintainer, with a copy-to-clipboard fallback.
## How it works

- `game.js` keeps an 84x48 one-bit framebuffer and paints it to a canvas as individual LCD pixels.
- A fixed 30 ticks-per-second loop drives every game; each game is a small factory returning `update()` and `draw()`.
- Text uses a hand-made 3x5 pixel font.
- Best scores are stored in `localStorage`.

## Note

All games are original code written for this project. No ROMs, emulation, or assets from any handset maker are used.
