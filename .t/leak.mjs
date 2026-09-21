import { chromium } from '@playwright/test';
const b = await chromium.launch();
const ctx = await b.newContext({viewport:{width:1440,height:900}});
const p = await ctx.newPage();
// Arrive straight on the Prüfungen tab with a clean browser: the Übungen panel is hidden.
await p.goto('http://localhost:4321/fortschritt?ansicht=pruefungen',{waitUntil:'networkidle'});
await p.waitForTimeout(1800);
console.log('arrived on Prüfungen tab:', JSON.stringify(await p.evaluate(()=>({
  uebungenHidden: document.querySelector('[data-view-panel="uebungen"]').hidden,
  seenFlag: localStorage.getItem('da-stufen-foldtab-seen'),
  coachOn: !!document.querySelector('.ri-coach.is-on'),
}))));
// Now switch to Übungen — the tour it already "played" is gone forever.
await p.click('[data-ansicht="uebungen"]');
await p.waitForTimeout(1500);
console.log('after switching to Übungen:', JSON.stringify(await p.evaluate(()=>({
  seenFlag: localStorage.getItem('da-stufen-foldtab-seen'),
  coachOn: !!document.querySelector('.ri-coach.is-on'),
}))));
await b.close();
