import {test} from 'node:test';
import assert from 'node:assert/strict';
import {equipmentTooltipEntry} from './equipmentTooltip.js';
import {itemTooltipDetails} from './itemTooltip.js';

test('rune tooltip uses Korean detailed effects and preserves the English lookup catalog', () => {
  const source = {id: 8010, name: 'Conqueror', longDesc: 'English detail'};
  const equipment = {runes: [source], localizedRunes: {8010: {id: 8010, name: '정복자', shortDesc: '짧은 설명', longDesc: '중첩마다 <b>적응형 능력치</b>를 얻습니다.<br><br>최대 12회까지 중첩됩니다.'}}};
  const entry = equipmentTooltipEntry('rune', '8010', equipment);
  assert.equal(entry.name, '정복자');
  assert.deepEqual(itemTooltipDetails(entry).effects, ['중첩마다 적응형 능력치를 얻습니다.', '최대 12회까지 중첩됩니다.']);
  assert.equal(source.name, 'Conqueror');
  assert.equal(source.description, undefined);
});

test('rune descriptions fall back to short or English descriptions without inventing unrecorded secondary runes', () => {
  const equipment = {runes: [{id: 8437, name: 'Grasp', longDesc: 'English effect'}, {id: 8400, name: 'Resolve', slots: [{runes: [{id: 8437, longDesc: 'Do not select this effect'}]}]}], localizedRunes: {8437: {id: 8437, name: '착취의 손아귀', shortDesc: '체력 회복'}, 8400: {id: 8400, name: '결의', slots: []}}};
  assert.equal(equipmentTooltipEntry('rune', 8437, equipment).description, '체력 회복');
  assert.equal(equipmentTooltipEntry('rune', 8437, {runes: equipment.runes}).description, 'English effect');
  assert.deepEqual(equipmentTooltipEntry('rune', 8400, equipment), {id: 8400, name: '결의', slots: [], description: '내구력 및 군중 제어'});
  assert.equal(equipmentTooltipEntry('rune', 1234, {runes: [{id: 1234, name: 'Unknown rune'}]}).description, '');
});

test('summoner spells use description instead of unresolved dynamic tooltips', () => {
  const equipment = {spells: {SummonerTeleport: {name: 'Teleport', description: 'Travel to an ally.'}}, localizedSpells: {SummonerTeleport: {name: '순간이동', description: '아군 유닛에게로 이동합니다.', tooltip: '{{ channelduration }}초 후 이동합니다.'}}};
  assert.equal(equipmentTooltipEntry('spell', 'SummonerTeleport', equipment).description, '아군 유닛에게로 이동합니다.');
  equipment.localizedSpells.SummonerTeleport.description = '{{ unknown }}초 후 이동합니다.';
  assert.equal(equipmentTooltipEntry('spell', 'SummonerTeleport', equipment).description, 'Travel to an ally.');
  delete equipment.spells.SummonerTeleport;
  assert.equal(equipmentTooltipEntry('spell', 'SummonerTeleport', equipment).description, '');
});

test('item data keeps its price and effects, while unknown or inherited IDs remain unavailable', () => {
  const equipment = {items: {'1001': {name: 'Boots', gold: {total: 300}}}, localizedItems: {'1001': {name: '장화', gold: {total: 300}, description: '<stats>이동 속도 25</stats>'}}};
  assert.equal(equipmentTooltipEntry('item', '1001', equipment), equipment.localizedItems['1001']);
  assert.equal(equipmentTooltipEntry('item', '1001', {items: equipment.items}).gold.total, 300);
  for (const type of ['item', 'rune', 'spell', 'unknown']) {
    for (const id of [null, undefined, 'missing', 'constructor', '__proto__']) assert.equal(equipmentTooltipEntry(type, id, equipment), null);
  }
  assert.equal(equipmentTooltipEntry('spell', 'SummonerFlash'), null);
});
