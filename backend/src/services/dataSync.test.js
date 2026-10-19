const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { normalizeBundle, createDataSyncService } = require('./dataSync');
const { attachPlayerTeams } = require('./playerTeams');

// Synthetic fixtures test ingestion only and are never sent to Supabase.
function fixture() {
  const game = { GameId: 'Fixture/2024/1', MatchId: 'Fixture/2024', GameNumber: '1', Tournament: 'Fixture League', DateTime_UTC: '2024-01-01 12:00:00', Team1: 'ALPHA', Team2: 'BETA', WinTeam: 'ALPHA', Gamelength_Number: '30.5', Patch: '14.1', Team1Picks: 'A,B,C,D,E', Team2Picks: 'F,G,H,I,J', Team1Bans: 'K,L,M,N,O', Team2Bans: 'P,Q,R,S,T' };
  const players = 'ABCDEFGHIJ'.split('').map((Champion, index) => ({ GameId: game.GameId, Name: `FixturePlayer${index}`, Role: ['Top', 'Jungle', 'Mid', 'Bot', 'Support'][index % 5], Team: index < 5 ? game.Team1 : game.Team2, Champion, Kills: '0', Deaths: '1', Assists: '2', Gold: '10000', CS: '200', DamageToChampions: '', Items: '1001;Unknown Item' }));
  const draft = { GameId: game.GameId, Team1: game.Team1, Team2: game.Team2 };
  for (const team of [1, 2]) for (let i = 1; i <= 5; i++) {
    draft[`Team${team}Pick${i}`] = game[`Team${team}Picks`].split(',')[i - 1];
    draft[`Team${team}Ban${i}`] = game[`Team${team}Bans`].split(',')[i - 1];
  }
  return { game, players, drafts: [draft] };
}
function fakeDb({ failTable, teamColumn = false } = {}) {
  const rows = { matches: [], player_stats: [] };
  let writes = 0;
  return { rows, get writes() { return writes; }, from(table) {
    let columns, value;
    const result = () => ({ data: rows[table].filter((row) => !value || row.game_id === value), error: null });
    return {
      select(c) { columns = c; return this; }, eq(_key, v) { value = v; return this; },
      async limit() { return { data: [], error: columns === 'team' && !teamColumn ? { code: '42703' } : null }; },
      async maybeSingle() { return { data: result().data[0] || null, error: null }; },
      async upsert(data) { writes++; if (failTable === table) return { error: { code: '42501' } }; rows[table] = Array.isArray(data) ? data : [data]; return { error: null }; },
      then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
    };
  } };
}
async function service(t, db, source) {
  const storageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dol-ingest-'));
  t.after(() => fs.rm(storageDir, { recursive: true, force: true }));
  const data = fixture();
  return createDataSyncService({ db, storageDir, source: source || { getRecentMatches: async () => [data.game], getPlayerStats: async () => data.players, getDraft: async () => data.drafts } });
}
test('import normalization validates full game and keeps missing damage distinct from zero', () => {
  const { game, players, drafts } = fixture();
  const bundle = normalizeBundle(game, players, drafts);
  assert.equal(bundle.match.datetime_utc, '2024-01-01T12:00:00.000Z');
  assert.equal(bundle.stats.length, 10);
  assert.equal(bundle.stats[0].kills, 0);
  assert.equal(bundle.stats[0].damage_to_champions, null);
  assert.equal(bundle.stats[0].item0, '1001');
  assert.equal(bundle.stats[0].item1, null);
  assert.equal(bundle.draft.state, 'ready');
});
test('partial, cross-game, contradictory team/pick and missing draft records cannot be imported', () => {
  for (const mutate of [
    (data) => data.players.pop(),
    (data) => { data.players[0].GameId = 'other'; },
    (data) => { data.players[0].Team = 'BETA'; },
    (data) => { data.players[0].Champion = 'J'; },
    (data) => { data.players[0].Kills = ''; },
    (data) => { data.game.GameNumber = '0'; },
    (data) => { data.drafts[0].Team1Pick1 = 'X'; },
    (data) => { data.drafts[0].Team1Ban5 = null; },
  ]) { const data = fixture(); mutate(data); assert.throws(() => normalizeBundle(data.game, data.players, data.drafts), { code: 'SOURCE_INCOMPLETE' }); }
});
test('successful ingestion checks stored results and supports the existing schema without team column', async (t) => {
  const db = fakeDb(), sync = await service(t, db);
  const result = await sync.syncMatches();
  assert.equal(result.synced, 1);
  assert.equal(result.players, 10);
  assert.equal(result.draft, 'verified');
  assert.equal(db.rows.player_stats[0].team, undefined);
  const enriched = attachPlayerTeams(db.rows.player_stats, db.rows.matches);
  assert.equal(enriched.filter((player) => player.team === 'ALPHA').length, 5);
  assert.equal(enriched.filter((player) => player.team === 'BETA').length, 5);
});
test('Supabase write failure is a failure and never reports a successful import', async (t) => {
  for (const failTable of ['matches', 'player_stats']) {
    const db = fakeDb({ failTable }), sync = await service(t, db);
    await assert.rejects(sync.syncMatches(), { code: 'DATABASE_WRITE_FAILED' });
    assert.equal(db.writes, failTable === 'matches' ? 1 : 2);
  }
});
test('a full SQL import can be verified with read-only API access while partial or changed rows are rejected', async (t) => {
  const data = fixture(), bundle = normalizeBundle(data.game, data.players, data.drafts);
  const db = fakeDb({ failTable: 'matches' });
  db.rows.matches = [bundle.match];
  db.rows.player_stats = bundle.stats.map(({ team, ...player }) => player);
  const sync = await service(t, db);
  const result = await sync.syncMatches();
  assert.equal(result.alreadyStored, true);
  assert.equal(result.synced, 0);
  assert.equal(db.writes, 0);
  db.rows.player_stats[0].gold = 1;
  await assert.rejects(sync.syncMatches(), { code: 'DATABASE_WRITE_FAILED' });
});
test('upstream failure writes no match or player records', async (t) => {
  const db = fakeDb(), sync = await service(t, db, { getRecentMatches: async () => { throw Object.assign(new Error('limited'), { code: 'ratelimited' }); } });
  await assert.rejects(sync.syncMatches(), { code: 'ratelimited' });
  assert.equal(db.writes, 0);
});
test('ambiguous champion lists never invent a player team', () => {
  const players = [{ game_id: 'g1', champion: 'A' }];
  const enriched = attachPlayerTeams(players, [{ game_id: 'g1', team1: 'A', team2: 'B', team1_picks: 'A,B,C,D,E', team2_picks: 'A,G,H,I,J' }]);
  assert.equal(enriched[0].team, undefined);
});
