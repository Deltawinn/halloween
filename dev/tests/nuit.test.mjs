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
// évasion
act('p0', 'num', { n: '999' });
act('p0', 'num', { n: '237' });
act('p1', 'answer', { num: '237', text: '5' });
assert.ok(!E.S.nuit.solved['237'], 'mauvaise réponse refusée');
act('p1', 'answer', { num: '237', text: 'Six' });
act('p2', 'num', { n: '666' }); act('p2', 'answer', { num: '666', text: 'il en reste 3' });
act('p3', 'num', { n: '1408' }); act('p3', 'hint', { num: '1408' }); act('p3', 'answer', { num: '1408', text: 'neuf' });
act('p4', 'num', { n: '13' }); act('p4', 'answer', { num: '13', text: '2' });
const pv = E.playerView('p5').nuit;
assert.equal(pv.solved, 4);
assert.ok(pv.ultimate);
assert.deepEqual(pv.enigmas.map((e) => e.digit).sort().join(''), '2369');
for (const e of pv.enigmas) assert.equal(e.digit, { 13: '2', 237: '6', 666: '3', 1408: '9' }[e.num], 'la réponse est le chiffre');
T += 10 * MIN;
act('p5', 'code', { code: '1111' });
assert.equal(E.S.nuit.tries, 1);
act('p5', 'code', { code: '2639' });
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
act('p6', 'gps', { lat: R.lat + 0.0006, lng: R.lng, acc: 5 });
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

// tout le monde attrapé pendant l'alerte : le portail les rappelle, l'acte 3 se joue quand même
E.handle({ mj: true }, { g: 'nuit', a: 'reset' });
E.handle({ mj: true }, { g: 'nuit', a: 'start' });
E.handle({ mj: true }, { g: 'nuit', a: 'next' });
assert.equal(E.S.nuit.st, 'alerte');
for (const id of ids) act(id, 'caught', { by: 'mj' });
act('p4', 'caught', { by: 'mj' }); // Jason se relève une première fois
assert.equal(E.S.nuit.st, 'refuge', 'acte 3 même si tout le monde est exorcisé');
assert.ok(ids.every((id) => E.S.nuit.status[id] === 'monstre'), 'tout le monde redevient monstre');
assert.ok(E.publicView({}).nuit.revivedAll);
T += 25 * MIN; E.tick();
assert.equal(E.S.nuit.st, 'fin');
assert.equal(E.S.nuit.results.captures, 10, 'les captures de l’acte 2 restent comptées');
assert.equal(E.S.nuit.results.lost.length, 10, 'personne n’a rejoint le refuge');
assert.equal(E.S.nuit.results.hunters.mj, 10);
console.log('nuit : OK');
