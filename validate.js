/* Dev tool: `node validate.js` — checks data.js content for dangling refs.
   Not loaded by the game. Just a sanity net for content edits. */
global.window = {};
require("./data.js");
const D = window.DATA;
const errs = [];
for (const l of D.LOCATIONS) {
  for (const s of l.species) if (!D.S[s.ref]) errs.push(`${l.id}: missing species ${s.ref}`);
  for (const s of (l.legendaries || [])) if (!D.L[s.ref]) errs.push(`${l.id}: missing legendary ${s.ref}`);
  for (const k of l.junk) if (!D.JUNK[k]) errs.push(`${l.id}: missing junk ${k}`);
  if (l.unlock && l.unlock.milestone && !D.LOCATIONS.find(x => x.id === l.unlock.milestone.at))
    errs.push(`${l.id}: bad milestone.at ${l.unlock.milestone.at}`);
}
for (const e of D.EQUIPMENT.boat) if (typeof e.tier !== "number") errs.push(`boat tier missing: ${e.name}`);
// new content structures
const known = k => D.S[k] || D.L[k];
(D.SEASONS || []).forEach(s => Object.keys(s.bias || {}).forEach(k => { if (!known(k)) errs.push(`season ${s.id}: bad bias ref ${k}`); }));
(D.BOUNTY_TEMPLATES || []).forEach(b => {
  if (!D.CHARACTERS[b.giver]) errs.push(`bounty ${b.id}: unknown giver ${b.giver}`);
  (b.group || []).forEach(k => { if (!known(k)) errs.push(`bounty ${b.id}: bad species ref ${k}`); });
});
(D.WEATHER || []).forEach(w => { if (typeof w.biteSpeed !== "number") errs.push(`weather ${w.id}: missing biteSpeed`); });
// size grades: ascending mins, first must start at 0
(D.GRADES || []).forEach((g, i, a) => {
  if (i === 0 && g.min !== 0) errs.push("grades: first grade must start at min 0");
  if (i > 0 && g.min <= a[i - 1].min) errs.push(`grade ${g.id}: min not ascending`);
});
const GRADE_IDS = new Set((D.GRADES || []).map(g => g.id));
// weekly happenings: perk species refs resolve, payBias has a mult
(D.WEEKLY || []).forEach(w => {
  if (w.payBias) {
    if (typeof w.payBias.mult !== "number") errs.push(`weekly ${w.id}: payBias.mult missing`);
    (w.payBias.group || []).forEach(k => { if (!known(k)) errs.push(`weekly ${w.id}: bad payBias ref ${k}`); });
  }
});
// runs: species + location refs resolve
(D.RUNS || []).forEach(r => {
  (r.group || []).forEach(k => { if (!known(k)) errs.push(`run ${r.id}: bad ref ${k}`); });
  (r.locs || []).forEach(id => { if (!D.LOCATIONS.find(l => l.id === id)) errs.push(`run ${r.id}: bad loc ${id}`); });
});
// bounty templates: grade kind names a real grade; need flag is recognized
(D.BOUNTY_TEMPLATES || []).forEach(b => {
  if (b.kind === "grade" && !GRADE_IDS.has(b.grade)) errs.push(`bounty ${b.id}: unknown grade ${b.grade}`);
  if (b.need && b.need !== "metBaptiste") errs.push(`bounty ${b.id}: unknown need ${b.need}`);
});
// story + ghost beats reference real characters
[...(D.STORY || []), D.GHOST && D.GHOST.ready, D.GHOST && D.GHOST.nearMiss, ...((D.GHOST && D.GHOST.finale) || [])]
  .filter(Boolean).forEach(s => { if (!D.CHARACTERS[s.who]) errs.push(`beat ${s.id}: unknown who ${s.who}`); });

// Fish art must produce clean SVG for every species/legendary — a malformed
// body path (NaN coords) renders wrong AND spams the console, so catch it here.
// FishArt.svg is pure string math (no DOM), so it runs fine under node.
try {
  require("./fishart.js");
  const FA = window.FishArt;
  if (FA) {
    const known = k => D.S[k] || D.L[k];
    FA.refs().forEach(ref => {
      const s = FA.svg(ref);
      if (!s) errs.push(`fishart ${ref}: svg() returned nothing`);
      else if (/NaN|undefined/.test(s)) errs.push(`fishart ${ref}: bad SVG (NaN/undefined coords)`);
      if (!known(ref)) errs.push(`fishart ${ref}: art for a species not in S/L`);
    });
    // every catchable species/legendary should have art (silhouettes need it)
    [...Object.keys(D.S), ...Object.keys(D.L)].forEach(k => {
      if (!FA.has(k)) errs.push(`fishart: missing art for ${k}`);
    });
  } else errs.push("fishart: window.FishArt not exposed");
} catch (e) { errs.push("fishart: threw — " + e.message); }
console.log(`locations:${D.LOCATIONS.length} species:${Object.keys(D.S).length} legendaries:${Object.keys(D.L).length} junk:${Object.keys(D.JUNK).length} achievements:${D.ACHIEVEMENTS.length}`);
console.log(errs.length ? "ERRORS:\n" + errs.join("\n") : "OK — all refs resolve.");
process.exit(errs.length ? 1 : 0);
