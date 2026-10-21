const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createMatchDraftService, normalizeDraft } = require('./matchDraft');
const { createMatchDraftRouter } = require('../api/matchDraftRoutes');
const leaguepedia = require('./leaguepedia');

const match = () => ({ game_id: 'g1', team1: 'ALPHA', team2: 'BETA', team1_picks: 'A,B,C,D,E', team2_picks: 'F,G,H,I,J' });
function record() {
  const row = { GameId: 'g1', Team1: 'ALPHA', Team2: 'BETA', SwitchedSides: '0' };
  for (const [side, picks] of [[1, ['D', 'A', 'B', 'E', 'C']], [2, ['H', 'I', 'F', 'G', 'J']]]) {
    picks.forEach((champion, index) => { row[`Team${side}Pick${index + 1}`] = champion; row[`Team${side}Ban${index + 1}`] = `ban-${side}-${index}`; });
  }
  return row;
}
function db(rows = [match()]) {
  return { from() { let id; return { select(){return this;}, eq(_, value){id = value;return this;}, async maybeSingle(){return { data: rows.find((row) => row.game_id === id) || null, error:null };} };} };
}

test('draft source preserves actual selection order, including when stored sides are reversed', () => {
  const row = record();
  let result = normalizeDraft(row, match());
  assert.deepEqual(result.blue.picks, ['D', 'A', 'B', 'E', 'C']);
  assert.equal(result.firstPickSide, 'blue');
  result = normalizeDraft(row, { ...match(), team1: 'BETA', team2: 'ALPHA', team1_picks: 'F,G,H,I,J', team2_picks:'A,B,C,D,E' });
  assert.equal(result.blue.team, 'ALPHA');
  assert.equal(result.red.team, 'BETA');
  row.Team1Pick2 = null;
  assert.equal(normalizeDraft(row, match()).blue.picks[1], null);
});

test('wrong games, wrong teams, duplicate or contradictory picks never become verified order', () => {
  assert.equal(normalizeDraft({ ...record(), GameId: 'other' }, match()), null);
  assert.equal(normalizeDraft({ ...record(), Team1: 'other' }, match()), null);
  assert.equal(normalizeDraft({ ...record(), Team1Pick1: 'X' }, match()), null);
  assert.equal(normalizeDraft({ ...record(), Team1Pick2: 'D' }, match()), null);
});

test('red first pick and selection ownership are independent; choosing pick order can mean second pick', () => {
  const result = normalizeDraft({...record(), SwitchedSides: '1', Blue: 'BETA', Red: 'ALPHA', FirstPick: 'ALPHA', SideSelection: 'BETA', PickSelection: 'ALPHA', FirstSelection: 'ALPHA'}, match());
  assert.equal(result.blue.team, 'BETA');
  assert.equal(result.red.team, 'ALPHA');
  assert.equal(result.firstPickSide, 'red');
  assert.equal(result.firstPickTeam, 'ALPHA');
  assert.deepEqual(result.red.picks, ['D','A','B','E','C']);
  assert.deepEqual(result.selections, {side: 'BETA', pick: 'ALPHA', first: 'ALPHA'});
  const second = normalizeDraft({...record(), Blue: 'ALPHA', Red: 'BETA', FirstPick: 'ALPHA', SideSelection: 'ALPHA', PickSelection: 'BETA'}, match());
  assert.equal(second.selections.pick, 'BETA');
  assert.notEqual(second.selections.pick, second.firstPickTeam);
});

test('missing selection data is never inferred from first pick, side or a previous-game winner', () => {
  const row = record(); delete row.SwitchedSides;
  const result = normalizeDraft({...row, SideSelection: 'OTHER', PickSelection: ''}, match());
  assert.equal(result.blue, null); assert.equal(result.red, null);
  assert.equal(result.sidesConfirmed, false);
  assert.equal(result.firstPickSide, null);
  assert.deepEqual(result.selections, {side: null, pick: null, first: null});
  assert.equal(result.teams[0].team, 'ALPHA');
  for (const patch of [{FirstPick:'BETA'}, {Blue:'ALPHA',Red:'ALPHA'}, {Blue:'BETA',Red:'ALPHA'}, {Blue:'OTHER',Red:'ALPHA'}]) assert.equal(normalizeDraft({...record(), ...patch}, match()), null);
});

test('known game requests share their source lookup and cache; unknown games never reach upstream', async () => {
  let calls = 0;
  const service = createMatchDraftService({ db: db(), loadDraft: async () => { calls++; await new Promise(setImmediate); return [record()]; } });
  const [a, b] = await Promise.all([service.getDraft('g1'), service.getDraft('g1')]);
  assert.equal(a.state, 'ready');
  assert.deepEqual(a, b);
  assert.equal(calls, 1);
  await service.getDraft('g1');
  assert.equal((await service.getDraft('unknown')).state, 'waiting_for_data');
  assert.equal(calls, 1);
});

test('missing source and rate limits remain honest fallback states with upstream backoff', async () => {
  const missing = createMatchDraftService({ db: db(), loadDraft: async () => [] });
  assert.equal((await missing.getDraft('g1')).state, 'not_recorded');
  let calls = 0;
  const service = createMatchDraftService({ db: db([match(), { ...match(), game_id:'g2' }]), loadDraft: async () => { calls++; throw Object.assign(new Error('limited'), {code:'ratelimited'}); } });
  assert.equal((await service.getDraft('g1')).state, 'unavailable');
  assert.equal((await service.getDraft('g2')).state, 'unavailable');
  assert.equal(calls, 1);
});

test('draft API returns missing-data state without querying or writing an external service', async (t) => {
  const app = express();
  app.use('/api', createMatchDraftRouter(createMatchDraftService({ db: db([]), loadDraft: () => assert.fail('No source query expected') })));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/matches/no-record/draft`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).state, 'waiting_for_data');
});

test('draft query uses pick-ban table fields and quotes game identifiers as a literal', async () => {
  const client = Object.create(leaguepedia);
  client.cargoQuery = async (params, options) => {
    assert.equal(params.tables, 'PicksAndBansS7=PB,MatchScheduleGame=MSG');
    assert.equal(params.join_on, 'PB.GameId=MSG.GameId');
    assert.ok(params.fields.includes('Team1Pick1'));
    assert.ok(params.fields.includes('Team2Ban5'));
    assert.ok(params.fields.includes('MSG.PickSelection=PickSelection'));
    assert.ok(params.fields.includes('PB.SwitchedSides=SwitchedSides'));
    assert.equal(params.where, "PB.GameId = 'a'' OR ''1''=''1'");
    assert.equal(options.timeout, 12000);
    return [];
  };
  await client.getDraft("a' OR '1'='1");
});
