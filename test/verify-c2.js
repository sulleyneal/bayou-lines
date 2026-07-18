const { chromium } = require(process.env.PW||'/opt/node22/lib/node_modules/playwright');
const OUT = __dirname, URL = 'http://localhost:8099/index.html';
const noSW = () => { try{Object.defineProperty(navigator,'serviceWorker',{value:{register:()=>Promise.reject(),addEventListener:()=>{}},configurable:true});}catch(e){} };

(async () => {
  const browser = await chromium.launch();
  let pass=0, fail=0; const check=(l,c)=>{console.log((c?'  ok  ':' FAIL ')+l); c?pass++:fail++;};
  const errs=[];

  // veteran save: varied records to exercise grade labels + post-Baptiste state
  const vet = {
    v:3, locationId:'darbonne', unlocked:['pond','lincoln','darbonne','caney','blackbayou'],
    bucks:3000, equip:{rod:2,line:2,lure:2,boat:2},
    stats:{catches:120,junk:10,pb:11.2,pbName:'x',perLoc:{pond:20,lincoln:15,darbonne:40,caney:20,blackbayou:25},species:{},junkKinds:{},locSpecies:{},bountiesDone:6,dailiesDone:4},
    caught:{bluegill:true,largemouth:true,redear:true,crappie:true,warmouth:true,carp:true},
    records:{
      bluegill:{max:1.06,count:30,firstLoc:'pond',lastTs:1},   // band .2-1.1 -> ~0.95 wall-hanger
      largemouth:{max:2.0,count:12,firstLoc:'darbonne',lastTs:1}, // band 1-7.5 -> .15 dink
      redear:{max:0.95,count:8,firstLoc:'pond',lastTs:1},        // band .3-1.6 -> .5 good'un
      crappie:{max:1.9,count:9,firstLoc:'darbonne',lastTs:1},    // band .5-2.4 -> .74 trophy
      warmouth:{max:0.8,count:4,firstLoc:'pond',lastTs:1},       // band .2-1.4 -> .5 good'un
      carp:{max:2.0,count:2,firstLoc:'lincoln',lastTs:1},        // band 2-30 -> 0 dink
    },
    legends:{}, flags:{coachedReel:true,toldDaily:true}, flags2:{}, achievements:['first_cast'],
    bounties:[], camp:{tier:2,decor:{}}, daily:{date:'',streak:0,lastDay:''}, stock:{},
    story:{seen:{welcome:true,firstfish:true,regular:true,newwater:true,fries:true,campup:true,baptiste:true},ch:2},
    ghost:{caught:false}, trotline:{set:false,ts:0}, weekly:{lastWeek:''}, log:[], settings:{muted:true,volume:0.6}
  };

  // ---- A: crafted veteran — Field Guide grades + weekly banner + baptiste bounties ----
  {
    const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2}); const page=await ctx.newPage();
    page.on('console',m=>{if(m.type()==='error'){const t=m.text(); if(!/net::|font/i.test(t))errs.push('A console: '+t);}});
    page.on('pageerror',e=>errs.push('A pageerror: '+e.message));
    await page.addInitScript(noSW);
    await page.goto(URL,{waitUntil:'domcontentloaded'});
    await page.evaluate(s=>localStorage.setItem('bayou-lines-save-v2',JSON.stringify(s)), vet);
    await page.reload({waitUntil:'domcontentloaded'}); await page.waitForTimeout(1200);
    // open Guide
    await page.evaluate(()=>document.getElementById('guideBtn').click()); await page.waitForTimeout(400);
    const guide = await page.evaluate(()=>document.getElementById('guideBody').innerText);
    await page.screenshot({path:OUT+'/c2-guide.png'});
    check('Guide shows a wall-hanger (giant bluegill)', /wall-hanger/i.test(guide));
    check('Guide shows a trophy (big crappie)', /a trophy/i.test(guide));
    check('Guide shows a good\'un', /good'un/i.test(guide));
    check('Guide shows a next-grade nudge (lb+)', /lb\+/.test(guide));
    // close guide, open Jobs
    await page.evaluate(()=>document.querySelector('[data-close=guidePanel]').click()); await page.waitForTimeout(300);
    await page.evaluate(()=>document.getElementById('jobsBtn').click()); await page.waitForTimeout(400);
    const jobs = await page.evaluate(()=>document.getElementById('jobsBody').innerText);
    await page.screenshot({path:OUT+'/c2-jobs.png'});
    check('Jobs shows the weekly banner (almanac)', /almanac/i.test(jobs));
    check('Weekly names a happening title', /(Fish-Fry Week|Tall-Tale Week|High Water|Bream Are Bedding|Front Parked|Cleanup Week|Restocked)/i.test(jobs));
    // baptiste bounty can now appear over several rerolls? just check template gating logic didn't crash + board rendered
    check('Jobs board rendered bounties', /bounties/i.test(jobs));
    await ctx.close();
  }

  // ---- B: fresh cold play — grade upgrade note + no errors ----
  {
    const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2}); const page=await ctx.newPage();
    page.on('console',m=>{if(m.type()==='error'){const t=m.text(); if(!/net::|font/i.test(t))errs.push('B console: '+t);}});
    page.on('pageerror',e=>errs.push('B pageerror: '+e.message));
    await page.addInitScript(noSW);
    await page.goto(URL,{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{window.DATA.CONFIG.baseWaitMs=[40,90];window.DATA.CONFIG.nibbleMs=[30,70];});
    await page.waitForTimeout(600);
    let upgradeSeen=false, catches=0;
    for(let i=0;i<8;i++){ if(await page.evaluate(()=>document.getElementById('dialogue')?.classList.contains('show'))){await page.click('#dialogue');await page.waitForTimeout(120);}else break; }
    for(let k=0;k<1400 && catches<24;k++){
      const st=await page.evaluate(()=>({dlg:document.getElementById('dialogue')?.classList.contains('show'),card:document.getElementById('catchCard')?.classList.contains('show'),detail:document.getElementById('catchDetail')?.textContent||'',f:document.getElementById('fightBar')?.classList.contains('show'),btn:document.getElementById('actionBtn')?.textContent||''}));
      if(st.dlg){await page.click('#dialogue');await page.waitForTimeout(80);continue;}
      if(st.card){ if(/your best yet/.test(st.detail))upgradeSeen=true; catches=parseInt(await page.evaluate(()=>document.getElementById('stCatch').textContent))||catches; await page.evaluate(()=>document.getElementById('catchClose').click()); await page.waitForTimeout(30); continue; }
      if(st.f||st.btn.includes('REEL'))await page.keyboard.press('Space');
      else if(st.btn.includes('Cast'))await page.keyboard.press('Space');
      await page.waitForTimeout(30);
    }
    check('caught 24 fish clean', catches>=24);
    check('grade-upgrade note ("your best yet") appeared while chasing bigger', upgradeSeen);
    await ctx.close();
  }

  console.log('\nERRORS:', errs.length?JSON.stringify(errs.slice(0,8)):'none');
  console.log('RESULT', pass+' passed, '+fail+' failed');
  await browser.close();
  process.exit(fail||errs.length?1:0);
})();
