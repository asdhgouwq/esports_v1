const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createMatchDraftService, normalizeDraft } = require('./matchDraft');
const { createMatchDraftRouter } = require('../api/matchDraftRoutes');
const leaguepedia = require('./leaguepedia');

const match = () => ({ game_id: 'g1', team1: 'ALPHA', team2: 'BETA', team1_picks: 'A,B,C,D,E', team2_picks: 'F,G,H,I,J' });
function record() {
  const row = { GameId: 'g1', Team1: 'ALPHA', Team2: 'BETA' };
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
    assert.equal(params.tables, 'PicksAndBansS7');
    assert.ok(params.fields.includes('Team1Pick1'));
    assert.ok(params.fields.includes('Team2Ban5'));
    assert.equal(params.where, "GameId = 'a'' OR ''1''=''1'");
    assert.equal(options.timeout, 12000);
    return [];
  };
  await client.getDraft("a' OR '1'='1");
});
