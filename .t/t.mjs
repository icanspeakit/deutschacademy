import { chromium } from '@playwright/test';
const b = await chromium.launch();
for (const [w,url,label] of [
  [1440,'/fortschritt?intro','fortschritt ?intro'],
  [1440,'/fortschritt?stufe=a2&intro','fortschritt a2 ?intro'],
  [1440,'/uebungen/grammatik/ja-nein-fragen?intro','a topic page ?intro'],
]) {
  const ctx = await b.newContext({viewport:{width:w,height:900}});
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,100)));
  await p.goto('http://localhost:4321'+url,{waitUntil:'networkidle'});
  await p.waitForTimeout(1600);
  console.log(label.padEnd(24), JSON.stringify(await p.evaluate(()=>({
    foldtab: !!document.querySelector('.nvb-foldtab'),
    nvb: !!document.querySelector('[data-nvb]'),
    panel: !!document.querySelector('.nvb-panel'),
    coachVisible: [...document.querySelectorAll('[class*="coach"],[class*="intro"]')]
      .filter(e=>e.getBoundingClientRect().height>0).map(e=>e.className.toString().slice(0,40)),
  }))), errs.length?('ERR '+errs[0]):'');
  await ctx.close();
}
await b.close();
