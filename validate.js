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
console.log(`locations:${D.LOCATIONS.length} species:${Object.keys(D.S).length} legendaries:${Object.keys(D.L).length} junk:${Object.keys(D.JUNK).length} achievements:${D.ACHIEVEMENTS.length}`);
console.log(errs.length ? "ERRORS:\n" + errs.join("\n") : "OK — all refs resolve.");
process.exit(errs.length ? 1 : 0);
