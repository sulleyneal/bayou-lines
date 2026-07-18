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

### Full-bar checker — all 7 done-bar items PASS ✅
A fresh-context checker tried to fail the whole bar and could not:
- **Cold open** first fish **4.15s**; delight + a shown/stated reason to return.
- **Week two** new-after-day-7 content confirmed (Baptiste + a weekly beat that
  rotates by calendar week; grades give an ongoing chase).
- **Postgame** the swamp is hidden pre-Ghost / revealed after; the Master
  Angler's Book is a genuine multi-week pursuit.
- **Migration** 23/23 fields intact, re-stamped v3, zero errors.
- **Performance** frame pacing under 4× CPU throttle **median 33ms / worst 133ms**
  (4.7% of frames >50ms); payload **~116 KB gzipped**; PWA installs + plays offline.
- **Voice** 0 of 20 sampled strings read generic.
- **Regressions** 0 uncaught exceptions, 0 SVG-NaN across all 43 fish + 10 panels.

Follow-up polish shipped from its one note + a self-caught leak:
- **Fish-art SVG cache** — art is deterministic per (ref,size), so it's generated
  once and reused. Removes the 100–133ms catch-card hitch on weak phones and
  speeds the 31-row ledger / Field Guide.
- **Guide spoiler fix** — the swamp's species also live in pre-Ghost waters, so
  the Field Guide's "found in:" line had begun naming *Honey Island Swamp* before
  the reveal. Ghost-gated location names are now hidden until you've met him.

## ✅ The done-bar is MET — confirmed by a second independent fresh checker
Two fresh-context checkers, in sequence, tried to fail the whole bar and could
not. Confirming run: cold-open first fish **4.3s**; week-two reveal (Baptiste +
a weekly that rotates on a 7-week cycle, nothing new on day 1); postgame swamp
hidden→revealed + a 31-species Master Angler book "meant to outlast a few
seasons"; migration re-stamped v3 with every field intact and no swamp-name leak
in Travel *or* the Guide; perf under 4× CPU throttle **median 16.7ms / worst
83.3ms / 0.2% frames >50ms**, installs + plays **offline**; voice **0 generic**;
**zero** uncaught exceptions or SVG-NaN across all 43 fish and 10 panels.

The checker's read: "the real ceiling on this build is visual, not behavioral."

### Cycle 4 — Graphics pass 2 ✅ (verified, checker pending)
Addressing the checker's ranked art notes; fish art first (the hero of every
card, Guide row, and photo).
- **Fish art.** Replaced the "googly" white-dot eye with a real one — dark ring,
  tinted amber iris, black pupil, a single catchlight — and added a gill-plate
  seam, faint scale texture on scaled species, and a stronger dorsal gloss that
  reads as a lit top edge. All 43 fish still render NaN-free.
- **Water + light.** The sun now casts a broken, shimmering reflection column on
  the water; richer animated caustics; soft golden light-shafts in the sky; and a
  low mist band drifting along the waterline. The catch card and scene look
  markedly more alive.

A fresh graphics checker confirmed both improvements landed ("real fish eye, not
googly"; "water reads as water now"), perf held (Master Angler panel 26ms, Guide
27ms; frame pacing median 16.7ms, 0.8% >50ms under 4× throttle), and found zero
regressions / NaN / exceptions. Its one nit — the sun-glitter column sat ~8%
left of the sun and read as a hard "searchlight bar" — is now fixed: the
reflection is a tapered glitter wedge, aligned under the sun, narrow at the
horizon and spreading toward the viewer, with soft scattered highlights instead
of stripes. Verified in-pixel.

Verification: all three suites still green (17/17, 9/9, 12/12); zero console
errors; `node validate.js` clean. Art is memoized, so the detail doesn't
re-rasterize per frame.

## Biggest known gap right now
The bar is met and the two headline art notes (fish, water) are addressed and
checker-approved. Remaining polish for a possible pass 3, only if a checker
still faults the pixels: more distinct per-species silhouettes, per-location
midground props/identity, and a fuller HUD hierarchy.
