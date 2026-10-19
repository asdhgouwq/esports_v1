const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createWorldsSync, prepareSnapshot, normalizeSchedule } = require('./worldsSync');
const { LeaguepediaService } = require('./leaguepedia');
const schedule = (fields = {}) => ({ MatchId: '2026 Season World Championship/Main Event_Round 1_1', OverviewPage: '2026 Season World Championship/Main Event', Tournament: 'Worlds 2026 Main Event', Team1: 'A', Team2: 'B', Team1Score: '', Team2Score: '', Winner: '', BestOf: '3', DateTime_UTC: '2026-10-20 22:00:00', HasTime: '1', ...fields });
const game = { GameId: 'fixture_2', MatchId: schedule().MatchId, Tournament: schedule().Tournament, GameNumber: '2', Team1: 'A', Team2: 'B', WinTeam: 'A', DateTime_UTC: '2026-10-20 22:40:00', Gamelength_Number: '' };
const snapshot = () => ({ year: 2026, fetchedAt: '2026-10-21T00:00:00Z', schedules: [schedule()], games: [game], players: [], drafts: [] });
test('unknown teams, times and scores stay unknown; partial scores cannot declare a series winner', () => {
  const row = normalizeSchedule(schedule({ Team1: 'TBD', Team2: 'TBD', HasTime: '', DateTime_UTC: '' }), 'now');
  assert.equal(row.team1, null); assert.equal(row.team1_score, null); assert.equal(row.winner, null); assert.equal(row.has_time, false); assert.equal(row.datetime_utc, null);
  assert.equal(normalizeSchedule(schedule({ Winner: '1', Team1Score: '1' }), 'now').winner, null);
  assert.equal(normalizeSchedule(schedule({ Winner: '1', Team1Score: '2', Team2Score: '1' }), 'now').winner, 'A');
  assert.equal(normalizeSchedule(schedule({ Winner: '2', Team1Score: '2', Team2Score: '1' }), 'now').winner, null);
});
test('valid completed results survive pending player/draft details and preserve their actual set number', () => {
  const bundle = prepareSnapshot(snapshot());
  assert.equal(bundle.matches.length, 1); assert.equal(bundle.matches[0].game_number, 2);
  assert.equal(bundle.matches[0].gamelength_number, null);
  assert.equal(bundle.players.length, 0); assert.equal(bundle.drafts.length, 0);
  assert.deepEqual(bundle.pending.map(r=>r.kind).sort(), ['draft', 'players']);
  assert.throws(()=>prepareSnapshot({ ...snapshot(), games: [game, game] }), { code: 'SOURCE_DUPLICATE' });
  assert.throws(()=>prepareSnapshot({ ...snapshot(), schedules: [] }), { code: 'SOURCE_INCOMPLETE' });
});
test('bulk source pages every table and has no first-set-only restriction', async () => {
  const service = new LeaguepediaService(); const calls = [];
  service.cargoQuery = async params => { calls.push(params); return params.tables === 'ScoreboardPlayers' && params.offset === 0 ? Array.from({length:500},(_,i)=>({GameId:`g${i}`})) : []; };
  await service.getWorldsSnapshot(2026);
  assert.equal(calls.length, 5);
  const scoreboard = calls.find(c=>c.tables.startsWith('ScoreboardGames'));
  assert.doesNotMatch(scoreboard.where, /N_GameInMatch\s*=/);
  assert.equal(calls.filter(c=>c.tables === 'ScoreboardPlayers')[1].offset, 500);
  assert.ok(calls.every(c=>c.limit===500));
});
async function fixture(t, options = {}) {
  const storageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dol-worlds-'));
  t.after(()=>fs.rm(storageDir,{recursive:true,force:true}));
  const saved = { matches: new Map(), player_stats: new Map(), game_drafts: new Map(), match_schedules: new Map() };
  let writes = 0;
  const db = { from: table => ({ upsert(rows,{onConflict}) { writes++; for (const row of rows) saved[table].set(row[onConflict],row); return { select: async () => options.failTable===table ? {error:{code:'42501'}} : { data: rows.map(r=>({[onConflict]:r[onConflict]})) } }; } }) };
  const sync = createWorldsSync({ db, source: options.source || {getWorldsSnapshot:async()=>snapshot()}, storageDir, serverConfigured:()=>options.key !== false, enabled:false });
  return { sync, saved, writes:()=>writes };
}
test('concurrent manual requests share one job, upserts are idempotent and failures never report completion', async t => {
  let resolve; let reads=0;
  const f = await fixture(t,{ source:{getWorldsSnapshot:()=>{reads++;return new Promise(r=>{resolve=r;});}} });
  f.sync.startSync(); f.sync.startSync(); await new Promise(r=>setImmediate(r));
  // The job persists status before querying.
  while (!resolve) await new Promise(r=>setImmediate(r));
  resolve(snapshot()); await f.sync.wait();
  assert.equal(reads,1); assert.equal(f.sync.status().last.state,'complete');
  assert.equal(f.saved.matches.size,1); assert.equal(f.saved.match_schedules.size,1);
  f.sync.startSync(); while (reads<2) await new Promise(r=>setImmediate(r)); resolve(snapshot()); await f.sync.wait();
  assert.equal(f.saved.matches.size,1); assert.equal(f.saved.match_schedules.size,1);
  const failed = await fixture(t,{failTable:'match_schedules'}); failed.sync.startSync(); await failed.sync.wait();
  assert.equal(failed.sync.status().last.state,'failed'); assert.equal(failed.sync.status().last.counts,undefined);
  const noKey = await fixture(t,{key:false}); noKey.sync.startSync(); await noKey.sync.wait(); assert.equal(noKey.writes(),0); assert.equal(noKey.sync.status().last.code,'SERVER_KEY_REQUIRED');
});

