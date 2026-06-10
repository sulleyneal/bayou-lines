# Bayou Lines

A slow, no-fail fishing game set on north Louisiana water. Cast, wait,
feel the bite, and work a gentle fight to the bank. Earn Bayou Bucks,
upgrade your tackle, travel from a retention pond to the coastal marsh,
fill the Field Guide, and do favors for the regulars down at the
landing. There are no timers that punish and no way to lose. It's a porch.

**Play now:** https://sulleyneal.github.io/bayou-lines/

## What's in it

- **Hand-drawn fish** — every species and legendary is illustrated
  procedurally (`fishart.js`): gradient-shaded bodies, fins, patterns,
  barbels, snouts, tail spots, gold-rimmed legendaries.
- **The cast & the fight** — tap to cast, set the hook on the bite, then
  hold to reel — or just watch, it lands either way. "Let it run" surges,
  splash particles, screen-shake on a trophy, and haptics. Never a loss.
- **Photo mode** — turn any catch into a shareable card (the fish over
  the location scenery) via the native share sheet.
- **The Camp** — a home base you build from a folding chair to a full
  compound, decorate, and hang your trophy wall on.
- **Daily challenges** — a seeded challenge each day, a login streak, and
  a featured "hot bite" location that pays extra.
- **Nine locations** from the Neighborhood Pond to Grand Isle / Venice,
  each with its own water, fish, junk, palette, and idle flavor.
- **Economy & tackle shop** — four upgrade tracks (rod, line, lure, boat)
  that change reel timing, break resistance, the catch table, and where
  you can go.
- **Day/night + weather + seasons** — a ~20-minute day, rolling weather
  (the pre-front bite is the best), and seasons that track your real-world
  month, all shifting the scene and the bite.
- **The Field Guide** — a record card for every fish and legendary, with
  silhouettes that ink in as you log them.
- **The Landing** — bank regulars post easygoing bounties for bucks.
- **The trotline** — set it before you leave; it lands a few while you're
  gone (needs a boat).
- **The Tackle Box** — 28 achievements with dry, Louisiana-flavored names.

## Install it (phone or desktop)

It's a PWA. Open the link, then **Share → Add to Home Screen** (iOS) or
**Install app** (Android/Chrome). It gets its own icon and plays offline.

## Run / develop locally

Double-click **`index.html`** — no server, no build step, works offline.
Progress saves to the browser automatically.

| File | What's in it |
|------|--------------|
| `index.html` | structure + overlay panels + PWA tags |
| `styles.css` | the dusk look — Fraunces + IBM Plex Mono |
| `data.js` | **all content**: locations, species, junk, equipment, achievements, weather, seasons, characters, bounties, camp, dailies, tuning |
| `game.js` | the loop, economy, travel, day/night, weather, fight, guide, bounties, camp, dailies, photo mode, achievements |
| `fishart.js` | procedural SVG fish illustrator |
| `campart.js` | procedural SVG camp scene |
| `audio.js` | generative ambient + cues (Web Audio, no dependency) |
| `sw.js` / `manifest.webmanifest` | offline + installable |
| `validate.js` | dev tool: `node validate.js` checks `data.js` for dangling refs |

Almost everything you'd want to tweak lives in `data.js`. Run
`node validate.js` after content edits. Deploys are automatic: any
`git push` to `master` rebuilds the GitHub Pages site in a minute or two.
