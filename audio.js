/* ============================================================
   BAYOU LINES — audio.js
   Generative ambient + soft one-shots via the Web Audio API.
   No external dependency, so it still works on a double-click,
   offline. Everything no-ops gracefully if audio is unavailable.
   Exposes window.BayouAudio.
   ============================================================ */
(function () {
  "use strict";

  let ctx = null, master = null, ambientGain = null;
  let started = false, muted = false, volume = 0.6, coastal = false;
  let noiseBuf = null;
  const timers = [];

  // ---- a little reusable noise buffer (soft pink-ish) ----
  function makeNoise() {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;   // gentle low-pass = pinker noise
      d[i] = last * 3.2;
    }
    return buf;
  }

  function init() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : volume;
      master.connect(ctx.destination);
      ambientGain = ctx.createGain();
      ambientGain.gain.value = 0.0;
      ambientGain.connect(master);
      noiseBuf = makeNoise();
      return true;
    } catch (e) { ctx = null; return false; }
  }

  // ---- continuous ambient bed ----
  function startAmbient() {
    if (!ctx || started) return;
    started = true;

    // 1) water lapping: looping noise → lowpass, slow gain wobble
    const water = ctx.createBufferSource();
    water.buffer = noiseBuf; water.loop = true;
    const waterLP = ctx.createBiquadFilter();
    waterLP.type = "lowpass"; waterLP.frequency.value = coastal ? 520 : 360;
    const waterGain = ctx.createGain(); waterGain.gain.value = coastal ? 0.16 : 0.10;
    const waterLFO = ctx.createOscillator(); waterLFO.frequency.value = 0.13;
    const waterLFOg = ctx.createGain(); waterLFOg.gain.value = coastal ? 0.07 : 0.04;
    waterLFO.connect(waterLFOg); waterLFOg.connect(waterGain.gain);
    water.connect(waterLP); waterLP.connect(waterGain); waterGain.connect(ambientGain);
    water.start(); waterLFO.start();

    // 2) insect bed (crickets/cicadas): bandpassed noise with tremolo
    const bugs = ctx.createBufferSource();
    bugs.buffer = noiseBuf; bugs.loop = true;
    const bugBP = ctx.createBiquadFilter();
    bugBP.type = "bandpass"; bugBP.frequency.value = coastal ? 1800 : 4200; bugBP.Q.value = 6;
    const bugGain = ctx.createGain(); bugGain.gain.value = 0.0;
    const trem = ctx.createOscillator(); trem.type = "sine"; trem.frequency.value = coastal ? 4 : 11;
    const tremG = ctx.createGain(); tremG.gain.value = coastal ? 0.012 : 0.02;
    trem.connect(tremG); tremG.connect(bugGain.gain);
    bugs.connect(bugBP); bugBP.connect(bugGain); bugGain.connect(ambientGain);
    bugs.start(); trem.start();
    // settle the bug bed to a low baseline
    bugGain.gain.setValueAtTime(0.0, ctx.currentTime);
    bugGain.gain.linearRampToValueAtTime(coastal ? 0.018 : 0.03, ctx.currentTime + 4);

    // 3) fade the whole bed in
    ambientGain.gain.cancelScheduledValues(ctx.currentTime);
    ambientGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    ambientGain.gain.exponentialRampToValueAtTime(1.0, ctx.currentTime + 3.5);

    scheduleOccasional();
  }

  // ---- occasional one-shots woven into the bed (birds / boat / gulls) ----
  function scheduleOccasional() {
    const tick = () => {
      if (!ctx) return;
      if (coastal) { if (Math.random() < 0.6) gull(); }
      else { if (Math.random() < 0.5) Math.random() < 0.7 ? bird() : distantBoat(); }
      timers.push(setTimeout(tick, 9000 + Math.random() * 16000));
    };
    timers.push(setTimeout(tick, 6000 + Math.random() * 8000));
  }

  // ---- voice helpers ----
  function env(node, peak, attack, decay) {
    const t = ctx.currentTime;
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  function tone(freq, type, peak, attack, decay, dest) {
    if (!ctx) return;
    const o = ctx.createOscillator(); o.type = type || "sine"; o.frequency.value = freq;
    const g = ctx.createGain(); env(g, peak, attack, decay);
    o.connect(g); g.connect(dest || master);
    o.start(); o.stop(ctx.currentTime + attack + decay + 0.05);
    return o;
  }
  function noiseBurst(peak, dur, lpFreq, dest) {
    if (!ctx) return;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = lpFreq || 1200;
    const g = ctx.createGain(); env(g, peak, 0.005, dur);
    s.connect(lp); lp.connect(g); g.connect(dest || master);
    s.start(); s.stop(ctx.currentTime + dur + 0.05);
  }

  function bird() { const f = 1400 + Math.random() * 1200; tone(f, "sine", 0.05, 0.02, 0.12, ambientGain); setTimeout(() => tone(f * 1.18, "sine", 0.04, 0.02, 0.1, ambientGain), 130); }
  function gull() { const f = 900 + Math.random() * 300; tone(f, "sawtooth", 0.035, 0.03, 0.18, ambientGain); setTimeout(() => tone(f * 0.92, "sawtooth", 0.03, 0.03, 0.2, ambientGain), 200); }
  function distantBoat() { const o = tone(70, "sine", 0.05, 0.4, 2.2, ambientGain); if (o) { try { o.frequency.linearRampToValueAtTime(58, ctx.currentTime + 2.4); } catch (e) {} } }

  // ---- public one-shots ----
  const API = {
    init() { return init(); },
    // call on the first user gesture
    unlock() {
      if (!init()) return;
      if (ctx.state === "suspended") ctx.resume();
      startAmbient();
    },
    setMuted(m) { muted = m; if (master) master.gain.linearRampToValueAtTime(m ? 0 : volume, (ctx ? ctx.currentTime : 0) + 0.2); },
    setVolume(v) { volume = v; if (master && !muted) master.gain.linearRampToValueAtTime(v, ctx.currentTime + 0.1); },
    setLocationMix(isCoastal) {
      const change = isCoastal !== coastal;
      coastal = isCoastal;
      if (started && change) { // rebuild the bed for the new soundscape
        timers.forEach(clearTimeout); timers.length = 0;
        started = false;
        // quick crossfade
        if (ambientGain) ambientGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
        setTimeout(startAmbient, 700);
      }
    },
    plop() { if (!ctx) return; const o = tone(420, "sine", 0.16, 0.005, 0.18); if (o) { try { o.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.16); } catch (e) {} } noiseBurst(0.05, 0.12, 900); },
    tick() { if (!ctx) return; tone(1600, "square", 0.04, 0.003, 0.04); },
    splash() { if (!ctx) return; noiseBurst(0.18, 0.32, 2400); const o = tone(300, "sine", 0.1, 0.005, 0.22); if (o) { try { o.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.22); } catch (e) {} } },
    chime() { if (!ctx) return; tone(880, "sine", 0.12, 0.01, 0.5); setTimeout(() => tone(1318.5, "sine", 0.1, 0.01, 0.6), 90); setTimeout(() => tone(1760, "sine", 0.08, 0.01, 0.7), 180); },
  };

  window.BayouAudio = API;
})();
