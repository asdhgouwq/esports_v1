import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMatchSummary, matchReviewKey } from './matchSummary.js';

const game = (id, winner, fields = {}) => ({
  game_id: id, match_id: 'series-1', tournament: 'LCK',
  team1: 'T1', team2: 'GEN', win_team: winner, gamelength_number: 30,
  ...fields,
});

test('side changes keep the score tied to team names, with a cumulative set history', () => {
  const result = buildMatchSummary([
    game('g1', 'T1'),
    game('g2', 'GEN', { team1: 'GEN', team2: 'T1', gamelength_number: '35.5' }),
    game('g3', 'T1', { gamelength_number: 40 }),
  ]);
  assert.deepEqual(result.score, [2, 1]);
  assert.deepEqual(result.sets.map((set) => set.score), [[1, 0], [1, 1], [2, 1]]);
  assert.equal(result.totalMinutes, 105.5);
  assert.equal(result.averageMinutes, 105.5 / 3);
  assert.match(result.overview, /T1 2 : 1 GEN/);
  assert.doesNotMatch(result.overview, /최종|우승|시리즈 승리/);
});

test('duplicated games never inflate the score or total play time', () => {
  const record = game('g1', 'T1');
  const result = buildMatchSummary([record, { ...record }]);
  assert.deepEqual(result.score, [1, 0]);
  assert.equal(result.confirmed, 1);
  assert.equal(result.totalMinutes, 30);
  assert.equal(result.sets.length, 1);
});

test('unknown winners and unrelated teams do not become wins', () => {
  const result = buildMatchSummary([
    game('g1', null, { gamelength_number: null }),
    game('g2', 'UNKNOWN', { gamelength_number: 'bad' }),
    game('g3', 'T1', { team2: 'OTHER', gamelength_number: -1 }),
  ]);
  assert.deepEqual(result.score, [0, 0]);
  assert.equal(result.confirmed, 0);
  assert.equal(result.totalMinutes, null);
  assert.equal(result.averageMinutes, null);
  assert.match(result.overview, /승패가 아직 확인되지/);
});

test('empty and tied records do not declare a match winner', () => {
  const empty = buildMatchSummary([]);
  assert.equal(empty.confirmed, 0);
  assert.equal(empty.totalMinutes, null);
  assert.match(empty.overview, /기록이 연결되면/);
  const tied = buildMatchSummary([game('g1', 'T1'), game('g2', 'GEN')]);
  assert.match(tied.overview, /승수가 같습니다/);
  assert.doesNotMatch(tied.overview, /앞서|최종|시리즈 승리/);
});

test('reviews follow the same series across games and changing sides', () => {
  const first = game('g1', 'T1');
  const next = game('g2', 'GEN', { team1: 'GEN', team2: 'T1' });
  assert.equal(matchReviewKey(first, 'g1'), matchReviewKey(next, 'g2'));
  assert.notEqual(matchReviewKey(first, 'g1'), matchReviewKey({ ...first, tournament: 'MSI' }, 'g1'));
  assert.notEqual(matchReviewKey(first, 'g1'), matchReviewKey({ ...first, match_id: 'series-2' }, 'g1'));
  assert.notEqual(matchReviewKey(null, 'layout-preview'), matchReviewKey(null, 'unknown-game'));
});

test('missing early sets do not relabel source set numbers and source order beats timestamps', () => {
  const result = buildMatchSummary([game('g5','T1',{game_number:5}),game('g2','GEN',{game_number:2})]);
  assert.deepEqual(result.sets.map(s=>s.index),[1,4]);
  assert.deepEqual(result.sets.map(s=>s.gameId),['g2','g5']);
});
