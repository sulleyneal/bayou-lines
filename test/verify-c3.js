const { chromium } = require(process.env.PW||'/opt/node22/lib/node_modules/playwright');
const OUT = __dirname, URL = 'http://localhost:8099/index.html';
const noSW = () => { try{Object.defineProperty(navigator,'serviceWorker',{value:{register:()=>Promise.reject(),addEventListener:()=>{}},configurable:true});}catch(e){} };

// compute ledger species (D.S keys that appear in a location) + wall-hanger weights, from data.js
global.window = {}; require('/home/user/bayou-lines/data.js'); const D = global.window.DATA;
const inLoc = new Set(); D.LOCATIONS.forEach(l => l.species.forEach(s => inLoc.add(s.ref)));
const ledger = Object.keys(D.S).filter(k => inLoc.has(k));
const wallW = k => { const [a,b]=D.S[k].w; return +(a + 0.9*(b-a)).toFixed(1); }; // >=0.88 threshold, use 0.9

function baseSave(over) {
  return Object.assign({
    v:3, locationId:'darbonne', unlocked:['pond','lincoln','darbonne','caney','blackbayou','ouachita','toledo','atchafalaya','venice'],
    bucks:9000, equip:{rod:4,line:4,lure:4,boat:4},
    stats:{catches:400,junk:20,pb:70,pbName:'x',perLoc:{pond:20,lincoln:20,darbonne:40,caney:20,blackbayou:25,ouachita:30,toledo:30,atchafalaya:40,venice:30},species:{},junkKinds:{},locSpecies:{},bountiesDone:10,dailiesDone:8},
    caught:{}, records:{}, legends:{}, flags:{coachedReel:true,toldDaily:true}, flags2:{}, achievements:['first_cast'],
    bounties:[], camp:{tier:4,decor:{}}, daily:{date:'',streak:0,lastDay:''}, stock:{},
    story:{seen:{welcome:1,firstfish:1,regular:1,newwater:1,fries:1,campup:1,baptiste:1,firstlegend:1,thelegend:1,deeper:1},ch:3},
    ghost:{caught:false,nearMiss:false,sighted:false,toldReady:false}, trotline:{set:false,ts:0},
    weekly:{lastWeek:''}, master:{awarded:[]}, log:[], settings:{muted:true,volume:0.6}
  }, over);
}

