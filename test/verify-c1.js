const { chromium } = require(process.env.PW||'/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const OUT = __dirname;
const URL = 'http://localhost:8099/index.html';
const baseline = fs.readFileSync(OUT + '/baseline-save-v2.json', 'utf8');

(async () => {
  const browser = await chromium.launch();
  const errs = [];
  let pass = 0, fail = 0;
  const check = (label, cond) => { console.log((cond ? '  ok  ' : ' FAIL ') + label); cond ? pass++ : fail++; };

  // ---- TEST A: cold open — brand-new profile ----
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push('COLD PAGE ERR: ' + e.message));
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    for (let i=0;i<8;i++){ if(await page.evaluate(()=>document.getElementById('dialogue')?.classList.contains('show'))){ await page.click('#dialogue'); await page.waitForTimeout(200);} else break; }
    await page.screenshot({ path: OUT + '/c1-cold-open.png' });
    const t0 = Date.now();
    let firstFishMs = null, wasFish = false, sawCoach = false;
    await page.keyboard.press('Space');
    for (let k=0;k<300 && !firstFishMs;k++){
      const st = await page.evaluate(()=>({
        fight: document.getElementById('fightBar')?.classList.contains('show'),
        coach: document.getElementById('actionBtn')?.classList.contains('coach'),
        btn: document.getElementById('actionBtn')?.textContent||'',
        card: document.getElementById('catchCard')?.classList.contains('show'),
        badge: document.getElementById('catchBadge')?.textContent||'',
      }));
      if (st.coach) sawCoach = true;
      if (st.card){ firstFishMs = Date.now()-t0; wasFish = st.badge!=='junk haul' && st.badge!=='got away'; break; }
      if (st.fight || st.btn.includes('REEL')) await page.keyboard.press('Space');
      await page.waitForTimeout(80);
    }
    await page.screenshot({ path: OUT + '/c1-first-fish.png' });
    check('cold open: first CARD is a FISH (not junk/snap)', wasFish);
    check('cold open: first fish under 90s ('+firstFishMs+'ms)', firstFishMs !== null && firstFishMs < 90000);
    check('cold open: hold-to-reel coach pulse appeared', sawCoach);
    const chip = await page.evaluate(()=>({ shown: document.getElementById('dailyChip')?.classList.contains('show'), text: document.getElementById('dailyChip')?.textContent }));
    check('daily chip shown on screen ("'+ (chip.text||'').trim() +'")', chip.shown && /📅/.test(chip.text||''));
    await ctx.close();
  }

  // ---- TEST B: migration — realistic returning-player path ----
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push('MIGRATE PAGE ERR: ' + e.message));
    await page.goto(URL, { waitUntil: 'domcontentloaded' });          // register
    await page.evaluate(s => localStorage.setItem('bayou-lines-save-v2', s), baseline); // write v2 save
    await page.reload({ waitUntil: 'domcontentloaded' });             // returning visit
    await page.waitForTimeout(1400);
    const before = JSON.parse(baseline);
    const after = await page.evaluate(() => ({
      bucks: document.getElementById('stBucks')?.textContent,
      catches: document.getElementById('stCatch')?.textContent,
      pb: document.getElementById('stPB')?.textContent,
      loc: document.getElementById('locName')?.textContent,
      raw: localStorage.getItem('bayou-lines-save-v2'),
    }));
    const saved = JSON.parse(after.raw);
    console.log('MIGRATION (v2 baseline -> new build):');
    check('bucks intact ('+before.bucks+')', String(before.bucks)===after.bucks);
    check('catches intact ('+before.stats.catches+')', String(before.stats.catches)===after.catches);
    check('PB intact ('+before.stats.pb+' lb)', after.pb===(before.stats.pb+' lb'));
    check('location intact', after.loc==="Lake D'Arbonne");
    check('unlocked intact', JSON.stringify(saved.unlocked)===JSON.stringify(before.unlocked));
    check('equip intact', JSON.stringify(saved.equip)===JSON.stringify(before.equip));
    check('records intact', Object.keys(saved.records).length===Object.keys(before.records).length);
    check('species counts intact', JSON.stringify(saved.stats.species)===JSON.stringify(before.stats.species));
    check('achievements intact', (saved.achievements||[]).length>=(before.achievements||[]).length);
    check('story flags intact', Object.keys(saved.story.seen).length>=Object.keys(before.story.seen).length);
    check('camp intact', saved.camp.tier===before.camp.tier && JSON.stringify(saved.camp.decor)===JSON.stringify(before.camp.decor));
    check('save re-stamped to v3', saved.v===3);
    check('veteran auto-coached (no first-fight hint)', saved.flags.coachedReel===true);
    await ctx.close();
  }

  console.log('\nERRORS', JSON.stringify(errs));
  console.log('RESULT', pass+' passed, '+fail+' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
