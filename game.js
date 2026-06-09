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
    locationId: "darbonne",        // (travel arrives in a later step)
    stats: { catches: 0, junk: 0, pb: 0, pbName: "" },
    log: [],
    settings: { muted: false, volume: 0.6 },
  };

  /* ---------- PERSISTENCE ----------
     Everything but the transient `phase` is saved. Loading deep-merges
     onto defaults so old saves survive new fields in future versions. */
  const SAVE_FIELDS = ["locationId", "stats", "log", "settings"];
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

  function pickFish() {
    const table = catchTable();
    const total = table.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * total;
    for (const e of table) { if ((r -= e.weight) <= 0) return e.def; }
    return table[0].def;
  }

  function pickJunk() {
    const keys = loc().junk;
    return D.JUNK[pick(keys)];
  }

  function junkChance() { return 0.22; } // lures shift this in a later step

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

  function reelWindowMs() { return D.EQUIPMENT.rod[0].biteWindow; } // rod track wires in later

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
      state.stats.junk++;
      addLog({ emoji: j.emoji, name: j.name, meta: "junk" });
      showCard(j.emoji, "junk haul", j.name, "non-aquatic · released back to society", "", pick([].concat(j.flavor)), "junk");
    } else {
      const f = pickFish();
      const w = +rand(f.w[0], f.w[1]).toFixed(1);
      state.stats.catches++;
      const isPB = w > state.stats.pb;
      if (isPB) { state.stats.pb = w; state.stats.pbName = f.name; }
      const badge = f.legendary ? "legendary" : "catch";
      const cls = f.legendary ? "legendary" : "";
      addLog({ emoji: f.emoji, name: f.name, meta: w + " lb", pb: isPB, legend: !!f.legendary });
      showCard(f.emoji, badge, f.name,
        w + " lb · catch & release" + (isPB ? " · new personal best" : ""),
        "", pick(f.flavor), cls);
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
    $("stPB").textContent = state.stats.pb ? state.stats.pb + " lb" : "—";
    const l = loc();
    $("locName").textContent = l.name;
    $("locBlurb").textContent = l.blurb;
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

  /* ---------- PANELS (generic open/close) ---------- */
  function openPanel(id) { $(id).classList.add("open"); }
  function closePanel(id) { $(id).classList.remove("open"); }
  function closeAllPanels() { document.querySelectorAll(".panel.open").forEach(p => p.classList.remove("open")); }
  $("logBtn").addEventListener("click", () => openPanel("logPanel"));
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
  scatter();
  applySettingsUI();
  updateStats();
  renderLog();
  // A returning player should land exactly where they left off.
  if (state.stats.catches || state.stats.junk) {
    setMsg("Right where you left it. The fish kept your spot warm.",
           "cast whenever — the bayou waited");
  }
})();
