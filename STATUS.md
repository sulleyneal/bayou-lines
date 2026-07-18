# Bayou Lines — build status

Goal: take Bayou Lines from a very good personal project to the best slow
fishing game on the open web. Working the loop: **build → check → find the
biggest gap → close it → repeat.** House rules (the chill covenant, the voice,
the vanilla stack, content-in-data, sacred saves, stays-fast) are invariants.

Branch: `claude/bayou-lines-polish-ea64gv` (this is the "v3" work branch).
Deploys: merge to `master` (auto-deploys to Pages) only after a fresh checker
signs off.

---

## The three gaps I'm closing

1. **The first ten minutes leak** — tier-0 lure had a flat 22% junk chance on
   every cast, so a new player's first fish wasn't guaranteed fast; the reason
   to come back was buried in a panel.
2. **Week two runs thin** — a dedicated player sees most systems inside a week.
3. **After the Gray Ghost, the arc stops** — no multi-week postgame pursuit.

Plus a running **graphics-quality** thread (owner asked to improve the look).

---

## Shipped

### Cycle 1 — Cold open + save v2→v3 migration + graphics pass 1 ✅ (verified)
- **First-fish grace.** A brand-new player's opening casts bite fast and land
  clean — no junk, no break-off, no wandering ghost — so the first fish is a
  *fish*, well under 90s (measured: **~4.3s**). Fades after 3 catches. Nothing
  announces it; nothing punishes its absence.
- **Hold-to-reel coach.** The first fight ever pulses the button and spells out
  "press and hold to reel." Retires permanently once you've landed one.
- **Daily chip.** An always-visible, tappable pill (`📅 Land 5 panfish · 🔥N`)
  — the reason to come back tomorrow, now *shown* on the main screen, not buried
  in Jobs. Plus a one-time toast that *states* it ("come back tomorrow — a fresh
  challenge & a streak, daily · miss one, no harm").
- **Save migration v2→v3.** Versioned, lossless, write-through on load. A real
  captured pre-change save (55 catches, 4,200 ₿, PB 11.2 lb, camp t2, streak 4,
  6 achievements, story flags) loads with **every field intact** — verified 17/17.
- **Graphics pass 1.** Cinematic vignette, an atmospheric horizon-haze band so
  the waterline reads as a lit horizon, a sun with a real corona, and grounding
  belly-shadow on the procedural fish so bodies look round, not flat.

Verification: `test/verify-c1.js` (headless) — 17/17 (cold-open timing, first
card is a fish, coach appears, chip shown; migration field-by-field).
`node validate.js` clean.

---

## Biggest known gap right now

Week-two depth (Cycle 2): there's still little that *first appears* around day
14. Next: a per-species size-grade mastery layer (turns "caught it once" into a
long, gentle chase), new in-voice content, and a weekly landing beat that
rotates independent of the real-world season.

## Next up
- Cycle 2 — mastery layer + new content + weekly beat
- Cycle 3 — postgame (hidden 10th water, Master Angler ledger, post-Ghost legends)
- Ongoing — Lighthouse PWA + frame-pacing measurement, extend `validate.js`,
  fresh checker each cycle before merge.