test('draft side order controls blue/red columns without changing the winner or team identity',()=>{
  const picks = ['A','B','C','D','E','F','G','H','I','J'];
  const raw={...game, Team1Picks:picks.slice(0,5).join(','),Team2Picks:picks.slice(5).join(','),Team1Bans:'K,L,M,N,O',Team2Bans:'P,Q,R,S,T'};
  const draft={GameId:game.GameId,Team1:'B',Team2:'A'};
  for(let i=0;i<5;i++){draft[`Team1Pick${i+1}`]=picks[i+5];draft[`Team2Pick${i+1}`]=picks[i];draft[`Team1Ban${i+1}`]='PQRST'[i];draft[`Team2Ban${i+1}`]='KLMNO'[i];}
  const bundle=prepareSnapshot({...snapshot(),games:[raw],drafts:[draft]});
  assert.equal(bundle.matches[0].team1,'B');assert.equal(bundle.matches[0].team2,'A');assert.equal(bundle.matches[0].win_team,'A');
  assert.equal(bundle.matches[0].team1_picks,'F,G,H,I,J');assert.equal(bundle.matches[0].team1_bans,'P,Q,R,S,T');
});
test('automatic sync starts on boot, schedules the next run, and honors a longer source cooldown',async t=>{
  const storageDir=await fs.mkdtemp(path.join(os.tmpdir(),'dol-worlds-timer-'));t.after(()=>fs.rm(storageDir,{recursive:true,force:true}));
  const clock=Date.parse('2026-10-20T00:00:00Z'); let callback,delay,limited=false;
  const db={from:()=>({upsert:rows=>({select:async()=>({data:rows})})})};
  const sync=createWorldsSync({db,storageDir,enabled:true,serverConfigured:()=>true,now:()=>clock,setTimer:(fn,ms)=>{callback=fn;delay=ms;return{}},clearTimer:()=>{},source:{getWorldsSnapshot:async()=>{if(limited)throw Object.assign(new Error('limit'),{code:'ratelimited',retryAt:clock+1800000});return snapshot();}}});
  await sync.start(); assert.equal(delay,1000); callback(); await sync.wait();
  assert.equal(sync.status().last.state,'complete'); assert.equal(delay,900000);
  limited=true; callback();await sync.wait();assert.equal(sync.status().last.state,'failed');assert.equal(delay,1800000);
  sync.stop();assert.equal(sync.status().enabled,false);assert.equal(sync.status().nextRunAt,null);
});
