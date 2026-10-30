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
act('p1', 'answer', { num: '237', text: 'Quinze' });
act('p2', 'num', { n: '666' }); act('p2', 'answer', { num: '666', text: 'Michael Myers' });
act('p3', 'num', { n: '1408' }); act('p3', 'hint', { num: '1408' }); act('p3', 'answer', { num: '1408', text: "l'ombre" });
act('p4', 'num', { n: '13' }); act('p4', 'answer', { num: '13', text: 'Poltergeist' });
const pv = E.playerView('p5').nuit;
assert.equal(pv.solved, 4);
assert.ok(pv.ultimate);
assert.deepEqual(pv.enigmas.map((e) => e.digit).sort().join(''), '1368');
T += 10 * MIN;
act('p5', 'code', { code: '1111' });
assert.equal(E.S.nuit.tries, 1);
act('p5', 'code', { code: '3618' });
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
// capture par le MJ : le binôme tombe aussi
act('p0', 'caught', { by: 'mj' });
assert.equal(E.S.nuit.status.p0, 'exorcise');
assert.equal(E.S.nuit.status.p1, 'exorcise');
assert.ok(E.playerView('p0').nuit.sights.length > 0, 'un exorcisé voit les signalements');
// Jason (p4) se relève une fois
act('p4', 'caught', { by: 'p0' });
assert.equal(E.S.nuit.status.p4, 'monstre');
act('p4', 'caught', { by: 'p0' });
assert.equal(E.S.nuit.status.p4, 'exorcise');
assert.equal(E.S.nuit.status.p5, 'exorcise');
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
assert.equal(E.S.nuit.status.p7, 'sauve');
act('p2', 'gps', { lat: R.lat, lng: R.lng, acc: 5 });
act('p8', 'gps', { lat: R.lat, lng: R.lng, acc: 5 });
assert.equal(E.S.nuit.st, 'fin', 'fin quand plus aucun monstre libre');
const res = E.S.nuit.results;
assert.equal(res.saved.length, 6);
assert.equal(res.exo.length, 4);
JSON.stringify(E.publicView({})); JSON.stringify(E.mjView());
console.log('nuit : OK');
