import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto('http://localhost:4321/fortschritt',{waitUntil:'networkidle'});
await p.waitForTimeout(900);
console.log(JSON.stringify(await p.evaluate(()=>{
  const sec=document.querySelector('.fs-section');
  const ls=document.querySelector('.nv-shell, .nv-main')?.closest('main,div');
  return {
    pageHeight: Math.round(document.documentElement.scrollHeight),
    viewport: innerHeight,
    examSectionTop: sec? Math.round(sec.getBoundingClientRect().top + scrollY):null,
    scrollsNeeded: sec? +( (sec.getBoundingClientRect().top+scrollY) / innerHeight ).toFixed(2):null,
    anchors: [...document.querySelectorAll('[id]')].map(e=>e.id).filter(Boolean).slice(0,20),
  };
}),null,1));
await b.close();
