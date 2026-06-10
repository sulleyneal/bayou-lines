/* ============================================================
   BAYOU LINES — game.js
   The loop: cast → wait → nibble → bite → reel. No fail state.
   Content comes from data.js (window.DATA). Grows by step.
   ============================================================ */
(function () {
  "use strict";
  const D = window.DATA;
  const $ = id => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  /* ---------- STATE ---------- */
  const state = {
    phase: "idle",                 // idle | waiting | nibble | bite (transient, not saved)
    locationId: "pond",            // everybody starts at the pond
    unlocked: ["pond"],
    bucks: 0,
    equip: { rod: 0, line: 0, lure: 0, boat: 0 },
    stats: {
      catches: 0, junk: 0, pb: 0, pbName: "", perLoc: {},
      species: {},      // ref -> count
      junkKinds: {},    // junk key -> count
      locSpecies: {},   // locId -> { ref: true }  (for As-Built)
      bountiesDone: 0,
    },
    caught: {},         // ref -> true (species + legendaries ever landed)
    records: {},        // ref -> { max, count, firstLoc, lastTs }  (Field Guide)
    legends: {},        // legendary ref -> true
    flags: {},          // nightCat, goldenBass, asBuilt, firstSalt
    achievements: [],   // unlocked ids
    bounties: [],       // active bounty instances from The Landing
    camp: { tier: 0, decor: {} }, // home base + decor
    daily: { date: "", streak: 0, lastDay: "" }, // daily challenge + streak
    trotline: { set: false, ts: 0 }, // opt-in idle line
    log: [],
    settings: { muted: false, volume: 0.6 },
  };

  /* ---------- PERSISTENCE ----------
     Everything but the transient `phase` is saved. Loading deep-merges
     onto defaults so old saves survive new fields in future versions. */
  const SAVE_FIELDS = ["locationId", "unlocked", "bucks", "equip", "stats",
    "caught", "records", "legends", "flags", "achievements", "bounties", "camp", "daily", "trotline", "log", "settings"];
  let saveLocked = false; // true during reset, so nothing re-saves stale data

  function save() {
    if (saveLocked) return;
    try {
      const snap = { v: 2 };
      SAVE_FIELDS.forEach(k => { snap[k] = state[k]; });
      localStorage.setItem(D.CONFIG.saveKey, JSON.stringify(snap));
    } catch (e) { /* private mode / quota — game still works in-session */ }
  }

  function deepMerge(target, src) {
    if (!src || typeof src !== "object") return;
    for (const k in src) {
      const v = src[k];
      if (Array.isArray(v)) target[k] = v;
      else if (v && typeof v === "object") { target[k] = target[k] || {}; deepMerge(target[k], v); }
      else target[k] = v;
    }
  }

  function load() {
    let raw;
    try { raw = localStorage.getItem(D.CONFIG.saveKey); } catch (e) { return; }
    if (!raw) return;
    try {
      const snap = JSON.parse(raw);
      SAVE_FIELDS.forEach(k => { if (snap[k] !== undefined) deepMerge(state, { [k]: snap[k] }); });
    } catch (e) { /* corrupt save — start fresh rather than crash */ }
  }

  function hardReset() {
    saveLocked = true;
    try { localStorage.removeItem(D.CONFIG.saveKey); } catch (e) {}
    location.reload();
  }
  let biteTimer = null, nibbleTimer = null, missTimer = null, idleTicker = null;
  let bobberPos = { x: 0, y: 0 };

  const scene = $("scene"), water = $("water"), bobber = $("bobber"),
        line = $("line"), msg = $("message"), btn = $("actionBtn");

  /* ---------- AUDIO BRIDGE ---------- */
  let audioOn = false;
  function ensureAudio() {
    if (audioOn || !window.BayouAudio) return;
    audioOn = true;
    window.BayouAudio.unlock();
    window.BayouAudio.setVolume(state.settings.volume);
    window.BayouAudio.setMuted(state.settings.muted);
    window.BayouAudio.setLocationMix(!!loc().coastal);
  }
  function sfx(name) { if (audioOn && window.BayouAudio && window.BayouAudio[name]) window.BayouAudio[name](); }

  /* ---------- LOCATION ACCESS ---------- */
  function loc() { return D.LOCATIONS.find(l => l.id === state.locationId); }

  // Build the live catch table for the current location: species + legendaries.
  function catchTable() {
    const l = loc();
    const out = [];
    l.species.forEach(s => out.push({ def: D.S[s.ref], weight: s.weight }));
    (l.legendaries || []).forEach(s => out.push({ def: D.L[s.ref], weight: s.weight }));
    return out;
  }

  // Equipment accessors — single source of truth for current gear.
  function rod()  { return D.EQUIPMENT.rod[state.equip.rod]; }
  function lineG(){ return D.EQUIPMENT.line[state.equip.line]; }
  function lure() { return D.EQUIPMENT.lure[state.equip.lure]; }
  function boat() { return D.EQUIPMENT.boat[state.equip.boat]; }

  const CLASS_RANK = { common: 0, trophy: 1, legendary: 2 };

  function pickFish() {
    const table = catchTable();
    const lr = lure();
    const maxW = table.reduce((m, e) => Math.max(m, e.weight), 0);
    // Apply lure species-bias and a rarity tilt: rarer (lower base weight)
    // entries get nudged up as lures improve.
    const ph = phaseId;
    const seasonBias = currentSeason().bias || {};
    const weatherBoost = weather ? weather.rarityBoost : 0;
    const weighted = table.map(e => {
      const k = refKey(e.def);
      let w = e.weight * (lr.bias[k] || 1) * (seasonBias[k] || 1);
      w *= 1 + (lr.rarityBoost + weatherBoost) * ((maxW - e.weight) / maxW);
      if (e.def.time && e.def.time.includes(ph)) w *= D.CONFIG.timeBiasMult; // bite better now
      return { def: e.def, w };
    });
    const total = weighted.reduce((s, e) => s + e.w, 0);
    let r = Math.random() * total;
    for (const e of weighted) { if ((r -= e.w) <= 0) return e.def; }
    return weighted[0].def;
  }

  // reverse-lookup a species/legendary key for lure bias matching
  function refKey(def) {
    for (const k in D.S) if (D.S[k] === def) return k;
    for (const k in D.L) if (D.L[k] === def) return k;
    return null;
  }

  function pickJunk() { const key = pick(loc().junk); return { key, def: D.JUNK[key] }; }
  function junkChance() { return lure().junkChance; }

  // Does this fish break off? Gentle by design: only big-for-your-gear fish,
  // and a heavier line forgives a lot. Wrong line class = it tests you and leaves.
  function breakOff(f, w) {
    if (CLASS_RANK[f.cls] > CLASS_RANK[lineG().maxClass]) return true;
    if (w <= rod().maxWeight) return false;
    const over = Math.min((w - rod().maxWeight) / rod().maxWeight, 0.9);
    return Math.random() < over * (1 - lineG().breakResist);
  }

  function payout(f, w) {
    const currentBonus = loc().current ? 1.15 : 1; // rivers pay a little extra
    const featBonus = (state.daily && state.daily.featured === state.locationId) ? 1.2 : 1; // today's hot bite
    return Math.max(1, Math.round(w * f.value * currentBonus * featBonus));
  }

  /* ---------- AMBIENT SCENERY ---------- */
  function scatter() {
    for (let i = 0; i < 7; i++) {
      const s = document.createElement("div"); s.className = "shimmer";
      s.style.left = (5 + Math.random() * 80) + "%";
      s.style.top = (15 + Math.random() * 75) + "%";
      s.style.width = (40 + Math.random() * 120) + "px";
      s.style.animationDelay = (Math.random() * 6) + "s";
      water.appendChild(s);
    }
    for (let i = 0; i < 14; i++) { // a few extra for the night crowd
      const f = document.createElement("div"); f.className = "firefly";
      f.style.left = (Math.random() * 92) + "%";
      f.style.top = (34 + Math.random() * 40) + "%";
      f.style.animationDelay = (Math.random() * 8) + "s, " + (Math.random() * 3) + "s";
      f.style.animationDuration = (10 + Math.random() * 10) + "s, " + (2.6 + Math.random() * 2) + "s";
      scene.appendChild(f);
    }
    for (let i = 0; i < 4; i++) {
      const p = document.createElement("div"); p.className = "lilypad";
      const sz = 16 + Math.random() * 22;
      p.style.width = sz + "px"; p.style.height = (sz * 0.62) + "px";
      p.style.left = (8 + Math.random() * 78) + "%";
      p.style.top = (40 + Math.random() * 48) + "%";
      p.style.transform = "rotate(" + (Math.random() * 60 - 30) + "deg)";
      water.appendChild(p);
    }
    const starWrap = $("stars");
    for (let i = 0; i < 60; i++) {
      const s = document.createElement("div"); s.className = "star";
      s.style.left = (Math.random() * 100) + "%";
      s.style.top = (Math.random() * 92) + "%";
      s.style.animationDelay = (Math.random() * 4) + "s";
      starWrap.appendChild(s);
    }
  }

  function ripple(x, y) {
    const r = document.createElement("div"); r.className = "ripple";
    r.style.left = x + "px"; r.style.top = y + "px";
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 1700);
  }

  // decorative fish cruising under the surface
  const FISH_SVG = '<svg viewBox="0 0 44 18" aria-hidden="true"><path d="M3 9 Q13 1 28 5 Q37 7 41 9 Q37 11 28 13 Q13 17 3 9 Z"/><path d="M28 5 L40 1 L37 9 L40 17 L28 13 Z"/></svg>';
  function spawnSwimmer() {
    if (document.hidden) return;
    const s = document.createElement("div");
    s.className = "swimmer" + (Math.random() < 0.5 ? " l" : "");
    s.style.top = (28 + Math.random() * 55) + "%";
    s.style.width = (28 + Math.random() * 26) + "px";
    s.style.opacity = (0.10 + Math.random() * 0.14).toFixed(2);
    s.style.animationDuration = (12 + Math.random() * 9) + "s";
    s.innerHTML = FISH_SVG;
    water.appendChild(s);
    setTimeout(() => s.remove(), 22000);
  }
  function startSwimmers() {
    const loop = () => { spawnSwimmer(); swimT = setTimeout(loop, 3500 + Math.random() * 6000); };
    let swimT = setTimeout(loop, 1500);
  }

  function setMsg(main, sub) {
    msg.innerHTML = main + (sub ? '<span class="sub">' + sub + "</span>" : "");
  }

  /* ---------- JUICE ---------- */
  function spawnSplash(x, y, n, spread) {
    if (document.hidden) return;
    for (let i = 0; i < n; i++) {
      const d = document.createElement("div"); d.className = "droplet";
      const sz = 3 + Math.random() * 4;
      d.style.width = d.style.height = sz + "px";
      d.style.left = x + "px"; d.style.top = y + "px";
      d.style.setProperty("--dx", ((Math.random() * 2 - 1) * spread).toFixed(0) + "px");
      d.style.setProperty("--up", (-(10 + Math.random() * spread)).toFixed(0) + "px");
      d.style.animationDelay = (Math.random() * 0.05).toFixed(3) + "s";
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 780);
    }
  }
  function screenShake() {
    scene.classList.remove("shaking"); void scene.offsetWidth; // restart
    scene.classList.add("shaking");
    setTimeout(() => scene.classList.remove("shaking"), 440);
  }
  function hapt(pattern) {
    if (state.settings.muted) return; // mute silences buzz too
    if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} }
  }

  /* ---------- IDLE FLAVOR ---------- */
  function startIdleTicker() {
    stopIdleTicker();
    idleTicker = setInterval(() => {
      if (state.phase !== "waiting") return;
      // mostly location color, occasionally a gentle hint about the conditions
      const r = Math.random();
      if (r < 0.5) setMsg(pick(loc().idle));
      else if (r < 0.68) setMsg(currentPhase().hint);
      else if (r < 0.85 && weather) setMsg(weather.report);
      else setMsg(currentSeason().report);
    }, 7000);
  }
  function stopIdleTicker() { if (idleTicker) { clearInterval(idleTicker); idleTicker = null; } }

  /* ---------- THE LOOP ---------- */
  function cast(x, y) {
    if (state.phase !== "idle") return;
    const wr = water.getBoundingClientRect();
    if (x === undefined) {
      x = wr.left + wr.width * (0.35 + Math.random() * 0.3);
      y = wr.top + wr.height * (0.3 + Math.random() * 0.3);
    }
    y = Math.max(wr.top + 30, Math.min(y, wr.bottom - 60));
    x = Math.max(40, Math.min(x, window.innerWidth - 40));

    bobberPos = { x, y };
    bobber.style.left = (x - 9) + "px"; bobber.style.top = (y - 9) + "px";
    bobber.style.display = "block"; bobber.className = "";
    const ax = window.innerWidth * 0.92, ay = -10;
    const dx = x - ax, dy = y - ay, len = Math.hypot(dx, dy), ang = Math.atan2(dx, dy);
    line.style.left = ax + "px"; line.style.top = ay + "px";
    line.style.height = len + "px";
    line.style.transform = "rotate(" + (-ang) + "rad)";
    line.style.display = "block";
    ripple(x, y);
    spawnSplash(x, y, 6, 16);
    sfx("plop");
    hapt(8);

    state.phase = "waiting";
    btn.textContent = "Wait for it…";
    btn.classList.remove("urgent");
    setMsg("Line's in. Now we do the hard part: nothing.");
    startIdleTicker();

    const wait = rand(D.CONFIG.baseWaitMs[0], D.CONFIG.baseWaitMs[1]) * (weather ? weather.biteSpeed : 1);
    biteTimer = setTimeout(nibble, wait);
  }

  function nibble() {
    state.phase = "nibble";
    stopIdleTicker();
    bobber.className = "nibble";
    ripple(bobberPos.x, bobberPos.y);
    sfx("tick");
    setMsg(pick(D.GENERIC.nibble));
    nibbleTimer = setTimeout(bite, rand(D.CONFIG.nibbleMs[0], D.CONFIG.nibbleMs[1]));
  }

  function reelWindowMs() {
    return rod().biteWindow * (loc().current ? D.CONFIG.currentBias : 1); // current = slightly snappier
  }

  function bite() {
    state.phase = "bite";
    bobber.className = "bite";
    ripple(bobberPos.x, bobberPos.y);
    setMsg("<b>BITE!</b> Reel it in!");
    btn.textContent = "REEL!";
    btn.classList.add("urgent");
    missTimer = setTimeout(miss, reelWindowMs());
  }

  function resetTackle() {
    bobber.className = "";
    line.style.display = "none"; bobber.style.display = "none";
    btn.textContent = "Cast a line";
    btn.classList.remove("urgent");
  }

  function miss() {
    clearTimers();
    state.phase = "idle";
    resetTackle();
    setMsg(pick(D.GENERIC.miss));
  }

  /* ---------- THE STRIKE & THE FIGHT (no-fail) ----------
     Tap on the bite to set the hook. Junk comes straight in. A fish
     starts a gentle give-and-take: tap to reel it in faster, or just
     watch and it still lands. Surges are 'let it run' beats — a pause,
     never a loss. Bigger fish = a longer, better fight. */
  let fight = null;     // { f, w, prog, target, surge, tick, surgeT }
  let reeling = false;  // true while the player is pressing-and-holding to reel

  function strike() {
    clearTimers();
    ripple(bobberPos.x, bobberPos.y);
    if (Math.random() < junkChance()) { resolveJunk(); return; }
    const f = pickFish();
    const w = +rand(f.w[0], f.w[1]).toFixed(1);
    if (breakOff(f, w)) { resolveBreakoff(); return; }
    startFight(f, w);
  }

  function afterCatch() {
    updateStats();
    save();
    checkAchievements();
    setMsg("Back to the water whenever you're ready. No rush. Genuinely none.");
  }

  function resolveJunk() {
    state.phase = "idle"; resetTackle();
    const { key, def: j } = pickJunk();
    const pity = Math.round(rand(D.CONFIG.junkPity[0], D.CONFIG.junkPity[1]));
    state.stats.junk++;
    state.stats.junkKinds[key] = (state.stats.junkKinds[key] || 0) + 1;
    state.bucks += pity;
    creditBountiesJunk();
    creditDaily({ junk: true });
    addLog({ emoji: j.emoji, name: j.name, meta: "junk" });
    showCard(j.emoji, "junk haul", j.name, "non-aquatic · released back to society",
      "+" + pity + " ₿ · the parish pays for litter removal, technically", pick([].concat(j.flavor)), "junk");
    afterCatch();
  }

  function resolveBreakoff() {
    state.phase = "idle"; resetTackle();
    addLog({ emoji: "〰️", name: "The one that got away", meta: "snap" });
    showCard("〰️", "got away", "The one that got away", "no harm done · no score kept",
      "", pick(D.GENERIC.breakoff), "junk");
    updateStats(); save();
    setMsg("Heavier line lives at the tackle shop, when you're ready. No rush.");
  }

  // fight "length" in arbitrary units — even little fish give a beat,
  // big ones are a real haul, gently capped so nothing drags.
  function fightTarget(w) { return Math.min(0.9 + w * 0.05, 3.0); }

  function startFight(f, w) {
    state.phase = "fighting";
    fight = { f, w, prog: 0, target: fightTarget(w), surge: false };
    bobber.className = "bite";
    btn.textContent = "REEL!"; btn.classList.add("urgent");
    setMsg("<b>On!</b> Hold to reel — ease off when it runs.");
    spawnSplash(bobberPos.x, bobberPos.y, 8, 22);
    hapt(18);
    showFightBar(f);
    fight.surgeT = setTimeout(triggerSurge, rand(1100, 2000));
    fight.tick = setInterval(fightLoop, 110);
  }

  function fightLoop() {
    if (!fight) return;
    // passive reel-in (just watching still lands it); holding reels much faster
    if (!fight.surge) fight.prog += 0.026 + (reeling ? 0.055 : 0);
    updateFightBar();
    if (fight.prog >= fight.target) landFish();
  }

  function fightTap() {
    if (!fight || fight.surge) return; // during a surge, you let it run
    fight.prog += fight.target * 0.09; // a press gives an immediate crank
    bobber.classList.add("nibble");
    setTimeout(() => bobber && bobber.classList.remove("nibble"), 90);
    sfx("tick");
    updateFightBar();
    if (fight.prog >= fight.target) landFish();
  }

  function triggerSurge() {
    if (!fight) return;
    fight.surge = true;
    setFightLabel("let it run…");
    $("fightBar").classList.add("surge");
    line.classList.add("taut");
    sfx("splash");
    hapt(22);
    setTimeout(() => {
      if (!fight) return;
      fight.surge = false;
      $("fightBar").classList.remove("surge");
      line.classList.remove("taut");
      setFightLabel("reel!");
      fight.surgeT = setTimeout(triggerSurge, rand(1500, 2700));
    }, rand(450, 700));
  }

  function endFight() {
    reeling = false;
    line.classList.remove("taut");
    if (!fight) return;
    clearInterval(fight.tick);
    clearTimeout(fight.surgeT);
    fight = null;
    hideFightBar();
  }

  function landFish() {
    const f = fight.f, w = fight.w;
    endFight();
    state.phase = "idle"; resetTackle();
    ripple(bobberPos.x, bobberPos.y);
    spawnSplash(bobberPos.x, bobberPos.y, 16, 34); // the fish breaks the surface

    const bucks = payout(f, w);
    const key = refKey(f);
    state.stats.catches++;
    state.stats.perLoc[state.locationId] = (state.stats.perLoc[state.locationId] || 0) + 1;
    const isPBnow = w > state.stats.pb;
    lastCatch = { ref: key, name: f.name, w, locId: state.locationId, locName: loc().name, legendary: !!f.legendary, pb: isPBnow };
    recordCatch(f, w, key);
    recordSpeciesHere(key);
    noteFlags(f, key);
    if (typeof creditBounties === "function") creditBounties(f, w, key); // wired in Stage E
    creditDaily({ fish: true, legendary: !!f.legendary, w, key });
    state.bucks += bucks;
    const isPB = isPBnow;
    if (isPB) { state.stats.pb = w; state.stats.pbName = f.name; }
    sfx("splash");
    if (isPB || f.legendary) { setTimeout(() => sfx("chime"), 260); screenShake(); hapt([0, 30, 50, 30]); }
    else hapt(28);
    const badge = f.legendary ? "legendary" : "catch";
    const cls = f.legendary ? "legendary" : "";
    addLog({ emoji: f.emoji, name: f.name, meta: w + " lb", pb: isPB, legend: !!f.legendary });
    showCard(f.emoji, badge, f.name,
      w + " lb · catch & release" + (isPB ? " · new personal best" : ""),
      "+" + bucks + " ₿", pick(f.flavor), cls, key);
    afterCatch();
  }

  /* fight bar UI */
  function showFightBar(f) { $("fightFish").textContent = f.emoji; $("fightFill").style.width = "0%"; setFightLabel("reel!"); $("fightBar").classList.remove("surge"); $("fightBar").classList.add("show"); }
  function updateFightBar() { if (fight) $("fightFill").style.width = Math.min(100, (fight.prog / fight.target) * 100) + "%"; }
  function setFightLabel(t) { $("fightLabel").textContent = t; }
  function hideFightBar() { $("fightBar").classList.remove("show", "surge"); }

  function clearTimers() {
    [biteTimer, nibbleTimer, missTimer].forEach(t => t && clearTimeout(t));
    biteTimer = nibbleTimer = missTimer = null;
    stopIdleTicker();
  }

  /* ---------- HUD / CARD / LOG ---------- */
  function updateStats() {
    $("stCatch").textContent = state.stats.catches;
    $("stBucks").textContent = state.bucks;
    $("stPB").textContent = state.stats.pb ? state.stats.pb + " lb" : "—";
    const l = loc();
    $("locName").textContent = l.name;
    $("locBlurb").textContent = l.blurb;
    if ($("shopPanel").classList.contains("open")) renderShop();
    if ($("travelPanel").classList.contains("open")) renderTravel();
    if ($("boxPanel").classList.contains("open")) renderBox();
    if ($("guidePanel").classList.contains("open")) renderGuide();
    if ($("jobsPanel").classList.contains("open")) renderBoard();
    if ($("campPanel").classList.contains("open")) renderCamp();
  }

  let lastCatch = null; // for photo mode

  function showCard(emoji, badge, name, detail, value, flavor, cls, ref) {
    const em = $("catchEmoji");
    if (ref && window.FishArt && window.FishArt.has(ref)) em.innerHTML = window.FishArt.svg(ref, { w: 168 });
    else em.textContent = emoji;
    // photo button only for real fish
    $("catchPhoto").style.display = (ref && window.FishArt && window.FishArt.has(ref)) ? "" : "none";
    const b = $("catchBadge"); b.textContent = badge; b.className = "badge " + (cls || "");
    $("catchName").textContent = name;
    $("catchDetail").textContent = detail;
    $("catchValue").textContent = value || "";
    $("catchFlavor").textContent = flavor;
    $("catchCard").classList.add("show");
  }
  $("catchClose").addEventListener("click", () => $("catchCard").classList.remove("show"));

  /* ---------- PHOTO MODE ---------- */
  const PHOTO_W = 1080, PHOTO_H = 1350;
  function parseStops(css) {
    const re = /(#[0-9a-f]{3,6})\s+([\d.]+)%/gi; const out = []; let m;
    while ((m = re.exec(css))) out.push({ c: m[1], o: m[2] });
    return out;
  }
  function stopsSVG(css) { return parseStops(css).map(s => `<stop offset="${s.o}%" stop-color="${s.c}"/>`).join(""); }
  function fishInner(ref) { return window.FishArt.svg(ref).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, ""); }

  function buildPhotoSVG(d) {
    const l = D.LOCATIONS.find(x => x.id === d.locId) || loc();
    const skyH = 815;
    const dateStr = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    const ribbon = d.legendary ? "LEGENDARY" : (d.pb ? "PERSONAL BEST" : "");
    const ribbonEl = ribbon ? `<g transform="translate(${PHOTO_W - 60},96) rotate(8)">
        <rect x="-220" y="-26" width="240" height="52" rx="26" fill="rgba(232,193,112,0.92)"/>
        <text x="-100" y="8" text-anchor="middle" font-family="Georgia,serif" font-weight="bold" font-size="26" fill="#13302b" letter-spacing="3">${ribbon}</text></g>` : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${PHOTO_W}" height="${PHOTO_H}" viewBox="0 0 ${PHOTO_W} ${PHOTO_H}">
      <defs>
        <linearGradient id="psky" x1="0" y1="0" x2="0" y2="1">${stopsSVG(l.palette.sky)}</linearGradient>
        <linearGradient id="pwater" x1="0" y1="0" x2="0" y2="1">${stopsSVG(l.palette.water)}</linearGradient>
        <radialGradient id="psun"><stop offset="0" stop-color="#ffe7b0"/><stop offset="0.6" stop-color="#f2a65a"/><stop offset="0.75" stop-color="rgba(242,166,90,0)"/></radialGradient>
      </defs>
      <rect width="${PHOTO_W}" height="${skyH}" fill="url(#psky)"/>
      <circle cx="760" cy="300" r="96" fill="url(#psun)"/>
      <rect y="${skyH}" width="${PHOTO_W}" height="${PHOTO_H - skyH}" fill="url(#pwater)"/>
      <!-- cypress -->
      <g fill="${l.palette.cypress}" transform="translate(40,${skyH}) scale(1.5) translate(0,-300)">
        <path d="M95 300 L95 150 Q70 130 60 90 Q90 110 95 80 Q60 60 70 20 Q95 55 100 15 Q105 55 130 20 Q140 60 105 80 Q110 110 140 90 Q130 130 105 150 L105 300 Z"/>
      </g>
      <!-- fish -->
      <svg x="200" y="430" width="680" height="366" viewBox="0 0 130 70">${fishInner(d.ref)}</svg>
      <!-- ripples under fish -->
      <ellipse cx="540" cy="880" rx="200" ry="22" fill="none" stroke="rgba(242,232,213,.3)" stroke-width="3"/>
      <ellipse cx="540" cy="880" rx="300" ry="34" fill="none" stroke="rgba(242,232,213,.16)" stroke-width="2"/>
      <!-- text -->
      <text x="540" y="1040" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-weight="bold" font-size="62" fill="#f2e8d5">${esc(d.name)}</text>
      <text x="540" y="1098" text-anchor="middle" font-family="monospace" font-size="34" fill="#e8c170">${d.w} lb · ${esc(d.locName)}</text>
      <text x="540" y="1146" text-anchor="middle" font-family="monospace" font-size="24" fill="rgba(242,232,213,.6)">catch &amp; release · ${dateStr}</text>
      <!-- wordmark -->
      <g transform="translate(60,${PHOTO_H - 56})">
        <circle cx="14" cy="-6" r="13" fill="#d8553f"/><path d="M 1 -6 a 13 13 0 0 1 26 0 z" fill="#d8553f"/><rect x="1" y="-6" width="26" height="7" fill="#f2e8d5"/>
        <text x="40" y="2" font-family="Georgia,serif" font-style="italic" font-size="34" fill="#f2e8d5">Bayou <tspan fill="#e8c170">Lines</tspan></text>
      </g>
      ${ribbonEl}
      <rect x="14" y="14" width="${PHOTO_W - 28}" height="${PHOTO_H - 28}" rx="28" fill="none" stroke="rgba(232,193,112,.4)" stroke-width="3"/>
    </svg>`;
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function svgToBlob(svg) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas"); c.width = PHOTO_W; c.height = PHOTO_H;
        c.getContext("2d").drawImage(img, 0, 0, PHOTO_W, PHOTO_H);
        URL.revokeObjectURL(url);
        c.toBlob(b => res({ blob: b, url: c.toDataURL("image/png") }), "image/png");
      };
      img.onerror = rej; img.src = url;
    });
  }

  let photoBlob = null;
  async function openPhoto() {
    if (!lastCatch) return;
    setMsg("Developing the shot…");
    try {
      const { blob, url } = await svgToBlob(buildPhotoSVG(lastCatch));
      photoBlob = blob;
      $("photoImg").src = url;
      $("photoShare").style.display = (navigator.canShare) ? "" : "none";
      $("photoModal").classList.add("show");
    } catch (e) { setMsg("Couldn't develop that one. The light, probably."); }
  }
  async function sharePhoto() {
    if (!photoBlob) return;
    const file = new File([photoBlob], "bayou-catch.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: `${lastCatch.name}, ${lastCatch.w} lb — Bayou Lines` }); return; } catch (e) {}
    }
    savePhoto();
  }
  function savePhoto() {
    if (!photoBlob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(photoBlob);
    a.download = "bayou-catch.png"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  $("catchPhoto").addEventListener("click", openPhoto);
  $("photoShare").addEventListener("click", sharePhoto);
  $("photoSave").addEventListener("click", savePhoto);
  $("photoClose").addEventListener("click", () => $("photoModal").classList.remove("show"));

  function addLog(e) {
    state.log.unshift(e);
    if (state.log.length > 60) state.log.length = 60;
    renderLog();
  }
  function renderLog() {
    const listEl = $("logList");
    $("logEmpty").style.display = state.log.length ? "none" : "block";
    listEl.innerHTML = state.log.map(e =>
      '<div class="logEntry' + (e.pb ? " pb" : "") + (e.legend ? " legend" : "") + '">' +
      '<span class="le-emoji">' + e.emoji + '</span>' +
      '<span class="le-name">' + e.name + '</span>' +
      '<span class="le-meta">' + e.meta + '</span></div>'
    ).join("");
  }

  /* ---------- DAY / NIGHT ----------
     A slow real-time loop (~20 min). The per-location gradients are the
     "golden-hour reference"; here we modulate them with a CSS filter,
     fade stars/sun, and nudge the catch table by time of day. */
  let phaseId = "dusk";

  function dayFraction() {
    return (Date.now() % D.CONFIG.dayLengthMs) / D.CONFIG.dayLengthMs;
  }
  function currentPhase() {
    const f = dayFraction();
    let p = D.PHASES[0];
    for (const ph of D.PHASES) if (f >= ph.from) p = ph;
    return p;
  }

  // filter keyframes across the day; we lerp between the surrounding two.
  const LIGHT_KEYS = [
    { f: 0.00, b: 0.70, s: 0.92, h: -8,  dark: 0.7 }, // dawn
    { f: 0.18, b: 1.05, s: 1.00, h: 0,   dark: 0.0 }, // midday
    { f: 0.55, b: 1.00, s: 1.16, h: 10,  dark: 0.1 }, // golden hour
    { f: 0.72, b: 0.82, s: 1.10, h: 6,   dark: 0.4 }, // dusk
    { f: 0.82, b: 0.52, s: 0.82, h: -10, dark: 0.85 }, // night
    { f: 1.00, b: 0.70, s: 0.92, h: -8,  dark: 0.7 }, // wrap to dawn
  ];
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lightAt(f) {
    for (let i = 0; i < LIGHT_KEYS.length - 1; i++) {
      const k0 = LIGHT_KEYS[i], k1 = LIGHT_KEYS[i + 1];
      if (f >= k0.f && f <= k1.f) {
        const t = (f - k0.f) / (k1.f - k0.f);
        return { b: lerp(k0.b, k1.b, t), s: lerp(k0.s, k1.s, t), h: lerp(k0.h, k1.h, t), dark: lerp(k0.dark, k1.dark, t) };
      }
    }
    return LIGHT_KEYS[0];
  }

  function applyDayNight() {
    const f = dayFraction();
    const L = lightAt(f);
    $("scene").style.filter = `brightness(${L.b.toFixed(3)}) saturate(${L.s.toFixed(3)}) hue-rotate(${L.h.toFixed(1)}deg) ${currentSeason().tint}`;
    $("stars").style.opacity = Math.max(0, (L.dark - 0.45) / 0.55).toFixed(2);
    // sun rides high at midday, sinks and fades into the night
    const sunUp = Math.max(0, 1 - L.dark * 1.3);
    $("sun").style.opacity = sunUp.toFixed(2);
    $("sun").style.transform = `translateY(${((1 - sunUp) * 120).toFixed(0)}px)`;
    document.body.classList.toggle("dark", L.dark > 0.45);

    const ph = currentPhase();
    if (ph.id !== phaseId) phaseId = ph.id;
    $("timeChip").textContent = ph.label;
    $("timeChip").title = ph.hint;
  }

  function startDayNight() {
    applyDayNight();
    setInterval(applyDayNight, 4000); // smooth enough with the 2.4s CSS transition
  }

  /* ---------- SEASON (tracks your real-world season) ---------- */
  function currentSeason() {
    const m = new Date().getMonth();
    return D.SEASONS.find(s => s.months.includes(m)) || D.SEASONS[0];
  }

  /* ---------- WEATHER (rolls every few minutes) ---------- */
  let weather = null;
  function pickWeather() {
    const t = D.WEATHER.reduce((s, w) => s + w.weight, 0);
    let r = Math.random() * t;
    for (const w of D.WEATHER) { if ((r -= w.weight) <= 0) return w; }
    return D.WEATHER[0];
  }
  function setWeather(w, announce) {
    weather = w;
    const fx = $("weatherFx");
    fx.className = w.fx ? "fx-" + w.fx : "";
    const season = currentSeason();
    $("weatherChip").textContent = w.label + " · " + season.label;
    $("weatherChip").title = w.report + "  —  " + season.report;
    if (announce && state.phase === "idle") setMsg("The weather's shifting. " + w.report);
  }
  function startWeather() {
    setWeather(pickWeather(), false);
    setInterval(() => { const nw = pickWeather(); if (!weather || nw.id !== weather.id) setWeather(nw, true); }, 4 * 60 * 1000);
  }

  /* ---------- shared catch bookkeeping (used by the rod and the trotline) ---------- */
  function recordCatch(f, w, key) {
    state.stats.species[key] = (state.stats.species[key] || 0) + 1;
    state.caught[key] = true;
    const rec = state.records[key] || (state.records[key] = { max: 0, count: 0, firstLoc: state.locationId, lastTs: 0 });
    rec.count++;
    rec.lastTs = Date.now();
    if (w > rec.max) rec.max = w;
    if (f.legendary) state.legends[key] = true;
  }

  /* ---------- THE TROTLINE (opt-in idle) ----------
     Set it before you go; it fishes slow while you're away. Gentle by
     design — capped, modest pay, common fish only, never required. */
  const TROT = { minutesPerFish: 12, maxFish: 8, capHours: 6, payRate: 0.7 };
  function trotlineEligible() { return boat().tier >= 1; }
  function trotPick() {
    const sp = loc().species;
    const t = sp.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * t;
    for (const e of sp) { if ((r -= e.weight) <= 0) return D.S[e.ref]; }
    return D.S[sp[0].ref];
  }
  function setTrotline() {
    if (!trotlineEligible()) return;
    state.trotline = { set: true, ts: Date.now() };
    save(); renderTravel();
    setMsg("Trotline's out. It'll fish slow while you're away.", "come back whenever — it doesn't clock out");
  }
  function checkTrotline() {
    const t = state.trotline;
    if (!t || !t.set || !t.ts) return;
    const mins = Math.min((Date.now() - t.ts) / 60000, TROT.capHours * 60);
    const n = Math.min(Math.floor(mins / TROT.minutesPerFish), TROT.maxFish);
    if (n <= 0) return; // not enough soak time yet — leave it set
    let bucks = 0, pbHit = false;
    for (let i = 0; i < n; i++) {
      const f = trotPick();
      const w = +rand(f.w[0], f.w[0] + (f.w[1] - f.w[0]) * 0.6).toFixed(1); // smaller average than rod
      const key = refKey(f);
      state.stats.catches++;
      state.stats.perLoc[state.locationId] = (state.stats.perLoc[state.locationId] || 0) + 1;
      recordCatch(f, w, key);
      recordSpeciesHere(key);
      bucks += Math.max(1, Math.round(payout(f, w) * TROT.payRate));
      if (w > state.stats.pb) { state.stats.pb = w; state.stats.pbName = f.name; pbHit = true; }
      addLog({ emoji: f.emoji, name: f.name, meta: w + " lb · trotline", pb: false });
    }
    state.bucks += bucks;
    state.flags.trotline = true;
    state.trotline = { set: false, ts: 0 };
    updateStats(); save(); checkAchievements();
    showCard("🪝", "trotline", "The trotline came through",
      n + (n === 1 ? " fish" : " fish") + " while you were gone" + (pbHit ? " · new personal best in there" : ""),
      "+" + bucks + " ₿", "Quiet, steady work. The bayou doesn't clock out, and neither does the trotline.", "");
  }

  /* ---------- THEMING ---------- */
  function applyTheme(l) {
    $("sky").style.background = l.palette.sky;
    $("water").style.background = l.palette.water;
    const root = document.documentElement.style;
    root.setProperty("--cypress", l.palette.cypress);
    root.setProperty("--accent", l.accent);
    if (typeof applyDayNight === "function") applyDayNight(); // step 5 re-tints on top
  }

  /* ---------- TRAVEL / UNLOCKS ---------- */
  function boatTier() { return boat().tier; }
  function isUnlocked(id) { return state.unlocked.includes(id); }

  // Evaluate a location's unlock gate. Returns the requirement rows and
  // whether everything's met (so we can show the player exactly what's left).
  function gate(l) {
    if (!l.unlock) return { open: true, rows: [] };
    const u = l.unlock, rows = [];
    if (u.bucks) rows.push({ met: state.bucks >= u.bucks, text: `${u.bucks} ₿ permit` });
    if (u.boatTier) {
      const need = D.EQUIPMENT.boat.find(b => b.tier === u.boatTier);
      rows.push({ met: boatTier() >= u.boatTier, text: `${need ? need.name : "boat tier " + u.boatTier}` });
    }
    if (u.milestone) {
      const at = D.LOCATIONS.find(x => x.id === u.milestone.at);
      const have = state.stats.perLoc[u.milestone.at] || 0;
      rows.push({ met: have >= u.milestone.here, text: `catch ${u.milestone.here} at ${at ? at.name : u.milestone.at} (${Math.min(have, u.milestone.here)}/${u.milestone.here})` });
    }
    return { open: rows.every(r => r.met), rows };
  }

  function trotlineCardHTML() {
    if (!trotlineEligible()) {
      return `<div class="trotCard"><div class="trot-title">🪝 The Trotline</div>
        <div class="trot-desc">A set line that fishes for you while you're away. You'll need a boat to run one — see the Shop.</div></div>`;
    }
    const t = state.trotline;
    let status, btn;
    if (t.set) {
      const mins = Math.floor((Date.now() - t.ts) / 60000);
      const soaking = Math.min(Math.floor(mins / TROT.minutesPerFish), TROT.maxFish);
      status = `<div class="trot-status">Out now · soaking ${mins} min · about ${soaking} on the line so far (caps at ${TROT.maxFish}).</div>`;
      btn = `<button class="trotBtn" disabled>set & soaking…</button>`;
    } else {
      status = `<div class="trot-status">Not set. Drop it before you head out — pull it when you're back.</div>`;
      btn = `<button class="trotBtn" data-trot="set">Set the trotline</button>`;
    }
    return `<div class="trotCard"><div class="trot-title">🪝 The Trotline</div>
      <div class="trot-desc">Set a line, go live your life. It lands a few while you're gone — modest pay, common fish, no rush.</div>
      ${status}${btn}</div>`;
  }

  function renderTravel() {
    $("travelBody").innerHTML = trotlineCardHTML() + D.LOCATIONS.map(l => {
      const here = l.id === state.locationId;
      const unlocked = isUnlocked(l.id);
      const g = gate(l);
      let flag = "", body = "", cls = "";
      if (here) { flag = '<span class="spot-flag">you are here</span>'; cls = "here"; }
      else if (unlocked) { flag = '<span class="spot-flag" style="color:var(--good)">unlocked</span>'; }

      if (unlocked) {
        body = here ? "" : `<button class="travelBtn" data-go="${l.id}">Head over</button>`;
      } else {
        const reqs = g.rows.map(r => `<span class="${r.met ? "met" : "unmet"}">${r.met ? "✓" : "•"} ${r.text}</span>`).join("<br>");
        cls = "locked";
        body = `<div class="spot-req">${reqs}</div>` +
          (g.open ? `<button class="travelBtn" data-unlock="${l.id}">Get the permit &amp; go</button>`
                  : `<button class="travelBtn" disabled>locked for now</button>`);
      }
      return `<div class="spotCard ${cls}">
          <div class="spot-name">${l.name} ${flag}</div>
          <div class="spot-blurb">${l.blurb}</div>
          ${body}
        </div>`;
    }).join("");
    $("travelBody").querySelectorAll("[data-go]").forEach(b =>
      b.addEventListener("click", () => travelTo(b.dataset.go)));
    $("travelBody").querySelectorAll("[data-unlock]").forEach(b =>
      b.addEventListener("click", () => unlockAndGo(b.dataset.unlock)));
    const trotBtn = $("travelBody").querySelector('[data-trot="set"]');
    if (trotBtn) trotBtn.addEventListener("click", setTrotline);
  }

  function unlockAndGo(id) {
    const l = D.LOCATIONS.find(x => x.id === id);
    const g = gate(l);
    if (!g.open || isUnlocked(id)) return;
    if (l.unlock && l.unlock.bucks) state.bucks -= l.unlock.bucks; // permit cost
    state.unlocked.push(id);
    if (window.BayouAudio) window.BayouAudio.chime();
    travelTo(id, true);
    checkAchievements();
  }

  function travelTo(id, fresh) {
    if (!isUnlocked(id)) return;
    if (state.phase !== "idle") { endFight(); clearTimers(); state.phase = "idle"; resetTackle(); } // reel in before we run off
    state.locationId = id;
    const l = D.LOCATIONS.find(x => x.id === id);
    applyTheme(l);
    if (window.BayouAudio) window.BayouAudio.setLocationMix(!!l.coastal);
    updateStats();
    save();
    closePanel("travelPanel");
    setMsg(fresh ? `Permit secured. Welcome to <b>${l.name}</b>.` : `Now fishing <b>${l.name}</b>.`,
      pick(l.idle));
  }

  /* ---------- THE LANDING (bounties) ----------
     The regulars post easygoing favors. Catch toward them as you fish;
     finishing one pays out and a fresh one takes its place. */
  const NUM_BOUNTIES = 3;
  let bountySeq = 0;
  function bountyUID() { return "b" + (Date.now().toString(36)) + (bountySeq++); }

  function newBounty(usedTmplIds) {
    const avail = D.BOUNTY_TEMPLATES.filter(t => !usedTmplIds.includes(t.id));
    const tmpl = pick(avail.length ? avail : D.BOUNTY_TEMPLATES);
    const b = { uid: bountyUID(), tmpl: tmpl.id, giver: tmpl.giver, kind: tmpl.kind,
      group: tmpl.group || null, noun: tmpl.noun || null, progress: 0, seen: [], done: false };
    if (tmpl.kind === "weight") {
      b.minWeight = Math.round(rand(tmpl.min, tmpl.max));
      b.target = 1; b.reward = tmpl.reward;
      b.text = tmpl.flavor.replace("{X}", b.minWeight);
    } else if (tmpl.kind === "legendary") {
      b.target = 1; b.reward = tmpl.reward; b.text = tmpl.flavor;
    } else { // species, junk, variety
      b.target = Math.round(rand(tmpl.min, tmpl.max));
      b.reward = (tmpl.perReward || 10) * b.target;
      b.text = tmpl.flavor.replace("{N}", b.target);
    }
    return b;
  }
  function ensureBounties() {
    while (state.bounties.length < NUM_BOUNTIES) {
      state.bounties.push(newBounty(state.bounties.map(b => b.tmpl)));
    }
  }

  function creditBounties(f, w, key) {
    creditBountyEvent({ fish: true, legendary: !!f.legendary, w, key });
  }
  function creditBountiesJunk() { creditBountyEvent({ junk: true }); }

  function creditBountyEvent(ev) {
    const done = [];
    let changed = false;
    for (const b of state.bounties) {
      if (b.done) continue;
      let hit = false;
      if (b.kind === "species" && ev.fish && b.group && b.group.includes(ev.key)) { b.progress++; hit = true; }
      else if (b.kind === "weight" && ev.fish && ev.w >= b.minWeight) { b.progress = 1; hit = true; }
      else if (b.kind === "variety" && ev.fish) { if (!b.seen.includes(ev.key)) { b.seen.push(ev.key); b.progress = b.seen.length; hit = true; } }
      else if (b.kind === "legendary" && ev.legendary) { b.progress = 1; hit = true; }
      else if (b.kind === "junk" && ev.junk) { b.progress++; hit = true; }
      if (hit) { changed = true; if (b.progress >= b.target) { b.done = true; done.push(b); } }
    }
    if (done.length) settleBounties(done);
    if (changed && $("jobsPanel").classList.contains("open")) renderBoard();
  }

  function settleBounties(done) {
    for (const b of done) {
      state.bucks += b.reward;
      state.stats.bountiesDone = (state.stats.bountiesDone || 0) + 1;
      const c = D.CHARACTERS[b.giver];
      toastBounty(c, b.reward);
      state.bounties = state.bounties.filter(x => x.uid !== b.uid);
    }
    ensureBounties();
    updateStats(); save(); checkAchievements();
    setTimeout(() => sfx("chime"), 120);
  }

  function toastBounty(c, reward) {
    const el = document.createElement("div");
    el.className = "toast bounty-toast";
    el.innerHTML = `<span class="t-icon">${c.emoji}</span>
      <span><span class="t-label">Bounty paid · ${c.name}</span>+${reward} ₿, and thanks</span>`;
    $("toasts").appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }

  function renderBoard() {
    ensureBounties();
    const intro = '<div class="b-cast">' +
      Object.values(D.CHARACTERS).map(c => `${c.emoji} <b style="color:var(--cream)">${c.name}</b> — ${c.blurb}`).join("<br>") +
      '</div>';
    const cards = state.bounties.map(b => {
      const c = D.CHARACTERS[b.giver];
      const pct = Math.min(100, (b.progress / b.target) * 100);
      const prog = b.kind === "weight" ? (b.progress ? "done" : "land one over " + b.minWeight + " lb")
        : b.kind === "legendary" ? (b.progress ? "done" : "any named legendary")
        : b.progress + " / " + b.target;
      return `<div class="bounty">
          <div class="b-head"><span class="b-emoji">${c.emoji}</span>
            <span class="b-giver">${c.name}</span>
            <span class="b-reward">+${b.reward} ₿</span></div>
          <div class="b-text">${b.text}</div>
          <div class="b-track"><div class="b-fill" style="width:${pct}%"></div></div>
          <div class="b-prog">${prog}</div>
        </div>`;
    }).join("");
    $("jobsBody").innerHTML = dailyHTML() + '<div class="sectionLabel">Bounties</div>' + intro + cards;
  }

  /* ---------- DAILY CHALLENGE + STREAK + FEATURED BITE ---------- */
  function dayStr(d) { d = d || new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function dhash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; } return h; }

  function rollDaily() {
    const today = dayStr();
    if (state.daily.date === today) return; // already rolled today
    const yesterday = dayStr(new Date(Date.now() - 86400000));
    const streak = (state.daily.lastDay === yesterday) ? (state.daily.streak || 0) + 1 : 1;
    const h = dhash(today);
    const tmpl = D.DAILY[h % D.DAILY.length];
    const span = (tmpl.max || tmpl.min || 1) - (tmpl.min || 0);
    const roll = tmpl.min ? tmpl.min + (h >> 4) % (span + 1) : 1;
    const d = { date: today, cid: tmpl.id, kind: tmpl.kind, group: tmpl.group || null,
      target: tmpl.kind === "weight" || tmpl.kind === "legendary" ? 1 : roll,
      minWeight: tmpl.kind === "weight" ? roll : 0,
      reward: tmpl.reward || (tmpl.per || 10) * roll,
      text: (tmpl.text || "").replace("{N}", roll).replace("{X}", roll),
      progress: 0, seen: [], done: false,
      streak, lastDay: today,
      featured: D.LOCATIONS[(h >> 8) % D.LOCATIONS.length].id };
    state.daily = d;
    save();
    dailyAnnounce = true;
  }
  let dailyAnnounce = false;

  function creditDaily(ev) {
    const d = state.daily;
    if (!d || d.done || !d.kind) return;
    let hit = false;
    if (d.kind === "species" && ev.fish && d.group && d.group.includes(ev.key)) { d.progress++; hit = true; }
    else if (d.kind === "weight" && ev.fish && ev.w >= d.minWeight) { d.progress = 1; hit = true; }
    else if (d.kind === "total" && ev.fish) { d.progress++; hit = true; }
    else if (d.kind === "variety" && ev.fish) { if (!d.seen.includes(ev.key)) { d.seen.push(ev.key); d.progress = d.seen.length; hit = true; } }
    else if (d.kind === "legendary" && ev.legendary) { d.progress = 1; hit = true; }
    else if (d.kind === "junk" && ev.junk) { d.progress++; hit = true; }
    if (!hit) return;
    if (d.progress >= d.target && !d.done) {
      d.done = true;
      const streakBonus = Math.min(d.streak, 10) * 15;
      const total = d.reward + streakBonus;
      state.bucks += total;
      state.stats.dailiesDone = (state.stats.dailiesDone || 0) + 1;
      toastDaily(total, d.streak);
      setTimeout(() => sfx("chime"), 120);
      save(); updateStats(); checkAchievements();
    }
    if ($("jobsPanel").classList.contains("open")) renderBoard();
  }

  function toastDaily(total, streak) {
    const el = document.createElement("div");
    el.className = "toast bounty-toast";
    el.innerHTML = `<span class="t-icon">📅</span><span><span class="t-label">Daily done · ${streak}-day streak</span>+${total} ₿</span>`;
    $("toasts").appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }

  function dailyHTML() {
    const d = state.daily;
    if (!d || !d.kind) return "";
    const featured = D.LOCATIONS.find(l => l.id === d.featured);
    const pct = Math.min(100, (d.progress / d.target) * 100);
    const prog = d.kind === "weight" ? (d.done ? "done" : "over " + d.minWeight + " lb")
      : d.kind === "legendary" ? (d.done ? "done" : "any legendary")
      : d.progress + " / " + d.target;
    const streakBonus = Math.min(d.streak, 10) * 15;
    return `<div class="dailyCard">
        <div class="b-head"><span class="b-emoji">📅</span><span class="b-giver">Today's Challenge</span>
          <span class="b-reward">+${d.reward}${streakBonus ? " +" + streakBonus : ""} ₿</span></div>
        <div class="daily-streak">🔥 ${d.streak}-day streak${streakBonus ? " · +" + streakBonus + " ₿ bonus" : ""}</div>
        <div class="b-text" style="font-style:normal;color:var(--cream)">${d.text}${d.done ? " ✓" : ""}</div>
        <div class="b-track"><div class="b-fill" style="width:${pct}%"></div></div>
        <div class="b-prog">${prog}</div>
        <div class="daily-feat">🐟 Hot bite today: <b>${featured ? featured.name : "—"}</b> — pays +20% ${state.locationId === d.featured ? "(you're on it!)" : ""}</div>
      </div>`;
  }

  /* ---------- THE CAMP + TROPHY WALL ---------- */
  function renderCamp() {
    const c = state.camp;
    if (window.CampArt) $("campScene").innerHTML = window.CampArt.svg(c.tier, c.decor);
    const tiers = D.CAMP.tiers, cur = tiers[c.tier], next = tiers[c.tier + 1];
    let html = `<div class="campTierRow"><div class="ct-body">
        <div class="campName">${cur.name}</div><div class="campFlavor">${cur.flavor}</div></div></div>`;
    if (next) {
      const afford = state.bucks >= next.price;
      html += `<div class="sectionLabel">Improve the camp</div>
        <div class="tierRow"><div class="tier-body"><div class="tier-name">${next.name}</div>
          <div class="tier-flavor">${next.flavor}</div></div>
          <button class="buyBtn" data-camp="tier" ${afford ? "" : "disabled"}>${next.price} ₿</button></div>`;
    }
    // decor
    html += `<div class="sectionLabel">Bits &amp; pieces</div><div class="decorGrid">`;
    html += D.CAMP.decor.map(d => {
      const owned = !!c.decor[d.id];
      const afford = state.bucks >= d.price;
      return `<div class="decorChip ${owned ? "owned" : ""}"><div class="dc-name">${d.name}</div>
        <div class="dc-flavor">${d.flavor}</div>
        ${owned ? '<span class="tag owned">up</span>' : `<button class="buyBtn" data-decor="${d.id}" ${afford ? "" : "disabled"}>${d.price} ₿</button>`}</div>`;
    }).join("") + `</div>`;
    // trophy wall
    html += `<div class="sectionLabel">The Trophy Wall</div>`;
    const trophies = Object.keys(state.records)
      .filter(k => state.records[k].max > 0 && (D.S[k] || D.L[k]))
      .sort((a, b) => state.records[b].max - state.records[a].max);
    if (!trophies.length) {
      html += `<div id="trophyEmpty">Nothing mounted yet. Land a few and your biggest of each will hang here.</div>`;
    } else {
      html += `<div class="trophyWall">` + trophies.map(k => {
        const def = D.S[k] || D.L[k], rec = state.records[k];
        const art = (window.FishArt && window.FishArt.has(k)) ? window.FishArt.svg(k, { w: 64 }) : def.emoji;
        const where = D.LOCATIONS.find(l => l.id === rec.firstLoc);
        return `<div class="trophy"><div class="tr-art">${art}</div>
          <div><div class="tr-name">${def.name}</div>
          <div class="tr-meta">best ${rec.max} lb · caught ×${rec.count}</div>
          <div class="tr-where">first landed at ${where ? where.name : "the bayou"}</div></div></div>`;
      }).join("") + `</div>`;
    }
    $("campBody").innerHTML = html;
    const tb = $("campBody").querySelector('[data-camp="tier"]');
    if (tb) tb.addEventListener("click", buyCampTier);
    $("campBody").querySelectorAll("[data-decor]").forEach(b =>
      b.addEventListener("click", () => buyDecor(b.dataset.decor)));
  }
  function buyCampTier() {
    const next = D.CAMP.tiers[state.camp.tier + 1];
    if (!next || state.bucks < next.price) return;
    state.bucks -= next.price; state.camp.tier++;
    sfx("chime"); save(); updateStats(); renderCamp(); checkAchievements();
  }
  function buyDecor(id) {
    const d = D.CAMP.decor.find(x => x.id === id);
    if (!d || state.camp.decor[id] || state.bucks < d.price) return;
    state.bucks -= d.price; state.camp.decor[id] = true;
    sfx("chime"); save(); updateStats(); renderCamp(); checkAchievements();
  }

  /* ---------- FIELD GUIDE ---------- */
  // where each fish can be found (species + legendary homes), for hints
  const REF_LOCS = {};
  D.LOCATIONS.forEach(l => {
    l.species.forEach(s => (REF_LOCS[s.ref] = REF_LOCS[s.ref] || []).push(l.name));
    (l.legendaries || []).forEach(s => (REF_LOCS[s.ref] = REF_LOCS[s.ref] || []).push(l.name));
  });
  const GUIDE_FISH = Object.keys(D.S).filter(k => REF_LOCS[k]);
  const GUIDE_LEGENDS = Object.keys(D.L).filter(k => REF_LOCS[k]);

  function guideCard(ref, def, isLegend) {
    const logged = !!state.caught[ref];
    const rec = state.records[ref];
    const where = REF_LOCS[ref] ? REF_LOCS[ref].join(" · ") : "";
    let recLine = "", flavor = "";
    if (logged && rec) {
      recLine = `<div class="g-rec">caught ×${rec.count} · best ${rec.max} lb</div>`;
      flavor = `<div class="g-flavor">${def.flavor[0]}</div>`;
    }
    const whereLabel = isLegend ? "legend of" : "found in";
    const art = (window.FishArt && window.FishArt.has(ref)) ? window.FishArt.svg(ref, { w: 58 }) : def.emoji;
    return `<div class="gCard ${logged ? "logged" : ""} ${isLegend ? "legend" : ""}">
        <span class="g-emoji">${art}</span>
        <div class="g-body">
          <div class="g-name">${logged ? def.name : "• • • • •"} ${isLegend ? '<span class="g-crown">legend</span>' : ""}</div>
          ${recLine}
          <div class="g-where">${whereLabel}: ${where}</div>
          ${flavor}
        </div>
      </div>`;
  }

  function renderGuide() {
    const total = GUIDE_FISH.length + GUIDE_LEGENDS.length;
    const logged = GUIDE_FISH.concat(GUIDE_LEGENDS).filter(r => state.caught[r]).length;
    $("guideCount").textContent = logged + " of " + total;
    $("guideBody").innerHTML =
      '<div class="guideSection">The Fish</div>' +
      GUIDE_FISH.map(r => guideCard(r, D.S[r], false)).join("") +
      '<div class="guideSection">Local Legends</div>' +
      GUIDE_LEGENDS.map(r => guideCard(r, D.L[r], true)).join("");
  }

  /* ---------- ACHIEVEMENTS ("The Tackle Box") ---------- */
  const ALL_REFS = new Set(), LEGEND_REFS = new Set();
  D.LOCATIONS.forEach(l => {
    l.species.forEach(s => ALL_REFS.add(s.ref));
    (l.legendaries || []).forEach(s => { ALL_REFS.add(s.ref); LEGEND_REFS.add(s.ref); });
  });
  const CATFISH = ["channelcat", "bluecat", "flathead"];
  const BASSES = ["largemouth", "trophybass", "smallbass"];
  const SALTIES = ["redfish", "speck", "flounder", "sheepshead", "blackdrum"];
  const ACH_ICONS = {
    first_cast: "🎣", revise: "📜", deficient: "🕳️", litter: "🚧", sacaulait: "🐟",
    patience: "🧘", pb10: "⚖️", pb25: "🏋️", whiskers: "🌙", golden: "🌅",
    firstboat: "🛶", bassboat: "🚤", fullrod: "📐", travel3: "🗺️", asbuilt: "📋",
    substantial: "✅", firstlegend: "👑", submittal: "🏆", gator: "🐊", rich: "💵",
    saltlife: "🌊", guide20: "📖", fullbox: "🧰",
    rainmaker: "🌧️", frontrunner: "🌩️", trotline: "🪝",
    favor: "🤝", landing: "⛪", homestead: "🏕️", trophies: "🏆",
    daily1: "📅", streak7: "🔥",
  };

  function recordSpeciesHere(key) {
    const id = state.locationId;
    const ls = state.stats.locSpecies[id] || (state.stats.locSpecies[id] = {});
    ls[key] = true;
    if (loc().species.map(s => s.ref).every(r => ls[r])) state.flags.asBuilt = true;
  }
  function noteFlags(f, key) {
    if (CATFISH.includes(key) && phaseId === "night") state.flags.nightCat = true;
    if (BASSES.includes(key) && phaseId === "golden") state.flags.goldenBass = true;
    if (SALTIES.includes(key)) state.flags.firstSalt = true;
    if (weather && weather.id === "rain") state.flags.rainCatch = true;
    if (weather && weather.id === "front") state.flags.frontCatch = true;
  }

  function facade() {
    return {
      stats: state.stats, flags: state.flags, equip: state.equip,
      caught: state.caught, bucks: state.bucks, camp: state.camp, daily: state.daily,
      trophyCount: () => Object.keys(state.records).filter(k => state.records[k].max > 0).length,
      totalCatches: () => state.stats.catches,
      junkCount: k => state.stats.junkKinds[k] || 0,
      speciesTotal: refs => refs.reduce((s, r) => s + (state.stats.species[r] || 0), 0),
      unlockedCount: () => state.unlocked.length,
      legendCount: () => Object.keys(state.legends).length,
      legendTotal: () => LEGEND_REFS.size,
      speciesCaughtCount: () => Object.keys(state.caught).length,
      speciesTotalCount: () => ALL_REFS.size,
    };
  }

  function checkAchievements() {
    const g = facade();
    const newly = [];
    for (const a of D.ACHIEVEMENTS) {
      if (state.achievements.includes(a.id)) continue;
      let ok = false;
      try { ok = a.check(g); } catch (e) { ok = false; }
      if (ok) { state.achievements.push(a.id); newly.push(a); }
    }
    if (newly.length) {
      save();
      newly.forEach((a, i) => setTimeout(() => { toast(a); sfx("chime"); }, i * 500));
      if ($("boxPanel").classList.contains("open")) renderBox();
    }
  }

  function toast(a) {
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `<span class="t-icon">${ACH_ICONS[a.id] || "🪝"}</span>
      <span><span class="t-label">Tackle Box</span>${a.name}</span>`;
    $("toasts").appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }

  function renderBox() {
    const got = state.achievements;
    $("achCount").textContent = got.length + "/" + D.ACHIEVEMENTS.length;
    $("boxBody").innerHTML = D.ACHIEVEMENTS.map(a => {
      const has = got.includes(a.id);
      return `<div class="achRow ${has ? "got" : ""}">
          <span class="ach-icon">${ACH_ICONS[a.id] || "🪝"}</span>
          <div class="ach-body">
            <div class="ach-name">${has ? a.name : "• • •"}</div>
            <div class="ach-desc">${a.desc}</div>
          </div>
        </div>`;
    }).join("");
  }

  /* ---------- SHOP ---------- */
  const TRACKS = [
    { key: "rod",  icon: "🎣", title: "Rod", desc: "longer reel window, bigger fish you can land clean",
      stat: t => `reel window ${(t.biteWindow/1000).toFixed(1)}s · lands ${t.maxWeight >= 999 ? "anything" : "≤" + t.maxWeight + " lb"}` },
    { key: "line", icon: "🧵", title: "Line", desc: "fewer break-offs on the big ones; heavier line lands rarer classes",
      stat: t => `${Math.round(t.breakResist*100)}% break resistance · up to ${t.maxClass} class` },
    { key: "lure", icon: "🪝", title: "Lures & Bait", desc: "less junk, better odds, and a nudge toward certain fish",
      stat: t => `${Math.round(t.junkChance*100)}% junk · +${Math.round(t.rarityBoost*100)}% toward the rare stuff` },
    { key: "boat", icon: "🛥️", title: "Boat", desc: "the gate to bigger water — see the Travel map",
      stat: t => `boat tier ${t.tier}` },
  ];

  function renderShop() {
    $("shopBucks").textContent = state.bucks;
    $("shopBody").innerHTML = TRACKS.map(tr => {
      const tiers = D.EQUIPMENT[tr.key];
      const owned = state.equip[tr.key];
      const rows = tiers.map((t, i) => {
        let tag = "", btn = "", rowCls = "";
        if (i < owned) { rowCls = "owned"; tag = '<span class="tag owned">owned</span>'; }
        else if (i === owned) { rowCls = "current"; tag = '<span class="tag current">equipped</span>'; }
        else if (i === owned + 1) {
          const afford = state.bucks >= t.price;
          btn = `<button class="buyBtn" data-track="${tr.key}" data-tier="${i}" ${afford ? "" : "disabled"}>${t.price} ₿</button>`;
        } else { rowCls = "locked"; tag = '<span class="tag">locked</span>'; }
        return `<div class="tierRow ${rowCls}">
            <div class="tier-body">
              <div class="tier-name">${t.name}</div>
              <div class="tier-flavor">${t.flavor}</div>
              <div class="tier-stat">${tr.stat(t)}</div>
            </div>${tag}${btn}
          </div>`;
      }).join("");
      return `<div class="shopTrack"><h3>${tr.icon} ${tr.title}</h3>
        <div class="track-desc">${tr.desc}</div>${rows}</div>`;
    }).join("");
    $("shopBody").querySelectorAll(".buyBtn").forEach(b =>
      b.addEventListener("click", () => buy(b.dataset.track, +b.dataset.tier)));
  }

  function buy(track, tier) {
    if (tier !== state.equip[track] + 1) return;      // only the next tier
    const t = D.EQUIPMENT[track][tier];
    if (state.bucks < t.price) return;
    state.bucks -= t.price;
    state.equip[track] = tier;
    save();
    updateStats();
    renderShop();
    if (window.BayouAudio) window.BayouAudio.chime();
    checkAchievements();
    setMsg(`New gear: <b>${t.name}</b>.`, "broke in on the next cast");
  }

  /* ---------- PANELS (generic open/close) ---------- */
  function openPanel(id) { $(id).classList.add("open"); }
  function closePanel(id) { $(id).classList.remove("open"); }
  function closeAllPanels() { document.querySelectorAll(".panel.open").forEach(p => p.classList.remove("open")); }
  $("logBtn").addEventListener("click", () => openPanel("logPanel"));
  $("shopBtn").addEventListener("click", () => { renderShop(); openPanel("shopPanel"); });
  $("travelBtn").addEventListener("click", () => { renderTravel(); openPanel("travelPanel"); });
  $("boxBtn").addEventListener("click", () => { renderBox(); openPanel("boxPanel"); });
  $("guideBtn").addEventListener("click", () => { renderGuide(); openPanel("guidePanel"); });
  $("jobsBtn").addEventListener("click", () => { renderBoard(); openPanel("jobsPanel"); });
  $("campBtn").addEventListener("click", () => { renderCamp(); openPanel("campPanel"); closeMore(); });

  // the "More" overflow menu
  function closeMore() { $("moreMenu").classList.remove("open"); }
  $("moreBtn").addEventListener("click", e => { e.stopPropagation(); $("moreMenu").classList.toggle("open"); });
  document.addEventListener("click", e => {
    if (!e.target.closest("#moreMenu") && !e.target.closest("#moreBtn")) closeMore();
  });
  ["boxBtn", "logBtn", "settingsBtn"].forEach(id => $(id).addEventListener("click", closeMore));
  $("settingsBtn").addEventListener("click", () => openPanel("settingsPanel"));
  document.querySelectorAll(".panelClose").forEach(b =>
    b.addEventListener("click", () => closePanel(b.dataset.close)));

  /* ---------- SETTINGS ---------- */
  function applySettingsUI() {
    $("muteToggle").checked = !state.settings.muted;
    $("volSlider").value = state.settings.volume;
  }
  $("muteToggle").addEventListener("change", e => {
    state.settings.muted = !e.target.checked;
    save();
    if (window.BayouAudio) window.BayouAudio.setMuted(state.settings.muted);
  });
  $("volSlider").addEventListener("input", e => {
    state.settings.volume = +e.target.value;
    save();
    if (window.BayouAudio) window.BayouAudio.setVolume(state.settings.volume);
  });
  // reset flow: bury it behind a confirm step
  $("resetBtn").addEventListener("click", () => { $("resetConfirm").style.display = "block"; $("resetBtn").style.display = "none"; });
  $("resetNo").addEventListener("click", () => { $("resetConfirm").style.display = "none"; $("resetBtn").style.display = ""; });
  $("resetYes").addEventListener("click", hardReset);

  /* ---------- INPUT ---------- */
  function act(x, y) {
    if ($("catchCard").classList.contains("show")) { $("catchCard").classList.remove("show"); return; }
    if (state.phase === "idle") cast(x, y);
    else if (state.phase === "bite") strike();
    // fighting is driven by press-and-hold (pointer handlers below), not click
    else if (state.phase === "nibble") {
      clearTimers();
      state.phase = "idle";
      resetTackle();
      setMsg("A little eager there. It was just window shopping.", "wait for the full dunk next time");
    }
  }

  // audio can only start after a user gesture (browser autoplay policy)
  ["pointerdown", "keydown", "touchstart"].forEach(ev =>
    document.addEventListener(ev, ensureAudio, { once: true }));

  scene.addEventListener("click", e => {
    const wr = water.getBoundingClientRect();
    if (state.phase === "idle" && e.clientY < wr.top) {
      setMsg("That's the sky. Ambitious, but the fish are lower.");
      return;
    }
    act(e.clientX, e.clientY);
  });
  btn.addEventListener("click", e => { e.stopPropagation(); act(); });

  // press-and-hold to reel during a fight (touch + mouse)
  function reelStart(e) {
    if (state.phase !== "fighting") return;
    if (e.target.closest("#toolbar") || e.target.closest(".panel") || e.target.closest("#catchCard")) return;
    reeling = true;
    fightTap(); // immediate crank on press for responsiveness
  }
  function reelStop() { reeling = false; }
  scene.addEventListener("pointerdown", reelStart);
  btn.addEventListener("pointerdown", reelStart);
  window.addEventListener("pointerup", reelStop);
  window.addEventListener("pointercancel", reelStop);

  document.addEventListener("keydown", e => {
    if (e.code === "Space") {
      e.preventDefault();
      if (state.phase === "fighting") fightTap(); // keyboard reels in cranks
      else act();
    }
    if (e.key === "Escape") { closeAllPanels(); $("catchCard").classList.remove("show"); }
  });

  /* ---------- BOOT ---------- */
  load();
  if (!isUnlocked(state.locationId)) state.locationId = "pond"; // safety net
  scatter();
  startSwimmers();
  applySettingsUI();
  startDayNight();
  startWeather();
  applyTheme(loc());
  rollDaily();      // fresh daily challenge + streak update
  ensureBounties(); // always have a few favors waiting at the landing
  updateStats();
  renderLog();
  checkTrotline(); // welcome-back gift if a line was soaking
  if (dailyAnnounce) setMsg(`New day on the bayou. <b>Today:</b> ${state.daily.text.toLowerCase()}.`, "tap the water whenever");
  // A returning player should land exactly where they left off.
  if (state.stats.catches || state.stats.junk) {
    setMsg("Right where you left it. The fish kept your spot warm.",
           "cast whenever — the bayou waited");
  }
})();
