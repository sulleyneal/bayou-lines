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

**Fresh-context checker ran and passed all four claims** (cold open 4.6s, saves
22/22 fields intact, graphics look good, no regressions / zero uncaught errors).
It found two real defects, both now fixed:
- **Fish-art `NaN` (pre-existing, since the original art commit).** Every fish
  body path emitted `NaN` because the archetype `belly` *bulge ratio* collided
  with the per-species `belly` *color* through `Object.assign` — 156 console
  errors/session, and it silently broke this cycle's belly-shadow. Renamed the
  archetype field to `bulge`. Now **0 NaN, 0 console errors** across all 33 fish,
  and the bodies actually render round. `validate.js` now asserts clean fish SVG
  so this blind spot can't reopen.
- **Double-"today"** in the new-day line ("Today: land 5 panfish today") — fixed.

---

### Cycle 2 — Mastery layer + new content + weekly beat ✅ (verified, checker pending)
- **Size grades.** Every fish is graded against its *own* size band — a dink,
  a keeper, a good'un, a trophy, or a wall-hanger — so a giant bluegill outranks
  a dinky bass. Derived purely from `records[key].max` (zero new save state, so
  old saves get grades for free). The Field Guide shows your best grade + the
  weight the next grade takes ("a trophy runs 1.2 lb+"); the catch card calls out
  "▲ your best yet — a trophy" when you beat your size for a species. Turns
  "caught it once" into a weeks-long, no-pressure chase. Four new achievements
  (wall-hanger, a trophy-of-8, a good'un-of-20, the rough-fish trio).
- **New content.** Eight new in-voice species (warmouth, yellow bass, brown
  bullhead, smallmouth buffalo, common carp, chain pickerel, paddlefish/spoonbill,
  striped mullet) with two new fish-art archetypes (`pike`, `paddle`), spread
  across every water; two new seasonal runs (spring spoonbill rise, summer rough
  fish). All render clean (validated).
- **Weekly beat + a new regular.** Nonc Baptiste arrives around week two and
  opens "this week at the landing" — a happening that rotates by the *calendar
  week*, independent of the real-world season, so day 14 shows something day 7
  didn't (Fish-Fry Week, the Bream Are Bedding, High Water, Parish Cleanup…).
  Perks are upside-only (per the chill covenant) and gated behind meeting him.
  He also posts rough-fish and "catch a real trophy" bounties.

Verification: `test/verify-c2.js` — 9/9 (grades in the Guide, next-grade nudge,
the weekly banner, the grade-upgrade note in live play, zero console errors).
`test/verify-c1.js` still 17/17 (migration unaffected). `node validate.js` clean
(now also checks grades ordering, weekly/run refs, grade bounties, beat authors).

---

### Cycle 3 — Postgame: 10th water + Master Angler ledger + post-Ghost legends ✅ (verified, checker pending)
- **A hidden 10th water — Honey Island Swamp.** Off the map entirely until you've
  stood with the Gray Ghost; then Boudreaux lets you in on where he came from and
  it appears (a reveal, not a greyed-out teaser). Its own black-water palette and
  mossy-cypress scenery, a "greatest hits of the weird" roster (gars, flathead,
  buffalo, spoonbill, pickerel), and two post-Ghost legends: **the Honey Island
  Haint** (a pale kin of the Ghost) and **the Honey Island Monster** (the swamp
  cryptid, briefly "met" and released — a 🐾 gag in the voice).
- **The Master Angler's Book.** The postgame long arc: land a *wall-hanger* of
  every one of the 31 species — built entirely on the Cycle-2 grade system, so it
  costs no new save state beyond the milestones paid. A new panel shows your
  progress and, for each fish, the exact weight a wall-hanger takes ("Alligator
  Gar needs 86.0 lb+ · best 20 lb"), with the biggest gaps sorted to the top.
  Milestone rewards at 5/10/20; finishing the whole book makes you a Master
  Angler (10k ₿ + a gilded photo frame on every future catch). Baptiste hands you
  the book after the Ghost. Six new achievements.

Verification: `test/verify-c3.js` — 12/12 (swamp hidden pre-Ghost / revealed
post-Ghost, travel + fish it clean, Haint art clean, ledger display + sort +
completion → Master Angler flag). C1 17/17 and C2 9/9 still green (no regression).
`node validate.js` clean (10 waters, 31 species, 12 legendaries, 43 achievements).

---

## Biggest known gap right now

All three headline gaps (cold open, week two, postgame) now have shipped systems.
Next pass: **prove the whole bar end-to-end** — a Lighthouse PWA audit, measured
frame pacing through a full cast-fight-land on a throttled mobile profile, and a
fresh cold→day-14→postgame checker playthrough — then close whatever it finds.

## Next up
- Merge Cycle 3 after its checker passes.
- Ongoing — Lighthouse PWA + throttled frame-pacing measurement; a full-bar
  checker sweep; polish whatever it surfaces.
