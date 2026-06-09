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
    stats: { catches: 0, junk: 0, pb: 0, pbName: "", perLoc: {} },
    log: [],
    settings: { muted: false, volume: 0.6 },
  };

  /* ---------- PERSISTENCE ----------
     Everything but the transient `phase` is saved. Loading deep-merges
     onto defaults so old saves survive new fields in future versions. */
  const SAVE_FIELDS = ["locationId", "unlocked", "bucks", "equip", "stats", "log", "settings"];
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
    const weighted = table.map(e => {
      let w = e.weight * (lr.bias[refKey(e.def)] || 1);
      w *= 1 + lr.rarityBoost * ((maxW - e.weight) / maxW);
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

  function pickJunk() { return D.JUNK[pick(loc().junk)]; }
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
    return Math.max(1, Math.round(w * f.value));
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
    for (let i = 0; i < 9; i++) {
      const f = document.createElement("div"); f.className = "firefly";
      f.style.left = (Math.random() * 92) + "%";
      f.style.top = (34 + Math.random() * 40) + "%";
      f.style.animationDelay = (Math.random() * 8) + "s, " + (Math.random() * 3) + "s";
      f.style.animationDuration = (10 + Math.random() * 10) + "s, " + (2.6 + Math.random() * 2) + "s";
      scene.appendChild(f);
    }
  }

  function ripple(x, y) {
    const r = document.createElement("div"); r.className = "ripple";
    r.style.left = x + "px"; r.style.top = y + "px";
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 1700);
  }

  function setMsg(main, sub) {
    msg.innerHTML = main + (sub ? '<span class="sub">' + sub + "</span>" : "");
  }

  /* ---------- IDLE FLAVOR ---------- */
  function idleLine() {
    const l = loc();
    return pick(l.idle.concat(D.GENERIC.nibble.length ? [] : []));
  }
  function startIdleTicker() {
    stopIdleTicker();
    idleTicker = setInterval(() => {
      if (state.phase === "waiting") setMsg(pick(loc().idle));
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

    state.phase = "waiting";
    btn.textContent = "Wait for it…";
    btn.classList.remove("urgent");
    setMsg("Line's in. Now we do the hard part: nothing.");
    startIdleTicker();

    const wait = rand(D.CONFIG.baseWaitMs[0], D.CONFIG.baseWaitMs[1]);
    biteTimer = setTimeout(nibble, wait);
  }

  function nibble() {
    state.phase = "nibble";
    stopIdleTicker();
    bobber.className = "nibble";
    ripple(bobberPos.x, bobberPos.y);
    setMsg(pick(D.GENERIC.nibble));
    nibbleTimer = setTimeout(bite, rand(D.CONFIG.nibbleMs[0], D.CONFIG.nibbleMs[1]));
  }

  function reelWindowMs() { return rod().biteWindow; }

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

  function reel() {
    clearTimers();
    state.phase = "idle";
    resetTackle();
    ripple(bobberPos.x, bobberPos.y);

    if (Math.random() < junkChance()) {
      const j = pickJunk();
      const pity = Math.round(rand(D.CONFIG.junkPity[0], D.CONFIG.junkPity[1]));
      state.stats.junk++;
      state.bucks += pity;
      addLog({ emoji: j.emoji, name: j.name, meta: "junk" });
      showCard(j.emoji, "junk haul", j.name, "non-aquatic · released back to society",
        "+" + pity + " ₿ · the parish pays for litter removal, technically", pick([].concat(j.flavor)), "junk");
    } else {
      const f = pickFish();
      const w = +rand(f.w[0], f.w[1]).toFixed(1);
      if (breakOff(f, w)) {
        addLog({ emoji: "〰️", name: "The one that got away", meta: "snap" });
        showCard("〰️", "got away", "The one that got away", "no harm done · no score kept",
          "", pick(D.GENERIC.breakoff), "junk");
        updateStats(); save();
        setMsg("Heavier line lives at the tackle shop, when you're ready. No rush.");
        return;
      }
      const bucks = payout(f, w);
      state.stats.catches++;
      state.stats.perLoc[state.locationId] = (state.stats.perLoc[state.locationId] || 0) + 1;
      state.bucks += bucks;
      const isPB = w > state.stats.pb;
      if (isPB) { state.stats.pb = w; state.stats.pbName = f.name; }
      const badge = f.legendary ? "legendary" : "catch";
      const cls = f.legendary ? "legendary" : "";
      addLog({ emoji: f.emoji, name: f.name, meta: w + " lb", pb: isPB, legend: !!f.legendary });
      showCard(f.emoji, badge, f.name,
        w + " lb · catch & release" + (isPB ? " · new personal best" : ""),
        "+" + bucks + " ₿", pick(f.flavor), cls);
    }
    updateStats();
    save();
    setMsg("Back to the water whenever you're ready. No rush. Genuinely none.");
  }

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
  }

  function showCard(emoji, badge, name, detail, value, flavor, cls) {
    $("catchEmoji").textContent = emoji;
    const b = $("catchBadge"); b.textContent = badge; b.className = "badge " + (cls || "");
    $("catchName").textContent = name;
    $("catchDetail").textContent = detail;
    $("catchValue").textContent = value || "";
    $("catchFlavor").textContent = flavor;
    $("catchCard").classList.add("show");
  }
  $("catchClose").addEventListener("click", () => $("catchCard").classList.remove("show"));

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

  function renderTravel() {
    $("travelBody").innerHTML = D.LOCATIONS.map(l => {
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
  }

  function unlockAndGo(id) {
    const l = D.LOCATIONS.find(x => x.id === id);
    const g = gate(l);
    if (!g.open || isUnlocked(id)) return;
    if (l.unlock && l.unlock.bucks) state.bucks -= l.unlock.bucks; // permit cost
    state.unlocked.push(id);
    if (window.BayouAudio) window.BayouAudio.chime();
    travelTo(id, true);
  }

  function travelTo(id, fresh) {
    if (!isUnlocked(id)) return;
    if (state.phase !== "idle") { miss(); } // reel in before we run off
    state.locationId = id;
    const l = D.LOCATIONS.find(x => x.id === id);
    applyTheme(l);
    updateStats();
    save();
    closePanel("travelPanel");
    setMsg(fresh ? `Permit secured. Welcome to <b>${l.name}</b>.` : `Now fishing <b>${l.name}</b>.`,
      pick(l.idle));
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
    setMsg(`New gear: <b>${t.name}</b>.`, "broke in on the next cast");
  }

  /* ---------- PANELS (generic open/close) ---------- */
  function openPanel(id) { $(id).classList.add("open"); }
  function closePanel(id) { $(id).classList.remove("open"); }
  function closeAllPanels() { document.querySelectorAll(".panel.open").forEach(p => p.classList.remove("open")); }
  $("logBtn").addEventListener("click", () => openPanel("logPanel"));
  $("shopBtn").addEventListener("click", () => { renderShop(); openPanel("shopPanel"); });
  $("travelBtn").addEventListener("click", () => { renderTravel(); openPanel("travelPanel"); });
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
    else if (state.phase === "bite") reel();
    else if (state.phase === "nibble") {
      clearTimers();
      state.phase = "idle";
      resetTackle();
      setMsg("A little eager there. It was just window shopping.", "wait for the full dunk next time");
    }
  }

  scene.addEventListener("click", e => {
    const wr = water.getBoundingClientRect();
    if (state.phase === "idle" && e.clientY < wr.top) {
      setMsg("That's the sky. Ambitious, but the fish are lower.");
      return;
    }
    act(e.clientX, e.clientY);
  });
  btn.addEventListener("click", e => { e.stopPropagation(); act(); });
  document.addEventListener("keydown", e => {
    if (e.code === "Space") { e.preventDefault(); act(); }
    if (e.key === "Escape") { closeAllPanels(); $("catchCard").classList.remove("show"); }
  });

  /* ---------- BOOT ---------- */
  load();
  if (!isUnlocked(state.locationId)) state.locationId = "pond"; // safety net
  scatter();
  applySettingsUI();
  applyTheme(loc());
  updateStats();
  renderLog();
  // A returning player should land exactly where they left off.
  if (state.stats.catches || state.stats.junk) {
    setMsg("Right where you left it. The fish kept your spot warm.",
           "cast whenever — the bayou waited");
  }
})();
