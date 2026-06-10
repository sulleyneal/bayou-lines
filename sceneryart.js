/* ============================================================
   BAYOU LINES — sceneryart.js
   Per-location background scenery, themed to each real place:
   pines for the piney hills, cypress for the bayou, standing dead
   timber for the reservoir, marsh grass + rigs for the coast.
   Silhouettes anchored to the waterline. Exposes window.SceneryArt.
   svg(locId, {color, haze}) -> HTML string of positioned <svg>s.
   ============================================================ */
(function () {
  "use strict";

  // ---- color helpers ----
  function hex(c) { c = c.replace("#", ""); if (c.length === 3) c = c.split("").map(x => x + x).join(""); return [0, 2, 4].map(i => parseInt(c.substr(i, 2), 16)); }
  function mix(a, b, t) { const pa = hex(a), pb = hex(b); return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join(""); }

  // ---- element silhouettes (base of art sits at the bottom of its viewBox) ----
  const EL = {
    pine: { vb: "0 0 64 120", s: `<rect x="29" y="92" width="6" height="28"/><path d="M32 6 L48 46 L16 46 Z"/><path d="M32 30 L52 74 L12 74 Z"/><path d="M32 56 L56 102 L8 102 Z"/>` },
    cypress: { vb: "0 0 96 120", s: `<path d="M43 120 Q37 78 45 50 L52 50 Q60 78 54 120 Z"/><path d="M48 30 Q8 36 6 50 Q30 44 48 50 Q66 44 90 50 Q88 36 48 30 Z"/><path d="M48 20 Q24 24 20 38 Q36 33 48 38 Q60 33 76 38 Q72 24 48 20 Z"/><ellipse cx="16" cy="50" rx="12" ry="6"/><ellipse cx="80" cy="50" rx="12" ry="6"/>` },
    cypressMoss: { vb: "0 0 96 126", s: `<path d="M43 126 Q37 80 45 50 L52 50 Q60 80 54 126 Z"/><path d="M48 30 Q8 36 6 50 Q30 44 48 50 Q66 44 90 50 Q88 36 48 30 Z"/><path d="M48 20 Q24 24 20 38 Q36 33 48 38 Q60 33 76 38 Q72 24 48 20 Z"/><ellipse cx="16" cy="50" rx="12" ry="6"/><ellipse cx="80" cy="50" rx="12" ry="6"/><g opacity="0.75"><path d="M14 54 q-1 16 1 24"/><path d="M30 56 q1 18 -1 28"/><path d="M46 54 q-1 20 1 32"/><path d="M62 56 q1 16 -1 26"/><path d="M80 54 q-1 18 1 26"/></g>` },
    willow: { vb: "0 0 100 116", s: `<path d="M48 116 L46 60 L54 60 L52 116 Z"/><ellipse cx="50" cy="44" rx="42" ry="26"/><g><rect x="14" y="48" width="2.4" height="46"/><rect x="24" y="54" width="2.4" height="42"/><rect x="36" y="58" width="2.4" height="40"/><rect x="50" y="60" width="2.4" height="44"/><rect x="64" y="58" width="2.4" height="40"/><rect x="76" y="54" width="2.4" height="42"/><rect x="86" y="48" width="2.4" height="44"/></g>` },
    dead: { vb: "0 0 40 122", s: `<path d="M17 122 L16 10 L21 10 L20 122 Z"/><path d="M19 46 L3 30 L7 34 L19 54 Z"/><path d="M19 64 L36 46 L31 50 L19 70 Z"/><path d="M18 26 L30 14 L27 19 L18 32 Z"/><path d="M20 84 L33 74 L29 79 L20 90 Z"/>` },
    grass: { vb: "0 0 110 80", s: `<g><path d="M52 80 Q47 30 41 4 L46 4 Q52 32 56 80 Z"/><path d="M40 80 Q33 36 24 14 L29 12 Q40 38 45 80 Z"/><path d="M64 80 Q72 34 84 12 L88 16 Q74 40 69 80 Z"/><path d="M30 80 Q22 46 12 32 L16 30 Q28 48 35 80 Z"/><path d="M78 80 Q88 48 100 36 L102 40 Q90 52 83 80 Z"/></g>` },
    cattail: { vb: "0 0 64 96", s: `<g><path d="M30 96 Q27 40 22 8 L26 8 Q31 42 35 96 Z"/><path d="M40 96 Q42 46 50 18 L53 20 Q44 48 45 96 Z"/><path d="M18 96 Q14 52 6 34 L10 33 Q20 54 24 96 Z"/></g><rect x="22" y="6" width="5.5" height="20" rx="2.7" fill="#5a3a22"/><rect x="23.6" y="-2" width="2.2" height="10" fill="#5a3a22"/><rect x="48" y="16" width="5" height="17" rx="2.5" fill="#5a3a22"/>` },
    bush: { vb: "0 0 90 50", s: `<path d="M4 50 Q6 24 22 22 Q26 8 44 12 Q60 4 70 20 Q86 22 86 50 Z"/>` },
    rig: { vb: "0 0 96 104", s: `<path d="M12 104 L18 104 L26 44 L22 44 Z"/><path d="M84 104 L78 104 L70 44 L74 44 Z"/><path d="M40 104 L45 104 L47 44 L43 44 Z"/><path d="M52 104 L57 104 L51 44 L55 44 Z"/><rect x="20" y="34" width="56" height="12"/><path d="M40 34 L48 3 L56 34 Z"/><rect x="30" y="22" width="36" height="5"/><circle cx="48" cy="5" r="3.2" fill="#f2a65a"/>` },
    barge: { vb: "0 0 160 46", s: `<path d="M4 30 L150 30 L144 44 L10 44 Z"/><rect x="116" y="12" width="36" height="20"/><rect x="124" y="2" width="15" height="12"/><circle cx="150" cy="8" r="2.4" fill="#f2a65a"/>` },
  };

  // ---- per-location compositions: [el, left%, height%, depth(0 far..1 near), bottom%] ----
  // bottom defaults to 54 (the waterline). depth tints far elements toward haze.
  const SCENE = {
    pond:        [["bush", 8, 7, 0.4], ["cattail", 2, 12, 0.85, 50], ["bush", 70, 6, 0.35], ["cattail", 90, 13, 0.9, 49], ["bush", 40, 5, 0.3]],
    lincoln:     [["pine", 4, 23, 0.95], ["pine", 15, 16, 0.6], ["pine", 24, 12, 0.4], ["pine", 80, 21, 0.85], ["pine", 91, 14, 0.55]],
    darbonne:    [["cypress", 5, 25, 0.95], ["cypress", 16, 17, 0.6], ["bush", 30, 6, 0.35], ["cypress", 84, 23, 0.85], ["cattail", 95, 11, 0.7, 51]],
    caney:       [["pine", 5, 22, 0.9], ["pine", 13, 14, 0.5], ["bush", 24, 5, 0.3], ["pine", 92, 17, 0.7]],
    blackbayou:  [["cypressMoss", 3, 26, 0.95], ["cypressMoss", 13, 21, 0.7], ["cypress", 25, 14, 0.45], ["cypressMoss", 84, 24, 0.9], ["cypress", 94, 16, 0.6], ["cattail", 36, 9, 0.55, 51]],
    ouachita:    [["willow", 4, 22, 0.9], ["willow", 90, 18, 0.7], ["bush", 20, 6, 0.35], ["barge", 52, 7, 0.5, 50], ["grass", 12, 9, 0.6, 52]],
    toledo:      [["dead", 12, 15, 0.6, 50], ["dead", 22, 11, 0.45, 49], ["dead", 33, 17, 0.8, 51], ["dead", 64, 13, 0.55, 49], ["dead", 74, 18, 0.85, 51], ["dead", 86, 12, 0.5, 49]],
    atchafalaya: [["cypressMoss", 2, 28, 0.95], ["cypressMoss", 11, 24, 0.78], ["cypressMoss", 22, 17, 0.55], ["cypress", 33, 12, 0.4], ["cypressMoss", 82, 26, 0.92], ["cypressMoss", 92, 19, 0.66], ["dead", 50, 12, 0.5, 50]],
    venice:      [["grass", 2, 13, 0.85, 51], ["grass", 88, 15, 0.9, 50], ["grass", 44, 10, 0.7, 52], ["rig", 60, 11, 0.32], ["rig", 28, 7, 0.26], ["bush", 16, 4, 0.25]],
  };

  function svg(locId, opts) {
    opts = opts || {};
    const color = opts.color || "#0c1f1d";
    const haze = opts.haze || "#7a5a55";
    const comp = SCENE[locId] || SCENE.darbonne;
    return comp.map(([k, left, h, depth, bottom]) => {
      const el = EL[k]; if (!el) return "";
      const fill = mix(haze, color, depth);
      const op = (0.5 + 0.5 * depth).toFixed(2);
      const b = bottom == null ? 54 : bottom;
      return `<svg class="scenery-item" style="left:${left}%;bottom:${b}%;height:${h}%;opacity:${op}" viewBox="${el.vb}" preserveAspectRatio="xMidYMax meet" fill="${fill}">${el.s}</svg>`;
    }).join("");
  }

  window.SceneryArt = { svg };
})();
