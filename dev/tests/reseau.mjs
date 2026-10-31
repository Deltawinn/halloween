// Partie réelle à travers le relais (local) : TV, panneau MJ et 4 téléphones.
import { chromium } from 'playwright';
const BASE = 'http://localhost:8080/?relais=' + encodeURIComponent('ws://localhost:8883');
const shots = new globalThis.URL('../shots/', import.meta.url).pathname;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const C = { latitude: 48.8566, longitude: 2.3522 };
const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const errs = [];
const watch = (p, who) => {
  p.on('pageerror', (e) => errs.push(who + ' pageerror ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/tile|cartocdn|ERR_/.test(m.text())) errs.push(who + ' ' + m.text()); });
};

// TV
const tvCtx = await b.newContext({ viewport: { width: 1280, height: 720 } });
const tv = await tvCtx.newPage();
watch(tv, 'tv');
await tv.goto(BASE);
await tv.getByText('joignable').first().waitFor({ timeout: 15000 });
await tv.getByRole('button', { name: 'Créer la partie' }).click();
await tv.waitForTimeout(2500);
const host = await tv.evaluate(() => ({ join: window.__host.joinUrl(), mj: window.__host.mjUrl() }));
await tv.screenshot({ path: shots + 'n-tv-accueil.png' });

// MJ
const mjCtx = await b.newContext({ viewport: { width: 390, height: 844 }, geolocation: C, permissions: ['geolocation'] });
const mj = await mjCtx.newPage();
watch(mj, 'mj');
await mj.goto(host.mj);
await mj.locator('.mjtabs').waitFor({ timeout: 20000 });
const mtab = (t) => mj.locator('.mjtabs button', { hasText: t }).click();
await mtab('Préparation');
await mj.locator('.section-h', { hasText: 'Terrain' }).click();
await mj.getByRole('button', { name: 'Utiliser ma position ici' }).click();
await wait(800);
await mj.locator('.seg button', { hasText: 'Placer le refuge' }).click();
const mb = await mj.locator('.mapin').boundingBox();
await mj.mouse.click(mb.x + mb.width * 0.7, mb.y + mb.height * 0.3);
await wait(1500);
await mj.screenshot({ path: shots + 'n-mj-terrain.png' });

// joueurs
const names = [['Alpha', 'Un', 'Art le Clown'], ['Bravo', 'Deux', 'Chucky'], ['Charlie', 'Trois', 'Samara'], ['Delta', 'Quatre', 'Dracula']];
const P = [];
for (const [first, last, mon] of names) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, geolocation: { latitude: C.latitude + 0.001, longitude: C.longitude }, permissions: ['geolocation', 'camera'] });
  const p = await ctx.newPage();
  watch(p, first);
  await p.goto(host.join);
  await p.getByRole('button', { name: 'Entrer dans la partie' }).click();
  await p.getByRole('button', { name: 'Lancer l’analyse' }).click({ timeout: 15000 });
  await p.locator('input.inp').first().waitFor();
  await p.locator('input.inp').nth(0).fill(first);
  await p.locator('input.inp').nth(1).fill(last);
  await p.getByRole('button', { name: 'Continuer' }).click();
  await p.getByRole('heading', { name: 'Ton monstre' }).waitFor({ timeout: 20000 });
  await p.locator('input.inp').fill(mon);
  await p.getByRole('button', { name: 'Continuer' }).click();
  await p.getByRole('button', { name: 'Valider ma fiche' }).click({ timeout: 15000 });
  P.push({ p, first, ctx });
}
await wait(3000);
await P[0].p.getByText('La nuit va').waitFor({ timeout: 15000 });
await P[0].p.screenshot({ path: shots + 'n-p-attente.png' });
await tv.screenshot({ path: shots + 'n-tv-accueil2.png' });

// lancement
await mtab('Préparation');
await mj.getByRole('button', { name: 'Lancer la partie' }).click();
await mj.getByRole('button', { name: 'Lancer la nuit maintenant ?' }).click();
try { await P[0].p.getByText('L’Évasion').waitFor({ timeout: 15000 }); } catch (e) {
  await P[0].p.screenshot({ path: shots + 'zz-p0.png' }); await mj.screenshot({ path: shots + 'zz-mj.png' }); await tv.screenshot({ path: shots + 'zz-tv.png' });
  for (const x of P) console.log(x.first, await x.p.evaluate(() => { const c = window.__client; return JSON.stringify({ st: c.status, pubSt: c.pub && c.pub.nuit && c.pub.nuit.st, age: Date.now() - c.lastPubAt, privSt: c.priv && c.priv.nuit && c.priv.nuit.st, vis: document.visibilityState }); }));
  console.log(errs.join('\n')); throw e;
}
// énigmes
const enig = await tv.evaluate(() => window.__host.E.S.nuit.escape.enigmas.filter((e) => !e.decoy).map((e) => [e.num, e.answers[0]]));
for (let i = 0; i < enig.length; i++) {
  const p = P[i % 4].p;
  if (i >= 4) await p.getByRole('button', { name: 'Retour' }).first().click();
  for (const k of enig[i][0]) await p.locator('.keys button', { hasText: k }).first().click();
  await p.getByRole('button', { name: 'Ouvrir' }).click();
  await p.locator('input.inp').waitFor({ timeout: 15000 });
  await p.locator('input.inp').fill(enig[i][1]);
  await p.getByRole('button', { name: 'Valider la réponse' }).click();
  await p.getByText(/rejoint (le cadenas|les autres)/).waitFor({ timeout: 15000 });
}
await wait(1500);
await tv.screenshot({ path: shots + 'n-tv-evasion.png' });
const p0 = P[1].p;
await p0.getByRole('button', { name: 'Retour' }).first().click();
await p0.getByRole('heading', { name: /ultime/ }).waitFor({ timeout: 15000 });
await p0.screenshot({ path: shots + 'n-p-ultime.png' });
await p0.locator('input.inp').fill('le bocal de riz');
await p0.getByRole('button', { name: 'Valider la réponse' }).click();
await p0.getByRole('heading', { name: 'Fuyez' }).waitFor({ timeout: 15000 });
for (const x of P) await x.p.getByRole('button', { name: 'Voir la carte' }).click({ timeout: 15000 });
// le chasseur sort tout de suite
await mtab('Acte 2');
await wait(4000);
await mj.screenshot({ path: shots + 'n-mj-chasse.png' });
// capture : Charlie attrapé par le MJ, Delta reste libre (chacun pour soi)
const pc = P[2].p;
const k = await pc.locator('.knob').boundingBox();
await pc.mouse.move(k.x + 20, k.y + 20);
await pc.mouse.down();
for (let x = 0; x <= 320; x += 20) await pc.mouse.move(k.x + 20 + x, k.y + 20);
await pc.mouse.up();
await pc.locator('.sheet .frow').first().click();
await pc.getByRole('button', { name: 'Confirmer l’exorcisme' }).click();
await pc.getByRole('heading', { name: 'Exorcisé' }).waitFor({ timeout: 15000 });
await P[3].p.waitForTimeout(1500);
if (await P[3].p.getByRole('heading', { name: 'Exorcisé' }).count()) throw new Error('Delta ne devait pas être exorcisé');
await pc.screenshot({ path: shots + 'n-p-exorcise.png' });
await wait(1500);
await tv.screenshot({ path: shots + 'n-tv-exorcisme.png' });
console.log(errs.length ? errs.join('\n') : 'aucune erreur');
await b.close();
