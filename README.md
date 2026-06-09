# Bayou Lines

A slow, no-fail fishing game set on north Louisiana water. Cast, wait,
reel on the bite. Earn Bayou Bucks, upgrade your tackle, work your way
from a retention pond to the coastal marsh, and fill the Tackle Box.
There are no timers that punish and no way to lose. It's a porch.

## Run it

Double-click **`index.html`**. No server, no build step, no install.
Works offline. Your progress saves to the browser automatically.

> If you want sound, click once first — browsers won't start audio
> until you interact with the page.

## Files

| File         | What's in it |
|--------------|--------------|
| `index.html` | page structure + overlay panels |
| `styles.css` | the dusk look — Fraunces + IBM Plex Mono, translucent panels |
| `data.js`    | **all content**: locations, species, junk, equipment, achievements, tuning. Edit freely. |
| `game.js`    | the loop, economy, travel, day/night, achievements |
| `audio.js`   | generative ambient + cues (Web Audio API, no dependency) |
| `validate.js`| dev tool: `node validate.js` checks `data.js` for dangling refs |

## Tweaking

Almost everything you'd want to change lives in `data.js`:

- **Add a fish** — drop an entry in `S` (or `L` for a legendary) and list
  its `ref` in a location's `species`.
- **Retune the economy** — `value` per species, `price` per equipment tier,
  unlock `bucks`/`boatTier`/`milestone` per location.
- **Speed up the sky** — `CONFIG.dayLengthMs` (default 20 min). Set it low
  to watch a full day/night loop in a minute.

Run `node validate.js` after content edits to make sure every reference
still resolves.
