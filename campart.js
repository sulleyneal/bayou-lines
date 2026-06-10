/* ============================================================
   BAYOU LINES — campart.js
   Draws the home camp as an SVG that grows with the camp tier and
   the decor you've bought. Stylized, dusk-toned. Pure cosmetic.
   Exposes window.CampArt.svg(tier, decor) -> SVG string.
   ============================================================ */
(function () {
  "use strict";
  const W = 340, H = 190, WATER = 124;

  function svg(tier, decor) {
    decor = decor || {};
    let s = "";

    // sky + water + bank
    s += `<rect width="${W}" height="${WATER}" fill="url(#csky)"/>`;
    s += `<circle cx="262" cy="52" r="26" fill="url(#csun)"/>`;
    s += `<rect y="${WATER}" width="${W}" height="${H - WATER}" fill="url(#cwater)"/>`;
    s += `<path d="M0 ${WATER} Q 90 ${WATER - 8} 150 ${WATER} L 150 ${H} L 0 ${H} Z" fill="#243a26"/>`; // grassy bank
    s += `<ellipse cx="200" cy="150" rx="120" ry="8" fill="#0a201c" opacity="0.4"/>`;

    // dock (tier >= 1)
    if (tier >= 1) {
      s += `<g fill="#5a4733" stroke="#3e3022" stroke-width="1">
        <rect x="140" y="120" width="150" height="9"/>
        <rect x="156" y="129" width="6" height="26"/><rect x="206" y="129" width="6" height="30"/><rect x="262" y="129" width="6" height="30"/>
      </g>`;
      for (let i = 0; i < 7; i++) s += `<rect x="${142 + i * 21}" y="120" width="1.5" height="9" fill="#3e3022"/>`;
    }

    // structure
    if (tier >= 3) { // cabin with tin gable roof
      const cw = tier >= 4 ? 96 : 78, cx = 24, cy = 64;
      s += `<rect x="${cx}" y="${cy}" width="${cw}" height="${118 - cy + (tier >= 4 ? 0 : 0)}" fill="#6b563b"/>`;
      // plank lines
      for (let i = 1; i < 5; i++) s += `<line x1="${cx}" y1="${cy + i * 12}" x2="${cx + cw}" y2="${cy + i * 12}" stroke="#54422c" stroke-width="1"/>`;
      s += `<path d="M ${cx - 6} ${cy} L ${cx + cw / 2} ${cy - 26} L ${cx + cw + 6} ${cy} Z" fill="#8a8f93"/>`; // tin roof
      s += `<path d="M ${cx - 6} ${cy} L ${cx + cw / 2} ${cy - 26} L ${cx + cw + 6} ${cy} Z" fill="url(#ctin)" opacity="0.5"/>`;
      s += `<rect x="${cx + 10}" y="${cy + 30}" width="16" height="16" fill="#cf9a4a" opacity="0.85"/>`; // window glow
      s += `<rect x="${cx + cw - 26}" y="${cy + 26}" width="18" height="${118 - cy - 26}" fill="#3a2c1c"/>`; // door
      if (tier >= 4) s += `<g stroke="#4a3a26" stroke-width="2"><line x1="${cx}" y1="116" x2="${cx + cw}" y2="116"/><line x1="${cx + 14}" y1="116" x2="${cx + 14}" y2="106"/><line x1="${cx + cw - 14}" y1="116" x2="${cx + cw - 14}" y2="106"/></g>`; // porch rail
    } else if (tier >= 2) { // lean-to
      s += `<g><rect x="40" y="86" width="5" height="34" fill="#4a3a26"/><rect x="96" y="92" width="5" height="28" fill="#4a3a26"/>
        <path d="M 34 86 L 108 92 L 108 98 L 34 92 Z" fill="#8a8f93"/></g>`;
    }

    // chair + cooler on the bank (always)
    s += chair(58, 110);
    s += `<g><rect x="86" y="104" width="22" height="16" rx="2" fill="#c2503a"/><rect x="86" y="104" width="22" height="5" rx="2" fill="#e0e0d8"/></g>`; // cooler

    // ---- decor ----
    if (decor.chair2) s += chair(118, 112);
    if (decor.smoker) s += `<g><rect x="14" y="120" width="16" height="22" rx="3" fill="#2b2b2b"/><rect x="13" y="118" width="18" height="5" rx="2" fill="#1c1c1c"/><path d="M22 118 q4 -8 -2 -14 q8 4 4 12" fill="#9aa0a0" opacity="0.5"/></g>`;
    if (decor.flag) s += `<g><rect x="300" y="60" width="3" height="68" fill="#6a5a40"/><path d="M303 62 L326 68 L303 78 Z" fill="#5a86a0"/><rect x="303" y="62" width="23" height="5.5" fill="#caa14a"/></g>`;
    if (decor.torch) s += `<g><rect x="160" y="104" width="3" height="20" fill="#5a4733"/><ellipse cx="161.5" cy="100" rx="4" ry="7" fill="#f2a65a"/><ellipse cx="161.5" cy="101" rx="2" ry="4" fill="#ffe7b0"/></g>`;
    if (decor.dog) s += `<g fill="#3a2e22"><ellipse cx="128" cy="118" rx="11" ry="5"/><circle cx="138" cy="113" r="4.5"/><path d="M141 111 l4 -3 l0 4 z"/><rect x="120" y="120" width="2" height="6"/><rect x="134" y="120" width="2" height="6"/><path d="M117 117 q-5 1 -6 5" stroke="#3a2e22" stroke-width="2" fill="none"/></g>`;
    if (decor.lights) {
      // a hanging string strung over the camp/dock, with a gentle sag
      const x0 = 20, x1 = 150, y0 = tier >= 3 ? 42 : 72, y1 = tier >= 1 ? 116 : 100, sag = 16;
      const midY = (y0 + y1) / 2 + sag;
      s += `<path d="M ${x0} ${y0} Q ${(x0 + x1) / 2} ${midY + sag} ${x1} ${y1}" stroke="#5a4733" stroke-width="1" fill="none"/>`;
      const cols = ["#f2a65a", "#7fb069", "#e8c170", "#d8553f", "#6aa0c0"];
      for (let i = 0; i <= 9; i++) {
        const t = i / 9, x = x0 + (x1 - x0) * t;
        const y = y0 + (y1 - y0) * t + Math.sin(Math.PI * t) * (sag + 14);
        s += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="2.4" fill="${cols[i % 5]}"><animate attributeName="opacity" values="0.5;1;0.6" dur="${2 + (i % 3)}s" repeatCount="indefinite"/></circle>`;
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="campart">
      <defs>
        <linearGradient id="csky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3450"/><stop offset="0.5" stop-color="#7a4f4a"/><stop offset="1" stop-color="#e0a868"/></linearGradient>
        <linearGradient id="cwater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a5a52"/><stop offset="1" stop-color="#0e2826"/></linearGradient>
        <linearGradient id="ctin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0.5"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0.3"/></linearGradient>
        <radialGradient id="csun"><stop offset="0" stop-color="#ffe7b0"/><stop offset="0.7" stop-color="#f2a65a"/><stop offset="0.8" stop-color="rgba(242,166,90,0)"/></radialGradient>
      </defs>${s}</svg>`;
  }

  function chair(x, y) {
    return `<g stroke="#caa14a" stroke-width="2.4" fill="none" stroke-linecap="round">
      <path d="M${x} ${y} l8 -14 l8 0"/><path d="M${x} ${y} l16 0"/><path d="M${x + 2} ${y} l-2 8"/><path d="M${x + 14} ${y} l2 8"/><path d="M${x + 8} ${y - 14} l0 -8"/></g>`;
  }

  window.CampArt = { svg };
})();
