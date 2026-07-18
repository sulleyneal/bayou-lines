/* ============================================================
   BAYOU LINES — fishart.js
   A small procedural fish illustrator. Each species is drawn as a
   stylized SVG from an archetype + colors + pattern, so the game
   shows real drawn fish instead of emoji. Cohesive, flat, dusk-toned.
   Exposes window.FishArt.svg(ref, {w,h}) -> SVG string.
   ============================================================ */
(function () {
  "use strict";

  // ---------- body archetypes (fish faces LEFT: nose small-x, tail large-x) ----------
  // bodyH: half-height of body · tailBaseH: half-height where tail meets body
  // backPeak: 0..1 along body where the back is highest · bulge: belly bulge factor
  //   (NB: archetype 'bulge' is a ratio; per-species 'belly' below is a color —
  //    kept distinct on purpose so Object.assign can't collide them)
  // tail: 'fork' | 'round' | 'fan' · snout: extra nose length · barbels: catfish whiskers
  // dorsal: {x0,x1,h} back fin span · longDorsal: bowfin-style ribbon
  const ARCH = {
    panfish:  { bodyH: 23, tailBaseH: 7, backPeak: 0.44, bulge: 1.0, tail: "fork", tailLen: 16, tailSpread: 15, dorsal: { x0: 0.30, x1: 0.66, h: 11 }, anal: true, scales: true },
    bass:     { bodyH: 17, tailBaseH: 6, backPeak: 0.40, bulge: 0.85, tail: "fork", tailLen: 18, tailSpread: 15, dorsal: { x0: 0.34, x1: 0.64, h: 9 }, mouth: 6, scales: true },
    catfish:  { bodyH: 16, tailBaseH: 6, backPeak: 0.34, bulge: 0.7, tail: "fork", tailLen: 17, tailSpread: 13, barbels: true, blunt: 5, dorsal: { x0: 0.30, x1: 0.40, h: 9 } },
    gar:      { bodyH: 9,  tailBaseH: 5, backPeak: 0.52, bulge: 0.5, tail: "round", tailLen: 13, tailSpread: 9, snout: 22, dorsal: { x0: 0.66, x1: 0.80, h: 7 } },
    bowfin:   { bodyH: 14, tailBaseH: 8, backPeak: 0.5, bulge: 0.6, tail: "round", tailLen: 12, tailSpread: 11, longDorsal: true },
    drum:     { bodyH: 22, tailBaseH: 6, backPeak: 0.32, bulge: 0.78, tail: "fork", tailLen: 15, tailSpread: 13, dorsal: { x0: 0.30, x1: 0.66, h: 10 }, humped: true, scales: true },
    silver:   { bodyH: 15, tailBaseH: 6, backPeak: 0.40, bulge: 0.8, tail: "fork", tailLen: 18, tailSpread: 16, dorsal: { x0: 0.34, x1: 0.6, h: 8 }, scales: true },
    redfish:  { bodyH: 16, tailBaseH: 6, backPeak: 0.36, bulge: 0.78, tail: "fork", tailLen: 17, tailSpread: 13, dorsal: { x0: 0.32, x1: 0.62, h: 9 }, scales: true },
    trout:    { bodyH: 15, tailBaseH: 6, backPeak: 0.42, bulge: 0.85, tail: "fork", tailLen: 16, tailSpread: 12, dorsal: { x0: 0.36, x1: 0.56, h: 8 }, adipose: true },
    flat:     { bodyH: 26, tailBaseH: 7, backPeak: 0.5, bulge: 1.0, tail: "fan", tailLen: 12, tailSpread: 16, flat: true },
    deep:     { bodyH: 24, tailBaseH: 6, backPeak: 0.4, bulge: 0.9, tail: "fork", tailLen: 14, tailSpread: 13, dorsal: { x0: 0.3, x1: 0.66, h: 11 }, scales: true },
    pike:     { bodyH: 11, tailBaseH: 6, backPeak: 0.52, bulge: 0.74, tail: "fork", tailLen: 15, tailSpread: 11, snout: 8, dorsal: { x0: 0.60, x1: 0.80, h: 7 } },
    paddle:   { bodyH: 13, tailBaseH: 7, backPeak: 0.42, bulge: 0.72, tail: "fork", tailLen: 18, tailSpread: 15, snout: 26, dorsal: { x0: 0.62, x1: 0.78, h: 7 } },
  };

  // ---------- per-species look ----------
  // arch, back(top color), belly(bottom), fin, pattern:none|spots|stripes|speckle|mottle|barred,
  // pat(pattern color), spot(named accent like a tail/gill spot)
  const P = {
    bluegill:    { arch: "panfish", back: "#5f7348", belly: "#caa15a", fin: "#46583a", pattern: "barred", pat: "#3c4a30", gillSpot: "#1d2a18", cheek: "#7a8a55" },
    redear:      { arch: "panfish", back: "#6c7a4e", belly: "#d8c184", fin: "#4f5a3a", pattern: "speckle", pat: "#566041", earSpot: "#b4452f" },
    bream:       { arch: "panfish", back: "#62753f", belly: "#cf9f52", fin: "#46583a", pattern: "barred", pat: "#3c4a30", gillSpot: "#202d18" },
    crappie:     { arch: "panfish", back: "#8a9aa0", belly: "#e6ece8", fin: "#6c7c82", pattern: "speckle", pat: "#3b4750" },
    blackcrappie:{ arch: "panfish", back: "#71808a", belly: "#dfe6e4", fin: "#586770", pattern: "mottle", pat: "#2f3a42" },
    smallbass:   { arch: "bass", back: "#4f6f3e", belly: "#e2dca6", fin: "#3c5230", pattern: "stripe1", pat: "#2c3a24" },
    largemouth:  { arch: "bass", back: "#46663a", belly: "#dcd79a", fin: "#33492a", pattern: "stripe1", pat: "#26331f", big: true },
    trophybass:  { arch: "bass", back: "#3f6238", belly: "#d8d493", fin: "#2f4527", pattern: "stripe1", pat: "#212e1b", big: true },
    whitebass:   { arch: "silver", back: "#8f9aa4", belly: "#eef1ee", fin: "#6f7a84", pattern: "stripes", pat: "#5a6570" },
    striper:     { arch: "silver", back: "#5d7886", belly: "#eef2f1", fin: "#48606c", pattern: "stripes", pat: "#33454e" },
    channelcat:  { arch: "catfish", back: "#7d8a90", belly: "#e7e3d4", fin: "#616c72", pattern: "speckle", pat: "#4a545a" },
    bluecat:     { arch: "catfish", back: "#6b7d8e", belly: "#ecebe2", fin: "#52606e", pattern: "none" },
    flathead:    { arch: "catfish", back: "#8a7a3f", belly: "#d8c98a", fin: "#6a5d30", pattern: "mottle", pat: "#5c4f28" },
    spottedgar:  { arch: "gar", back: "#6e7a44", belly: "#cfc184", fin: "#545d33", pattern: "spots", pat: "#2c3318" },
    longnosegar: { arch: "gar", back: "#79854c", belly: "#d6c98c", fin: "#5b6438", pattern: "spots", pat: "#333a1c" },
    alligatorgar:{ arch: "gar", back: "#586444", belly: "#b6ad7e", fin: "#414a31", pattern: "spots", pat: "#262c18", big: true },
    bowfin:      { arch: "bowfin", back: "#46543a", belly: "#9aa06a", fin: "#39452f", pattern: "mottle", pat: "#2a3322", tailEye: "#1c2418" },
    drum:        { arch: "drum", back: "#9a9686", belly: "#e9e6d8", fin: "#76735f", pattern: "none" },
    redfish:     { arch: "redfish", back: "#b9742f", belly: "#e9d3a3", fin: "#9a5a22", pattern: "none", tailEye: "#1c1c1c" },
    speck:       { arch: "trout", back: "#7d8a86", belly: "#eef0ea", fin: "#5f6c68", pattern: "spots", pat: "#39423e", mouth2: "#caa14a" },
    flounder:    { arch: "flat", back: "#7a6a4a", belly: "#b9ad8a", fin: "#5f5238", pattern: "mottle", pat: "#4c4128" },
    sheepshead:  { arch: "deep", back: "#9a9a8e", belly: "#e4e2d6", fin: "#5a5a50", pattern: "barred", pat: "#2e2e2a" },
    blackdrum:   { arch: "deep", back: "#7c7c74", belly: "#cfcdc2", fin: "#56564f", pattern: "barred", pat: "#3a3a36" },
    // ---- new (Cycle 2) ----
    warmouth:    { arch: "panfish", back: "#6a6340", belly: "#c7a558", fin: "#4a4630", pattern: "mottle", pat: "#3e3a24", earSpot: "#7a2f22", cheek: "#8a7a48" },
    yellowbass:  { arch: "silver", back: "#b8a24a", belly: "#efe6c0", fin: "#8a7838", pattern: "stripes", pat: "#4a4224" },
    bullhead:    { arch: "catfish", back: "#5a4a34", belly: "#c9b184", fin: "#463a28", pattern: "none" },
    buffalo:     { arch: "deep", back: "#6b6656", belly: "#bcb6a2", fin: "#4c4a40", pattern: "none" },
    carp:        { arch: "drum", back: "#8a6a3a", belly: "#d8c088", fin: "#6a5228", pattern: "speckle", pat: "#5a4526", barbels: true },
    pickerel:    { arch: "pike", back: "#5c6a3a", belly: "#cfc88a", fin: "#46502c", pattern: "mottle", pat: "#2f3a1e" },
    spoonbill:   { arch: "paddle", back: "#7a8590", belly: "#d2d8d6", fin: "#5c6670", pattern: "none" },
    mullet:      { arch: "silver", back: "#7a8288", belly: "#eef1ef", fin: "#5c646a", pattern: "stripes", pat: "#66707a" },
    // legendaries — base look, larger, with a golden cast
    turtle:      { arch: "panfish", back: "#566b3f", belly: "#9a8a4a", fin: "#3e4f2f", pattern: "mottle", pat: "#3a4528", turtle: true },
    bartholomew: { arch: "bass", back: "#3e6038", belly: "#e6dd95", fin: "#2c4325", pattern: "stripe1", pat: "#202e19", legend: true, big: true },
    cane:        { arch: "bass", back: "#3a5c36", belly: "#e8dd8e", fin: "#284022", pattern: "stripe1", pat: "#1d2b17", legend: true, big: true },
    cypressking: { arch: "bowfin", back: "#3c4a34", belly: "#8a9060", fin: "#2e3a28", pattern: "mottle", pat: "#222a1c", tailEye: "#e8c170", legend: true, big: true },
    drumming:    { arch: "drum", back: "#a89c72", belly: "#efe9d2", fin: "#7c7350", pattern: "none", legend: true, big: true },
    bigtex:      { arch: "bass", back: "#3f5f37", belly: "#ecdf90", fin: "#2c4325", pattern: "stripe1", pat: "#1f2d18", legend: true, big: true },
    grandfather: { arch: "gar", back: "#4f5b3c", belly: "#ada277", fin: "#3a4330", pattern: "spots", pat: "#222818", legend: true, big: true },
    gator:       { arch: "gar", back: "#3f4a36", belly: "#8c8a64", fin: "#2f3829", pattern: "none", legend: true, big: true },
    bullred:     { arch: "redfish", back: "#c87f33", belly: "#f0dcae", fin: "#a5611f", pattern: "none", tailEye: "#1c1c1c", legend: true, big: true },
    // the white whale: pale, ancient, scarred, faintly luminous
    grayghost:   { arch: "gar", back: "#8a93a0", belly: "#e8ecee", fin: "#6b7682", pattern: "mottle", pat: "#aab2bc", legend: true, big: true },
    // the Ghost's kin — paler still, a heavy old catfish-shaped thing
    haint:       { arch: "catfish", back: "#a9b6c0", belly: "#eef3f5", fin: "#899aa4", pattern: "mottle", pat: "#c4cdd4", legend: true, big: true },
  };

  const VB_W = 130, VB_H = 70, MY = 35;
  const r2 = n => Math.round(n * 100) / 100;

  function bodyPath(a) {
    const startX = a.snout ? 12 + a.snout : (a.blunt ? 12 + a.blunt : 14); // where the body proper begins
    const tx = 96, my = MY, H = a.bodyH, tbh = a.tailBaseH;
    const bpx = startX + (tx - startX) * a.backPeak;
    const topPk = my - H, bly = my + H * a.bulge;
    const noseTipX = 12, noseY = my - (a.mouth ? a.mouth * 0.3 : 0);
    // top: nose -> back peak -> tail base top ; bottom back to nose
    return `M ${noseTipX} ${r2(noseY)}
      C ${r2(startX)} ${r2(my - H * 0.55)} ${r2(startX + (bpx - startX) * 0.4)} ${r2(topPk)} ${r2(bpx)} ${r2(topPk)}
      C ${r2(bpx + (tx - bpx) * 0.45)} ${r2(topPk + (a.humped ? 2 : H * 0.06))} ${r2(tx - (tx - bpx) * 0.18)} ${r2(my - tbh)} ${tx} ${r2(my - tbh)}
      L ${tx} ${r2(my + tbh)}
      C ${r2(tx - (tx - bpx) * 0.18)} ${r2(my + tbh)} ${r2(bpx + (tx - bpx) * 0.45)} ${r2(bly)} ${r2(bpx)} ${r2(bly)}
      C ${r2(startX + (bpx - startX) * 0.4)} ${r2(bly)} ${r2(startX)} ${r2(my + H * 0.5)} ${noseTipX} ${r2(noseY + (a.mouth ? a.mouth * 0.6 : 2))} Z`;
  }

  function tailPath(a) {
    const tx = 96, my = MY, tbh = a.tailBaseH, L = a.tailLen, S = a.tailSpread;
    if (a.tail === "round") {
      return `M ${tx} ${my - tbh} Q ${tx + L} ${my - S} ${tx + L} ${my} Q ${tx + L} ${my + S} ${tx} ${my + tbh} Z`;
    }
    if (a.tail === "fan") {
      return `M ${tx} ${my - tbh} L ${tx + L} ${my - S} Q ${tx + L + 3} ${my} ${tx + L} ${my + S} L ${tx} ${my + tbh} Z`;
    }
    // fork
    return `M ${tx} ${my - tbh} L ${tx + L} ${my - S} L ${tx + L * 0.62} ${my} L ${tx + L} ${my + S} L ${tx} ${my + tbh} Z`;
  }

  function dorsalPath(a, col) { // drawn BEHIND the body
    const tx = 96, my = MY, startX = a.snout ? 12 + a.snout : 14;
    if (a.longDorsal) { // bowfin ribbon along the back
      const x0 = startX + (tx - startX) * 0.26, x1 = tx - 1;
      return `<path d="M ${r2(x0)} ${r2(my - a.bodyH * 0.86)} Q ${r2((x0 + x1) / 2)} ${r2(my - a.bodyH - 7)} ${r2(x1)} ${r2(my - a.tailBaseH - 1)} L ${r2(x1)} ${r2(my - a.tailBaseH + 2)} L ${r2(x0)} ${r2(my - a.bodyH * 0.7)} Z" fill="${col}" opacity="0.95"/>`;
    }
    if (a.dorsal) {
      const x0 = startX + (tx - startX) * a.dorsal.x0, x1 = startX + (tx - startX) * a.dorsal.x1;
      const topY = my - a.bodyH;
      return `<path d="M ${r2(x0)} ${r2(topY + 3)} Q ${r2((x0 + x1) / 2)} ${r2(topY - a.dorsal.h)} ${r2(x1)} ${r2(topY + 4)} Z" fill="${col}"/>`;
    }
    return "";
  }
  function frontFins(a, col) { // drawn IN FRONT of the body
    let s = "";
    const tx = 96, my = MY, startX = a.snout ? 12 + a.snout : 14;
    const px = startX + (tx - startX) * 0.27;
    s += `<path d="M ${r2(px)} ${r2(my + 1)} Q ${r2(px + 11)} ${r2(my + a.bodyH * 0.8)} ${r2(px + 1)} ${r2(my + a.bodyH * 0.9)} Q ${r2(px - 3)} ${r2(my + a.bodyH * 0.4)} ${r2(px)} ${r2(my + 1)} Z" fill="${col}" opacity="0.9"/>`;
    if (a.anal) {
      const ax = startX + (tx - startX) * 0.6;
      s += `<path d="M ${r2(ax)} ${r2(my + a.bodyH * 0.72)} Q ${r2(ax + 7)} ${r2(my + a.bodyH + 7)} ${r2(ax + 13)} ${r2(my + a.bodyH * 0.78)} Z" fill="${col}"/>`;
    }
    return s;
  }

  function patternDefs(prof, a, id) {
    const tx = 96, my = MY, startX = a.snout ? 12 + a.snout : 14;
    let s = "";
    const within = `clip-path="url(#bclip${id})"`;
    if (prof.pattern === "spots") {
      let dots = "";
      for (let i = 0; i < 26; i++) {
        const x = startX + Math.random() * (tx - startX);
        const y = my - a.bodyH * 0.7 + Math.random() * a.bodyH * 1.3;
        dots += `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(1.1 + Math.random() * 1.1)}" fill="${prof.pat}" opacity="0.8"/>`;
      }
      s += `<g ${within}>${dots}</g>`;
    } else if (prof.pattern === "speckle") {
      let dots = "";
      for (let i = 0; i < 40; i++) {
        const x = startX + Math.random() * (tx - startX);
        const y = my - a.bodyH * 0.8 + Math.random() * a.bodyH * 1.0;
        dots += `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(0.6 + Math.random() * 0.9)}" fill="${prof.pat}" opacity="0.7"/>`;
      }
      s += `<g ${within}>${dots}</g>`;
    } else if (prof.pattern === "stripes" || prof.pattern === "barred") {
      let lines = "";
      const n = prof.pattern === "stripes" ? 6 : 7;
      for (let i = 1; i <= n; i++) {
        const x = startX + (tx - startX) * (i / (n + 1));
        if (prof.pattern === "stripes") lines += `<rect x="${r2(x)}" y="${my - a.bodyH}" width="1.4" height="${a.bodyH * 2}" fill="${prof.pat}" opacity="0.5"/>`;
        else lines += `<path d="M ${r2(x)} ${my - a.bodyH} q -3 ${a.bodyH} 0 ${a.bodyH * 2}" stroke="${prof.pat}" stroke-width="2.4" fill="none" opacity="0.4"/>`;
      }
      s += `<g ${within}>${lines}</g>`;
    } else if (prof.pattern === "stripe1") { // single lateral line (bass)
      s += `<g ${within}><path d="M ${startX} ${my + 2} Q ${(startX + tx) / 2} ${my + 5} ${tx} ${my} " stroke="${prof.pat}" stroke-width="3.2" fill="none" opacity="0.55" stroke-linecap="round"/></g>`;
    } else if (prof.pattern === "mottle") {
      let blobs = "";
      for (let i = 0; i < 12; i++) {
        const x = startX + Math.random() * (tx - startX);
        const y = my - a.bodyH * 0.6 + Math.random() * a.bodyH * 1.1;
        blobs += `<ellipse cx="${r2(x)}" cy="${r2(y)}" rx="${r2(2 + Math.random() * 3)}" ry="${r2(1.5 + Math.random() * 2)}" fill="${prof.pat}" opacity="0.4"/>`;
      }
      s += `<g ${within}>${blobs}</g>`;
    }
    return s;
  }

  // memo cache: art is deterministic per (ref, size), so generate each once.
  // Keeps catch cards, the Field Guide, the trophy wall, and the 31-row Master
  // Angler ledger from re-rasterizing SVGs and hitching frames.
  const CACHE = {};

  function svg(ref, opts) {
    opts = opts || {};
    const prof = P[ref];
    if (!prof) return null; // caller falls back to emoji
    const w = opts.w || 120, h = opts.h || (w * VB_H / VB_W);
    const ck = ref + "|" + w + "|" + h;
    if (CACHE[ck]) return CACHE[ck];
    const a = Object.assign({}, ARCH[prof.arch], prof);
    const id = ref.replace(/[^a-z0-9]/gi, "");

    // seed Math.random by ref so patterns are stable across renders
    let s = 0; for (let i = 0; i < ref.length; i++) s = (s * 31 + ref.charCodeAt(i)) >>> 0;
    const saved = Math.random;
    Math.random = (function () { let x = s || 1; return function () { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; })();

    const body = bodyPath(a), tail = tailPath(a);
    const dorsal = dorsalPath(a, prof.fin), front = frontFins(a, prof.fin);
    const pat = patternDefs(prof, a, id);
    Math.random = saved;

    const gid = "g" + id, cid = "bclip" + id;
    const startX = a.snout ? 12 + a.snout : 14;
    const glow = ""; // legends get a gold rim on the body instead of a halo
    const sparkle = prof.legend
      ? `<g fill="#f6e6b0"><circle cx="30" cy="${r2(MY - a.bodyH - 3)}" r="1.4"/><circle cx="70" cy="${r2(MY - a.bodyH - 6)}" r="2"/><path d="M 70 ${r2(MY - a.bodyH - 10)} l 1 3 l 3 1 l -3 1 l -1 3 l -1 -3 l -3 -1 l 3 -1 z" opacity="0.9"/></g>`
      : "";
    const bodyStroke = prof.legend ? "#e8c170" : prof.fin;
    const bodyStrokeW = prof.legend ? 1.3 : 0.6;
    const bodyStrokeO = prof.legend ? 0.95 : 0.5;
    const snoutEl = a.snout ? `<path d="M 12 ${MY - 1} L ${12 + a.snout} ${MY - a.tailBaseH * 0.5} L ${12 + a.snout} ${MY + a.tailBaseH * 0.5} L 12 ${MY + 2} Z" fill="url(#${gid})"/>` : "";
    const barbels = a.barbels ? `<g stroke="${prof.fin}" stroke-width="1" fill="none" opacity="0.8" stroke-linecap="round">
        <path d="M 13 ${MY + 1} q -6 4 -9 9"/><path d="M 13 ${MY + 2} q -5 6 -6 12"/>
        <path d="M 14 ${MY - 1} q -7 -2 -11 -1"/></g>` : "";
    const eyeX = a.snout ? 12 + a.snout + 3 : (a.blunt ? 19 : 22), eyeY = MY - a.bodyH * 0.28;
    // a real fish eye: dark ring, tinted iris, black pupil, a single catchlight
    const eyeR = prof.big ? 2.9 : 2.4, iris = prof.eyeIris || "#9a6f24";
    const eye =
      `<circle cx="${eyeX}" cy="${r2(eyeY)}" r="${r2(eyeR)}" fill="#20190f"/>` +
      `<circle cx="${eyeX}" cy="${r2(eyeY)}" r="${r2(eyeR * 0.72)}" fill="${iris}"/>` +
      `<circle cx="${eyeX}" cy="${r2(eyeY)}" r="${r2(eyeR * 0.4)}" fill="#0d0b08"/>` +
      `<circle cx="${r2(eyeX - eyeR * 0.32)}" cy="${r2(eyeY - eyeR * 0.34)}" r="${r2(eyeR * 0.26)}" fill="#f4efe0" opacity="0.92"/>`;
    // gill plate (operculum) — a soft curved seam behind the head
    const gillX = eyeX + (prof.big ? 8 : 6.5);
    const gill = `<g clip-path="url(#${cid})"><path d="M ${r2(gillX)} ${r2(MY - a.bodyH * 0.44)} Q ${r2(gillX - 3.5)} ${r2(MY + 1)} ${r2(gillX - 0.5)} ${r2(MY + a.bodyH * 0.46)}" fill="none" stroke="${mix(prof.back, '#05100a', 0.5)}" stroke-width="0.9" stroke-opacity="0.3" stroke-linecap="round"/></g>`;
    // faint scale rows on scaled species (invisible at small sizes, texture up close)
    let scales = "";
    if (a.scales) {
      const sx0 = startX + (96 - startX) * 0.24;
      for (let c = 0; c < 6; c++) {
        const x = sx0 + c * (96 - sx0) * 0.13;
        for (let rrow = -2; rrow <= 2; rrow++) {
          const y = MY + rrow * (a.bodyH * 0.3) + (c % 2) * (a.bodyH * 0.15);
          scales += `<path d="M ${r2(x)} ${r2(y - 3)} q 3.4 3 0 6" fill="none" stroke="#0b1710" stroke-width="0.5" opacity="0.07"/>`;
        }
      }
      scales = `<g clip-path="url(#${cid})">${scales}</g>`;
    }
    const gillSpot = prof.gillSpot ? `<ellipse cx="${startX + (96 - startX) * 0.3}" cy="${MY + a.bodyH * 0.1}" rx="3.4" ry="5" fill="${prof.gillSpot}" opacity="0.85"/>` : "";
    const earSpot = prof.earSpot ? `<ellipse cx="${startX + (96 - startX) * 0.28}" cy="${MY - a.bodyH * 0.1}" rx="3" ry="4.2" fill="${prof.earSpot}"/>` : "";
    const tailEye = prof.tailEye ? `<circle cx="92" cy="${MY - a.bodyH * 0.2}" r="3.4" fill="${prof.tailEye}"/><circle cx="92" cy="${r2(MY - a.bodyH * 0.2)}" r="1.6" fill="#f3e9d5" opacity="0.7"/>` : "";
    const gloss = `<path d="${body}" fill="url(#gloss${id})" opacity="0.5"/>`;
    const shade = `<path d="${body}" fill="url(#shade${id})"/>`; // belly grounding shadow → rounder body

    const out = `<svg viewBox="0 0 ${VB_W} ${VB_H}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" class="fishart">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${prof.back}"/><stop offset="0.55" stop-color="${mix(prof.back, prof.belly, 0.5)}"/><stop offset="1" stop-color="${prof.belly}"/>
        </linearGradient>
        <linearGradient id="gloss${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.62"/><stop offset="0.12" stop-color="#ffffff" stop-opacity="0.28"/><stop offset="0.4" stop-color="#ffffff" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="shade${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.5" stop-color="#0a120e" stop-opacity="0"/><stop offset="1" stop-color="#0a120e" stop-opacity="0.28"/>
        </linearGradient>
        <clipPath id="${cid}"><path d="${body}"/></clipPath>
      </defs>
      ${glow}
      <path d="${tail}" fill="url(#${gid})" stroke="${bodyStroke}" stroke-width="${bodyStrokeW}" stroke-opacity="${bodyStrokeO}"/>
      ${dorsal}
      ${snoutEl}
      <path d="${body}" fill="url(#${gid})" stroke="${bodyStroke}" stroke-width="${bodyStrokeW}" stroke-opacity="${bodyStrokeO}"/>
      ${pat}
      ${scales}
      ${shade}
      ${gloss}
      ${front}
      ${barbels}
      ${gill}
      ${gillSpot}${earSpot}${tailEye}
      ${eye}
      ${sparkle}
    </svg>`;
    CACHE[ck] = out;
    return out;
  }

  // simple hex color mix
  function mix(a, b, t) {
    const pa = hex(a), pb = hex(b);
    const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
    return "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
  }
  function hex(c) { c = c.replace("#", ""); return [0, 2, 4].map(i => parseInt(c.substr(i, 2), 16)); }

  window.FishArt = { svg, has: ref => !!P[ref], refs: () => Object.keys(P) };
})();
