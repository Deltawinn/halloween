import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1800, height: 1200 }, deviceScaleFactor: 1.5 });
p.on('pageerror', (e) => console.log('err', e.message));
await p.goto('http://localhost:8091/logos.html');
await p.waitForTimeout(1200);
await p.locator('.board').screenshot({ path: 'planche-logos.png' });
// chaque icône seule en 1024 px
const n = await p.evaluate(() => window.ICONS.length);
for (let i = 0; i < n; i++) {
  await p.evaluate((i) => { document.body.innerHTML = `<div id="x" style="width:1024px;height:1024px">${window.ICONS[i].svg(900 + i)}</div>`; document.querySelector('#x svg').style.cssText = 'width:1024px;height:1024px;display:block'; }, i);
  await p.setViewportSize({ width: 1024, height: 1024 });
  await p.waitForTimeout(150);
  await p.locator('#x').screenshot({ path: `icone-${i + 1}.png` });
}
await b.close();