(async () => {
  const browser = await chromium.launch();
  let pass=0, fail=0; const check=(l,c)=>{console.log((c?'  ok  ':' FAIL ')+l); c?pass++:fail++;};
  const errs=[];
  const load = async (page, save) => { await page.goto(URL,{waitUntil:'domcontentloaded'}); await page.evaluate(s=>localStorage.setItem('bayou-lines-save-v2',JSON.stringify(s)), save); await page.reload({waitUntil:'domcontentloaded'}); await page.waitForTimeout(1200); };

  // ---- A: pre-ghost — swamp hidden from the map ----
  {
    const ctx=await browser.newContext({viewport:{width:390,height:844}}); const p=await ctx.newPage();
    p.on('console',m=>{if(m.type()==='error'){const t=m.text();if(!/net::|font/i.test(t))errs.push('A: '+t);}}); p.on('pageerror',e=>errs.push('A perr: '+e.message));
    await p.addInitScript(noSW); await load(p, baseSave({}));
    await p.evaluate(()=>document.getElementById('travelBtn').click()); await p.waitForTimeout(400);
    const travel = await p.evaluate(()=>document.getElementById('travelBody').innerText);
    check('pre-ghost: Honey Island HIDDEN from the map', !/Honey Island/i.test(travel));
    await ctx.close();
  }

  // ---- B: post-ghost — swamp appears, travel there, scene + fishing works ----
  {
    const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2}); const p=await ctx.newPage();
    p.on('console',m=>{if(m.type()==='error'){const t=m.text();if(!/net::|font/i.test(t))errs.push('B: '+t);}}); p.on('pageerror',e=>errs.push('B perr: '+e.message));
    await p.addInitScript(noSW); await load(p, baseSave({ghost:{caught:true,nearMiss:false,sighted:true,toldReady:true}}));
    await p.evaluate(()=>document.getElementById('travelBtn').click()); await p.waitForTimeout(400);
    let travel = await p.evaluate(()=>document.getElementById('travelBody').innerText);
    check('post-ghost: Honey Island now on the map', /Honey Island/i.test(travel));
    check('swamp gate references the Ghost', /Gray Ghost/i.test(travel));
    // unlock & go
    await p.evaluate(()=>{ const b=[...document.querySelectorAll('[data-unlock]')].find(x=>x.dataset.unlock==='honeyisland'); if(b)b.click(); });
    await p.waitForTimeout(900);
    const loc = await p.evaluate(()=>document.getElementById('locName').textContent);
    check('travelled to Honey Island Swamp', /Honey Island/i.test(loc));
    const scenery = await p.evaluate(()=>document.getElementById('sceneryLayer').innerHTML.length);
    check('swamp scenery rendered', scenery>50);
    await p.screenshot({path:OUT+'/c3-swamp.png'});
    // haint art clean
    const haintBad = await p.evaluate(()=>/NaN|undefined/.test(window.FishArt.svg('haint')||'x'));
    check('the Honey Island Haint renders clean SVG', !haintBad);
    // fish a few casts (speed hack), ensure no errors
    await p.evaluate(()=>{window.DATA.CONFIG.baseWaitMs=[40,90];window.DATA.CONFIG.nibbleMs=[30,70];});
    let got=0;
    for(let k=0;k<300 && got<3;k++){ const st=await p.evaluate(()=>({dlg:document.getElementById('dialogue')?.classList.contains('show'),card:document.getElementById('catchCard')?.classList.contains('show'),f:document.getElementById('fightBar')?.classList.contains('show'),btn:document.getElementById('actionBtn')?.textContent||''}));
      if(st.dlg){await p.click('#dialogue');await p.waitForTimeout(80);continue;}
      if(st.card){got++;await p.evaluate(()=>document.getElementById('catchClose').click());await p.waitForTimeout(30);continue;}
      if(st.f||st.btn.includes('REEL'))await p.keyboard.press('Space'); else if(st.btn.includes('Cast'))await p.keyboard.press('Space');
      await p.waitForTimeout(30);
    }
    check('fished the swamp clean ('+got+' landed)', got>=3);
    await ctx.close();
  }

  // ---- C: Master Angler ledger — display, sort, completion ----
  {
    const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2}); const p=await ctx.newPage();
    p.on('console',m=>{if(m.type()==='error'){const t=m.text();if(!/net::|font/i.test(t))errs.push('C: '+t);}}); p.on('pageerror',e=>errs.push('C perr: '+e.message));
    await p.addInitScript(noSW);
    // partial ledger: 6 species at wall-hanger, rest logged small
    const recs={}, caught={}; ledger.forEach((k,i)=>{ caught[k]=true; recs[k]={max: i<6?wallW(k):D.S[k].w[0], count:3, firstLoc:'darbonne', lastTs:1}; });
    await load(p, baseSave({ghost:{caught:true},records:recs,caught}));
    await p.evaluate(()=>{const b=document.getElementById('moreBtn');b.click();}); await p.waitForTimeout(150);
    await p.evaluate(()=>document.getElementById('ledgerBtn').click()); await p.waitForTimeout(400);
    const ledgerTxt = await p.evaluate(()=>document.getElementById('ledgerBody').innerText);
    const count = await p.evaluate(()=>document.getElementById('ledgerCount').textContent);
    await p.screenshot({path:OUT+'/c3-ledger.png'});
    check('ledger shows N of '+ledger.length+' ('+count+')', new RegExp('6 of '+ledger.length).test(count));
    check('ledger lists a wall-hanger done', /wall-hanger/i.test(ledgerTxt));
    check('ledger shows a "needs X lb+" target', /needs .* lb\+/i.test(ledgerTxt));
    // full ledger -> completion + master flag after a catch
    const recsFull={}, caughtFull={}; ledger.forEach(k=>{ caughtFull[k]=true; recsFull[k]={max:wallW(k),count:5,firstLoc:'darbonne',lastTs:1}; });
    await load(p, baseSave({ghost:{caught:true},records:recsFull,caught:caughtFull,locationId:'darbonne'}));
    await p.evaluate(()=>{window.DATA.CONFIG.baseWaitMs=[40,90];window.DATA.CONFIG.nibbleMs=[30,70];});
    // one catch to trigger checkMaster
    for(let k=0;k<200;k++){ const st=await p.evaluate(()=>({dlg:document.getElementById('dialogue')?.classList.contains('show'),card:document.getElementById('catchCard')?.classList.contains('show'),f:document.getElementById('fightBar')?.classList.contains('show'),btn:document.getElementById('actionBtn')?.textContent||''}));
      if(st.dlg){await p.click('#dialogue');await p.waitForTimeout(80);continue;}
      if(st.card){await p.evaluate(()=>document.getElementById('catchClose').click());break;}
      if(st.f||st.btn.includes('REEL'))await p.keyboard.press('Space'); else if(st.btn.includes('Cast'))await p.keyboard.press('Space');
      await p.waitForTimeout(30);
    }
    await p.waitForTimeout(300);
    const master = await p.evaluate(()=>{ const s=JSON.parse(localStorage.getItem('bayou-lines-save-v2')); return {flag:!!(s.flags2&&s.flags2.masterAngler), awarded:s.master.awarded}; });
    check('full book -> Master Angler flag set', master.flag);
    check('milestones + full award recorded', master.awarded.includes('full'));
    await ctx.close();
  }

  console.log('\nERRORS:', errs.length?JSON.stringify(errs.slice(0,8)):'none');
  console.log('RESULT', pass+' passed, '+fail+' failed');
  await browser.close();
  process.exit(fail||errs.length?1:0);
})();
