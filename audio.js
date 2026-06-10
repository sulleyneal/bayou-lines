/* ============================================================
   BAYOU LINES — audio.js  (generative soundscape, v2)
   Layered ambient + an adaptive procedural music bed, all from the
   Web Audio API (no files, works offline). Reacts to time of day,
   weather, season, and whether you're on the coast.
   Exposes window.BayouAudio.
   ============================================================ */
(function () {
  "use strict";

  let ctx = null, master = null, ambient = null, musicBus = null, revBus = null;
  let started = false, muted = false, volume = 0.6, noiseBuf = null;
  const timers = [];
  const nodes = [];                 // long-lived sources to stop on teardown
  let scene = { phase: "dusk", weather: "clear", coastal: false, season: "summer" };

  // ---------- helpers ----------
  function makeNoise(seconds) {
    const len = ctx.sampleRate * (seconds || 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    return buf;
  }
  function gain(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function lp(f, q) { const n = ctx.createBiquadFilter(); n.type = "lowpass"; n.frequency.value = f; if (q) n.Q.value = q; return n; }
  function bp(f, q) { const n = ctx.createBiquadFilter(); n.type = "bandpass"; n.frequency.value = f; n.Q.value = q || 1; return n; }
  function looper(buf) { const s = ctx.createBufferSource(); s.buffer = buf || noiseBuf; s.loop = true; return s; }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const choose = arr => arr[(Math.random() * arr.length) | 0];

  function init() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = gain(muted ? 0 : volume); master.connect(ctx.destination);
      // reverb bus: two feedback delays summed → a soft wash
      revBus = gain(1);
      const mk = (t) => { const d = ctx.createDelay(1); d.delayTime.value = t; const fb = gain(0.42); const f = lp(2200); d.connect(f); f.connect(fb); fb.connect(d); return d; };
      const d1 = mk(0.13), d2 = mk(0.197), revIn = gain(1), revOut = gain(0.5);
      revIn.connect(d1); revIn.connect(d2); d1.connect(revOut); d2.connect(revOut); revOut.connect(master);
      revBus.connect(revIn);
      ambient = gain(0.0001); ambient.connect(master);
      musicBus = gain(0.0001); musicBus.connect(master);
      noiseBuf = makeNoise(3);
      return true;
    } catch (e) { ctx = null; return false; }
  }

  // ---------- continuous ambient layers (built once, modulated by scene) ----------
  let L = {}; // layer handles

  function buildAmbient() {
    // water lap
    const water = looper(); const wf = lp(scene.coastal ? 560 : 360); const wg = gain(0.10);
    const wlfo = ctx.createOscillator(); wlfo.frequency.value = 0.12; const wlfoG = gain(0.05);
    wlfo.connect(wlfoG); wlfoG.connect(wg.gain);
    water.connect(wf); wf.connect(wg); wg.connect(ambient); water.start(); wlfo.start();
    nodes.push(water, wlfo); L.waterG = wg; L.waterF = wf;

    // wind (slow swelling band of noise)
    const wind = looper(); const windF = bp(480, 0.7); const windG = gain(0.0);
    const windLfo = ctx.createOscillator(); windLfo.frequency.value = 0.05; const windLfoG = gain(0.03);
    windLfo.connect(windLfoG); windLfoG.connect(windG.gain);
    wind.connect(windF); windF.connect(windG); windG.connect(ambient); wind.start(); windLfo.start();
    nodes.push(wind, windLfo); L.windG = windG;

    // day insects (cicada shimmer): bandpass noise + fast tremolo
    const cic = looper(); const cicF = bp(4200, 7); const cicG = gain(0.0);
    const cicTrem = ctx.createOscillator(); cicTrem.type = "sine"; cicTrem.frequency.value = 11; const cicTremG = gain(0.02);
    cicTrem.connect(cicTremG); cicTremG.connect(cicG.gain);
    cic.connect(cicF); cicF.connect(cicG); cicG.connect(ambient); cic.start(); cicTrem.start();
    nodes.push(cic, cicTrem); L.cicadaG = cicG;

    // night crickets: higher bandpass noise + faster shimmer
    const cri = looper(); const criF = bp(6300, 9); const criG = gain(0.0);
    const criTrem = ctx.createOscillator(); criTrem.type = "sine"; criTrem.frequency.value = 18; const criTremG = gain(0.02);
    criTrem.connect(criTremG); criTremG.connect(criG.gain);
    cri.connect(criF); criF.connect(criG); criG.connect(ambient); cri.start(); criTrem.start();
    nodes.push(cri, criTrem); L.cricketG = criG;

    applySceneToAmbient(true);
  }

  function ramp(param, v, t) { try { param.linearRampToValueAtTime(v, ctx.currentTime + (t || 1.5)); } catch (e) { param.value = v; } }

  function applySceneToAmbient(initial) {
    const night = scene.phase === "night", dusk = scene.phase === "dusk", day = scene.phase === "day" || scene.phase === "golden";
    // crossfade day cicadas vs night crickets
    ramp(L.cicadaG.gain, day ? 0.03 : (dusk ? 0.012 : 0.004), 6);
    ramp(L.cricketG.gain, night ? 0.03 : (dusk ? 0.02 : 0.004), 6);
    // water + wind by weather/coast
    ramp(L.waterG.gain, scene.coastal ? 0.17 : 0.10, 3);
    ramp(L.waterF.frequency, scene.coastal ? 560 : 360, 3);
    const windy = scene.weather === "front" || scene.weather === "rain";
    ramp(L.windG.gain, (scene.coastal ? 0.05 : 0.02) + (windy ? 0.05 : 0), 4);
  }

  // ---------- scheduled one-shots (gated by current scene) ----------
  function voice(freq, type, peak, atk, dec, dest) {
    const o = ctx.createOscillator(); o.type = type || "sine"; o.frequency.value = freq;
    const g = ctx.createGain(); const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + atk + dec);
    o.connect(g); g.connect(dest || ambient);
    o.start(); o.stop(t + atk + dec + 0.05); return o;
  }
  function noiseHit(peak, dur, lpf, dest) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = lp(lpf || 1200);
    const g = ctx.createGain(); const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || ambient); s.start(); s.stop(t + dur + 0.05);
  }
  function bird() { const f = rnd(1500, 2700); voice(f, "sine", 0.05, 0.02, 0.12, revBus); setTimeout(() => voice(f * 1.16, "sine", 0.04, 0.02, 0.1, revBus), 120); }
  function owl() { const f = rnd(300, 380); voice(f, "sine", 0.06, 0.05, 0.32, revBus); setTimeout(() => voice(f * 0.94, "sine", 0.05, 0.05, 0.4, revBus), 360); }
  function frog() { const f = rnd(150, 230); const o = voice(f, "sawtooth", 0.05, 0.02, 0.16, ambient); if (o) { try { o.frequency.setValueAtTime(f * 1.3, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(f, ctx.currentTime + 0.12); } catch (e) {} } }
  function gull() { const f = rnd(900, 1300); voice(f, "sawtooth", 0.035, 0.03, 0.18, revBus); setTimeout(() => voice(f * 0.9, "sawtooth", 0.03, 0.03, 0.2, revBus), 200); }
  function boat() { const o = voice(64, "sine", 0.05, 0.5, 2.4, ambient); if (o) { try { o.frequency.linearRampToValueAtTime(54, ctx.currentTime + 2.6); } catch (e) {} } }
  function thunder() { noiseHit(0.12, 2.6, 220, revBus); setTimeout(() => noiseHit(0.08, 1.8, 160, revBus), 280); }

  function startSchedulers() {
    const loop = (fn, lo, hi) => { const t = () => { if (!ctx) return; fn(); timers.push(setTimeout(t, rnd(lo, hi))); }; timers.push(setTimeout(t, rnd(lo, hi))); };
    // each checks scene before sounding
    loop(() => { const p = scene.phase; if ((p === "day" || p === "golden" || p === "dawn") && !scene.coastal && Math.random() < 0.7) bird(); }, 9000, 20000);
    loop(() => { if (scene.phase === "night" && !scene.coastal && Math.random() < 0.6) owl(); }, 14000, 30000);
    loop(() => { if ((scene.phase === "dusk" || scene.phase === "night") && Math.random() < 0.7) frog(); }, 5000, 13000);
    loop(() => { if (scene.coastal && Math.random() < 0.7) gull(); }, 7000, 16000);
    loop(() => { if (!scene.coastal && Math.random() < 0.4) boat(); }, 22000, 55000);
    loop(() => { if ((scene.weather === "front" || scene.weather === "rain") && Math.random() < 0.6) thunder(); }, 11000, 26000);
  }

  // ---------- adaptive music bed ----------
  const MAJ = [0, 2, 4, 7, 9], MIN = [0, 3, 5, 7, 10];
  let mus = {};
  // root frequency + scale per phase
  function harmony() {
    switch (scene.phase) {
      case "dawn": return { root: 146.83, scale: MAJ };   // D3 major-pent
      case "day": return { root: 164.81, scale: MAJ };    // E3
      case "golden": return { root: 174.61, scale: MAJ };  // F3 warm
      case "dusk": return { root: 130.81, scale: MIN };    // C3 minor
      default: return { root: 110.00, scale: MIN };        // A2 night, minor
    }
  }

  function buildMusic() {
    const h = harmony();
    const mFilter = lp(scene.coastal ? 1500 : 1100);
    mFilter.connect(musicBus);
    // drone: root + fifth
    mus.d1 = ctx.createOscillator(); mus.d1.type = "sine"; mus.d1.frequency.value = h.root;
    mus.d2 = ctx.createOscillator(); mus.d2.type = "sine"; mus.d2.frequency.value = h.root * 1.5;
    const dg = gain(0.05);
    const dlfo = ctx.createOscillator(); dlfo.frequency.value = 0.07; const dlfoG = gain(0.02); dlfo.connect(dlfoG); dlfoG.connect(dg.gain);
    mus.d1.connect(dg); mus.d2.connect(dg); dg.connect(mFilter);
    // pad chord one octave up (root, third, fifth)
    mus.p = [0, h.scale === MAJ ? 4 : 3, 7].map(semi => { const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = h.root * 2 * Math.pow(2, semi / 12); return o; });
    const pg = gain(0.022); mus.p.forEach(o => o.connect(pg)); pg.connect(mFilter);
    [mus.d1, mus.d2, dlfo, ...mus.p].forEach(o => { o.start(); nodes.push(o); });
    mus.dg = dg; mus.pg = pg; mus.filter = mFilter; mus.h = h;
    // sparse melody scheduler
    const melody = () => {
      if (!ctx || !mus.h) return;
      const sparse = (scene.phase === "night") ? [7000, 14000] : [4500, 9000];
      const semi = choose(mus.h.scale) + (Math.random() < 0.4 ? 12 : 0);
      const f = mus.h.root * 2 * Math.pow(2, semi / 12);
      const g = ctx.createGain(); const t = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + rnd(1.6, 3.2));
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
      o.connect(g); g.connect(mus.filter); g.connect(revBus);
      o.start(); o.stop(t + 4);
      timers.push(setTimeout(melody, rnd(sparse[0], sparse[1])));
    };
    timers.push(setTimeout(melody, 3000));
  }

  function retuneMusic() {
    if (!mus.d1) return;
    const h = harmony(); mus.h = h;
    const t = ctx.currentTime + 4;
    try {
      mus.d1.frequency.linearRampToValueAtTime(h.root, t);
      mus.d2.frequency.linearRampToValueAtTime(h.root * 1.5, t);
      const chord = [0, h.scale === MAJ ? 4 : 3, 7];
      mus.p.forEach((o, i) => o.frequency.linearRampToValueAtTime(h.root * 2 * Math.pow(2, chord[i] / 12), t));
      mus.filter.frequency.linearRampToValueAtTime(scene.coastal ? 1500 : 1100, t);
    } catch (e) {}
  }

  // ---------- lifecycle ----------
  function startAll() {
    if (started) return; started = true;
    buildAmbient(); buildMusic(); startSchedulers();
    ambient.gain.cancelScheduledValues(ctx.currentTime);
    ambient.gain.setValueAtTime(0.0001, ctx.currentTime);
    ambient.gain.exponentialRampToValueAtTime(1.0, ctx.currentTime + 4);
    musicBus.gain.setValueAtTime(0.0001, ctx.currentTime);
    musicBus.gain.exponentialRampToValueAtTime(0.85, ctx.currentTime + 6);
  }

  // ---------- public ----------
  const API = {
    init() { return init(); },
    unlock() { if (!init()) return; if (ctx.state === "suspended") ctx.resume(); startAll(); },
    setMuted(m) { muted = m; if (master) ramp(master.gain, m ? 0 : volume, 0.2); },
    setVolume(v) { volume = v; if (master && !muted) ramp(master.gain, v, 0.1); },
    setLocationMix(isCoastal) { this.setScene({ coastal: isCoastal }); },
    setScene(partial) {
      const prevPhase = scene.phase;
      Object.assign(scene, partial || {});
      if (!ctx || !started) return;
      applySceneToAmbient(false);
      if (scene.phase !== prevPhase) retuneMusic();
    },
    // one-shots
    plop() { if (!ctx) return; const o = voice(420, "sine", 0.16, 0.005, 0.18, master); if (o) { try { o.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.16); } catch (e) {} } noiseHit(0.05, 0.12, 900, master); },
    tick() { if (!ctx) return; voice(1600, "square", 0.04, 0.003, 0.04, master); },
    splash() { if (!ctx) return; noiseHit(0.18, 0.32, 2400, revBus); const o = voice(300, "sine", 0.1, 0.005, 0.22, master); if (o) { try { o.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.22); } catch (e) {} } },
    chime() { if (!ctx) return; [880, 1318.5, 1760].forEach((f, i) => setTimeout(() => voice(f, "sine", 0.11 - i * 0.02, 0.01, 0.6, revBus), i * 90)); },
  };

  window.BayouAudio = API;
})();
