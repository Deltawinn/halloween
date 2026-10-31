// Test du moteur sans réseau : une partie complète en accéléré.
import assert from 'node:assert/strict';
import { Engine, freshState } from '../../js/host/engine.js';
import { MONSTERS } from '../../js/data.js';

let T = 1_000_000;
const E = new Engine(freshState('test'));
E.clock = () => T;
const MIN = 60000;
const C = { lat: 48.65, lng: 2.56 };
const R = { lat: 48.653, lng: 2.565 };
const ids = [];
for (let i = 0; i < 10; i++) {
  const pid = 'p' + i;
  E.addPlayer({ pid, pub: { x: 1 }, name: 'J' + i });
  E.handle({ pid }, { a: 'identity', first: 'Joueur' + i, last: 'Test' });
  E.handle({ pid }, { a: 'monster', name: i === 9 ? 'Le Yéti' : MONSTERS[i].name });
  ids.push(pid);
}
for (let i = 0; i < 10; i += 2) {
  E.handle({ pid: ids[i] }, { a: 'choose', pid: ids[i + 1] });
  E.handle({ pid: ids[i + 1] }, { a: 'choose', pid: ids[i] });
}
assert.equal(E.S.players.p0.bound, 'p1');
assert.equal(E.S.players.p9.monster.custom, true);
const mj = (a, x) => E.handle({ mj: true }, { g: 'nuit', a, ...x });
const act = (pid, a, x) => E.handle({ pid }, { g: 'nuit', a, ...x });
mj('center', C); mj('refugePt', R);
assert.equal(E.playerView('p0').nuit.power, undefined, 'pouvoir caché avant la partie');
mj('start');
assert.equal(E.S.nuit.st, 'evasion');
assert.ok(E.playerView('p0').nuit.power.name);
// évasion : 5 énigmes tirées au sort dans la réserve de 20
const X = E.S.nuit.escape;
assert.equal(X.enigmas.length, 5);
assert.equal(new Set(X.enigmas.map((e) => e.q)).size, 5, 'cinq énigmes différentes');
assert.deepEqual(X.enigmas.map((e) => e.num), ['13', '237', '666', '1408', '1428']);
assert.equal(X.enigmas.filter((e) => e.decoy).length, 1, 'une carte leurre');
const real = X.enigmas.filter((e) => !e.decoy);
const decoy = X.enigmas.find((e) => e.decoy);
// pouvoirs fixés pour la suite du test
for (const id of ids) E.S.nuit.powers[id] = { id: 'hide', used: false };
Object.assign(E.S.nuit.powers, { p2: { id: 'fake', used: false }, p4: { id: 'immune', used: false } });
assert.equal(E.playerView('p0').nuit.enigmas.filter((e) => e.found).length, 0, 'aucun numéro connu avant d’être tapé');
assert.equal(E.playerView('p0').nuit.enigmas[0].num, undefined);
act('p0', 'num', { n: '999' });
const e0 = real[0];
act('p0', 'num', { n: e0.num });
act('p1', 'answer', { num: e0.num, text: 'mauvaise réponse' });
assert.ok(!E.S.nuit.solved[e0.num], 'mauvaise réponse refusée');
act('p1', 'answer', { num: e0.num, text: e0.answers[0].toUpperCase() });
assert.ok(E.S.nuit.solved[e0.num]);
act('p9', 'num', { n: decoy.num });
act('p9', 'answer', { num: decoy.num, text: 'Candyman' });
assert.ok(!E.S.nuit.solved[decoy.num], 'le leurre n’a pas de bonne réponse');
real.slice(1).forEach((e, i) => {
  const pid = 'p' + (i + 2);
  act(pid, 'num', { n: e.num });
  if (i === 1) act(pid, 'hint', { num: e.num });
  act(pid, 'answer', { num: e.num, text: 'je crois que c’est ' + e.answers[0] });
});
const pv = E.playerView('p5').nuit;
assert.equal(pv.solved, 4);
assert.ok(pv.ultimate);
for (const e of pv.enigmas.filter((x) => x.solvedBy)) assert.equal(e.digit, X.fragments[X.order.indexOf(e.sym)], 'fragment du symbole');
assert.equal(X.order.map((sy) => X.fragments[X.order.indexOf(sy)]).join(' '), 'Beau Ko 2 Ri');
T += 10 * MIN;
act('p5', 'code', { code: 'sous le canapé' });
assert.equal(E.S.nuit.tries, 1);
act('p5', 'code', { code: 'Dans le Bocal de riz !' });
assert.equal(E.S.nuit.st, 'alerte');
assert.equal(E.S.nuit.head, 5, 'avance : max 6 min, moins 1 indice');
// traque
for (const id of ids) act(id, 'gps', { lat: C.lat + 0.001, lng: C.lng, acc: 10 });
E.tick();
assert.equal(E.S.nuit.sights.length, 0, 'pas de signalement avant la sortie du chasseur');
T += 6 * MIN; E.tick();
assert.equal(E.S.nuit.sights.length, 10);
// hors zone
act('p6', 'gps', { lat: C.lat + 0.02, lng: C.lng, acc: 10 });
assert.ok(E.S.nuit.out.p6);
assert.ok(E.playerView('p6').nuit.out);
T += 10500; act('p6', 'gps', { lat: C.lat + 0.02, lng: C.lng, acc: 10 });
assert.equal(E.S.nuit.sights.filter((s) => s.kind === 'horszone').length, 2);
// capture par le MJ : chacun pour soi
act('p0', 'caught', { by: 'mj' });
assert.equal(E.S.nuit.status.p0, 'exorcise');
assert.equal(E.S.nuit.status.p1, 'monstre', 'le binôme n’est plus exorcisé');
act('p1', 'caught', { by: 'p0' });
assert.ok(E.playerView('p0').nuit.sights.length > 0, 'un exorcisé voit les signalements');
// Jason (p4) se relève une fois
act('p4', 'caught', { by: 'p0' });
assert.equal(E.S.nuit.status.p4, 'monstre');
act('p4', 'caught', { by: 'p0' });
assert.equal(E.S.nuit.status.p4, 'exorcise');
act('p5', 'caught', { by: 'p4' });
// pause : le temps est figé puis rendu
const end = E.S.nuit.endsAt;
E.handle({ mj: true }, { g: 'nuit', a: 'pause' });
assert.equal(E.publicView({}).nuit.pausedAt, T);
T += 2 * MIN;
E.handle({ mj: true }, { g: 'nuit', a: 'resume' });
assert.equal(E.S.nuit.endsAt, end + 2 * MIN);
// message du MJ
E.handle({ mj: true }, { g: 'nuit', a: 'say', text: 'Regardez sous le canapé' });
assert.equal(E.publicView({}).nuit.say.text, 'Regardez sous le canapé');
// Frankenstein (p7… index 17) n'est pas là ; pouvoirs simples
act('p2', 'power', {});
assert.ok(E.S.nuit.powers.p2.used);
// refuge
T += 30 * MIN; E.tick();
assert.equal(E.S.nuit.st, 'refuge');
let tl = E.playerView('p2').nuit.tiles;
assert.equal(tl[0].state, 'open');
assert.equal(tl[1].state, 'locked');
act('p2', 'read', { k: 0 });
assert.equal(E.playerView('p2').nuit.tiles[0].state, 'reading');
T += 16000;
assert.equal(E.playerView('p2').nuit.tiles[0].state, 'burnt');
T += 4 * MIN;
assert.equal(E.playerView('p2').nuit.tiles[1].state, 'open');
// pas de capture près du refuge
act('p6', 'gps', { lat: R.lat + 0.0004, lng: R.lng, acc: 5 }); // 44 m : dans la zone protégée de 50 m
act('p6', 'caught', { by: 'mj' });
assert.equal(E.S.nuit.status.p6, 'monstre');
// arrivée
act('p6', 'gps', { lat: R.lat, lng: R.lng, acc: 5 });
assert.equal(E.S.nuit.status.p6, 'sauve');
assert.equal(E.S.nuit.status.p7, 'monstre', 'chacun se sauve seul');
for (const id of ['p2', 'p3', 'p7', 'p8', 'p9']) act(id, 'gps', { lat: R.lat, lng: R.lng, acc: 5 });
assert.equal(E.S.nuit.st, 'fin', 'fin quand plus aucun monstre libre');
const res = E.S.nuit.results;
assert.equal(res.saved.length, 6);
assert.equal(res.exo.length, 4);
JSON.stringify(E.publicView({})); JSON.stringify(E.mjView());

