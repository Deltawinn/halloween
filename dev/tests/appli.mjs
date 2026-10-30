// Appli installée : ouverture sans lien, rejoindre par le lien de la TV, puis réouverture directe dans la partie.
import { chromium } from 'playwright';
const R = '?relais=' + encodeURIComponent('ws://localhost:8883');
const BASE = 'http://localhost:8080/' + R;
const shots = new globalThis.URL('../shots/', import.meta.url).pathname;
const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const errs = [];
const tv = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await tv.goto(BASE);
await tv.getByText('joignable').first().waitFor({ timeout: 15000 });
await tv.getByRole('button', { name: 'Créer la partie' }).click();
await tv.waitForTimeout(2000);
const join = await tv.evaluate(() => window.__host.joinUrl());

const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['camera', 'geolocation'], geolocation: { latitude: 48.8566, longitude: 2.3522 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => errs.push(e.message));
// site ouvert sur un téléphone, sans lien
await p.goto(BASE);
await p.getByRole('button', { name: 'Scanner le QR code de la TV' }).waitFor({ timeout: 10000 });
await p.screenshot({ path: shots + 'a1-telephone.png' });
// appli installée
await p.goto(BASE + '&app=1');
await p.waitForTimeout(800);
await p.screenshot({ path: shots + 'a2-appli.png' });
await p.getByRole('button', { name: 'Scanner le QR code de la TV' }).click();
await p.waitForTimeout(1500);
await p.screenshot({ path: shots + 'a3-scan.png' });
await p.locator('input.inp').fill(join);
await p.getByRole('button', { name: 'Rejoindre' }).click();
await p.getByRole('button', { name: /Continuer sans installer|Entrer dans la partie/ }).waitFor({ timeout: 15000 });
await p.screenshot({ path: shots + 'a4-accueil.png' });
await p.getByRole('button', { name: /Continuer sans installer|Entrer dans la partie/ }).click();
await p.getByRole('button', { name: 'Lancer l’analyse' }).click({ timeout: 15000 });
await p.locator('input.inp').nth(0).fill('Echo');
await p.getByRole('button', { name: 'Continuer' }).click();
await p.locator('.mt').first().waitFor({ timeout: 15000 });
// réouverture de l'icône : on retombe dans la partie, déjà inscrit
await p.goto(BASE + '&app=1');
await p.locator('.mt').first().waitFor({ timeout: 15000 });
console.log('réouverture OK :', (await p.textContent('h1')).trim());
// le Mac garde la page d'accueil de l'organisateur
const mac = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await mac.goto(BASE);
await mac.getByRole('button', { name: /Créer la partie|Nouvelle partie/ }).waitFor({ timeout: 10000 });
console.log(errs.length ? errs.join('\n') : 'aucune erreur');
await b.close();