// course au refuge : le premier exorcisé arrivé prend le refuge, les monstres qui arrivent après lui sont exorcisés
E.handle({ mj: true }, { g: 'nuit', a: 'reset' });
E.handle({ mj: true }, { g: 'nuit', a: 'start' });
for (const id of ids) E.S.nuit.powers[id] = { id: 'hide', used: false };
E.handle({ mj: true }, { g: 'nuit', a: 'next' });
act('p0', 'caught', { by: 'mj' });
E.handle({ mj: true }, { g: 'nuit', a: 'next' });
assert.equal(E.S.nuit.st, 'refuge');
assert.ok(E.playerView('p0').nuit.tiles, 'les exorcisés ont les indices');
act('p1', 'gps', { lat: R.lat, lng: R.lng, acc: 5 });
assert.equal(E.S.nuit.status.p1, 'sauve');
act('p0', 'gps', { lat: R.lat, lng: R.lng, acc: 5 });
assert.equal(E.S.nuit.sealedBy, 'p0');
assert.equal(E.S.nuit.st, 'refuge', 'la partie continue');
assert.equal(E.S.nuit.status.p2, 'monstre', 'les autres ne sont pas exorcisés tant qu’ils n’arrivent pas');
act('p2', 'gps', { lat: R.lat, lng: R.lng, acc: 5 });
assert.equal(E.S.nuit.status.p2, 'exorcise', 'piégé en arrivant');
assert.equal(E.S.nuit.status.p1, 'sauve', 'déjà rentré chez lui');
for (const id of ['p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9']) act(id, 'gps', { lat: R.lat, lng: R.lng, acc: 5 });
assert.equal(E.S.nuit.st, 'fin');
assert.equal(E.S.nuit.results.sealedBy, 'p0');
assert.ok(!E.S.nuit.results.destroyed);

// tout le monde attrapé pendant l'alerte : les exorcisés doivent retrouver le refuge pour le détruire
E.handle({ mj: true }, { g: 'nuit', a: 'reset' });
E.handle({ mj: true }, { g: 'nuit', a: 'start' });
E.handle({ mj: true }, { g: 'nuit', a: 'next' });
for (const id of ids) act(id, 'caught', { by: 'mj' });
for (const id of ids) act(id, 'caught', { by: 'mj' }); // l'immunisé se relève une fois
assert.equal(E.S.nuit.st, 'refuge', 'acte 3 même si tout le monde est exorcisé');
assert.ok(E.publicView({}).nuit.onlyHunters);
act('p3', 'gps', { lat: R.lat, lng: R.lng, acc: 5 });
assert.equal(E.S.nuit.st, 'fin');
assert.ok(E.S.nuit.results.destroyed, 'refuge détruit');
assert.ok(E.S.nuit.results.captures >= 10, 'les captures de l’acte 2 restent comptées');
assert.equal(E.S.nuit.results.ranking.length, 10, 'classement');
console.log('nuit : OK');
