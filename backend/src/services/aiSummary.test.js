const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { createAiSummaryService, compactEvidence, buildEvidence, validateReport, validateNumericClaims } = require('./aiSummary');
const { createAiSummaryRouter } = require('../api/aiSummaryRoutes');

const games = () => [
  { game_id: 'g1', match_id: 'm1', tournament: 'TEST LEAGUE', team1: 'ALPHA', team2: 'BETA', win_team: 'ALPHA', datetime_utc: '2026-10-01T10:00:00Z', gamelength_number: 30 },
  { game_id: 'g2', match_id: 'm1', tournament: 'TEST LEAGUE', team1: 'BETA', team2: 'ALPHA', win_team: 'BETA', datetime_utc: '2026-10-01T11:00:00Z', gamelength_number: 35 },
];
const report = () => ({
  headline: '검증용 요약', overview: '수집된 두 세트에서 양 팀이 각각 한 번 승리했습니다.',
  keyPoints: [{ title: '세트 결과', detail: '수집된 세트 승수는 1:1입니다.' }],
  teamAssessments: [{ team: 'ALPHA', assessment: '첫 기록에서 승리했습니다.' }, { team: 'BETA', assessment: '두 번째 기록에서 승리했습니다.' }],
});
function completion(value = report()) {
  return { ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] }) };
}

function fakeDb(rows, players = [], statsError = false) {
  return { from(table) {
    let values = [...(table === 'matches' ? rows : players)];
    const query = {
      select() { return this; },
      eq(key, value) { values = values.filter((row) => row[key] === value); return this; },
      in(key, choices) { values = values.filter((row) => choices.includes(row[key])); return this; },
      order() { return this; },
      limit(count) { values = values.slice(0, count); return this; },
      async maybeSingle() { return { data: values[0] || null, error: null }; },
      then(resolve, reject) { return Promise.resolve({ data: table === 'player_stats' && statsError ? null : values, error: table === 'player_stats' && statsError ? new Error('missing stats') : null }).then(resolve, reject); },
    };
    return query;
  } };
}

async function setup(t, options = {}) {
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dolgg-ai-test-'));
  t.after(() => fs.rm(cacheDir, { recursive: true, force: true }));
  return { cacheDir, ...options };
}

test('evidence counts changing sides and duplicates correctly without assigning unknown players to teams', () => {
  const records = games();
  const evidence = buildEvidence([...records, records[1]], [{ game_id: 'g1', name: 'PLAYER', kills: 0, gold: null }], 'series');
  assert.deepEqual(evidence.recordedScore, [1, 1]);
  assert.equal(evidence.resultCount, 2);
  assert.equal(evidence.sets.length, 2);
  assert.equal(evidence.players[0].team, null);
  assert.equal(evidence.players[0].kills, 0);
  assert.equal(evidence.players[0].gold, null);
  assert.equal(evidence.timelineAvailable, false);
  assert.equal(evidence.finalSeriesResultConfirmed, false);
});

function numericPlayers() {
  return [11, 18].flatMap((_, side) => [0, 1, 2, 3, 4].map((index) => ({
    game_id: 'g1', name: `TEST-${side}-${index}`, team: side ? 'BETA' : 'ALPHA', role: ['Top', 'Jungle', 'Mid', 'Bot', 'Support'][index],
    kills: (side ? [2, 3, 8, 5, 0] : [4, 1, 1, 5, 0])[index], deaths: 1, assists: 2, gold: 10000 + side * 1000 + index, cs: 100 + index, damage_to_champions: 20000 + index,
  })));
}
test('server totals follow team identities and incomplete rosters never imply full team totals', () => {
  const evidence = buildEvidence([games()[0]], numericPlayers(), 'game');
  assert.equal(evidence.teamTotals.find((team) => team.team === 'BETA').kills, 18);
  assert.equal(evidence.teamTotals.find((team) => team.team === 'ALPHA').kills, 11);
  assert.equal(evidence.teamDifferences[0].kills, 7);
  assert.equal(evidence.teamDifferences[0].gold, 5000);
  const incomplete = buildEvidence([games()[0]], numericPlayers().slice(1), 'game');
  assert.equal(incomplete.teamTotals.find((team) => team.team === 'ALPHA').kills, null);
  assert.equal(incomplete.teamDifferences[0].kills, null);
  assert.equal(incomplete.seriesTeamTotals.find((team) => team.team === 'ALPHA').completeRoster, false);
});
test('unsupported numeric claims such as 19 instead of 18 kills are rejected; valid ranges and rankings remain valid', () => {
  const evidence = buildEvidence([games()[0]], numericPlayers(), 'game');
  for (const overview of ['합계 19킬을 기록했습니다.', '킬 19-11입니다.', '19-11킬입니다.', '19데스입니다.', '999,999골드입니다.']) {
    assert.throws(() => validateNumericClaims({ ...report(), overview }, evidence), { code: 'AI_FACT_MISMATCH' });
  }
  for (const overview of ['합계 18킬과 11킬을 기록했습니다.', '킬 18-11입니다.', '18-11킬입니다.', '킬 18-11, 골드 55,010-50,010입니다.', '8킬 1데스 2어시스트입니다.', '피해량 1위입니다. 골드 차이는 5,000골드입니다.']) {
    assert.equal(validateNumericClaims({ ...report(), overview }, evidence).overview, overview);
  }
});
test('a numeric mismatch is regenerated once, and only source-supported output reaches the cache', async (t) => {
  const options = await setup(t);
  let calls = 0;
  const service = createAiSummaryService({ ...options, db: fakeDb([games()[0]], numericPlayers()), getApiKey: () => 'test-only', fetchImpl: async (_, request) => {
    calls++;
    const body = JSON.parse(request.body), evidence = JSON.parse(body.input);
    assert.equal(evidence.teamTotals.find((team) => team.team === 'BETA').kills, 18);
    if (calls === 2) assert.match(body.instructions, /반려/);
    return completion({ ...report(), overview: calls === 1 ? '합계 19킬입니다.' : '합계 18킬입니다.' });
  } });
  const result = await service.getSummary('g1', 'game', { allowGenerate: true });
  assert.equal(calls, 2);
  assert.equal(result.report.overview, '합계 18킬입니다.');
  assert.equal((await service.getSummary('g1', 'game')).report.overview, '합계 18킬입니다.');
});
test('a repeated numeric error stops after one regeneration and never creates a ready cache', async (t) => {
  const options = await setup(t);
  let calls = 0;
  const service = createAiSummaryService({ ...options, db: fakeDb([games()[0]], numericPlayers()), getApiKey: () => 'test-only', fetchImpl: async () => {
    calls++; return completion({ ...report(), overview: '합계 19킬입니다.' });
  } });
  await assert.rejects(service.getSummary('g1', 'game', { allowGenerate: true }), { code: 'AI_FACT_MISMATCH' });
  assert.equal(calls, 2);
  assert.equal((await fs.readdir(options.cacheDir)).length, 0);
  assert.equal((await service.getSummary('g1', 'game')).state, 'not_generated');
});

test('no record, unconfirmed results, and missing key never call OpenAI', async (t) => {
  const options = await setup(t);
  const fetchImpl = () => { assert.fail('No provider call expected'); };
  for (const rows of [[], games().map((game) => ({ ...game, win_team: null }))]) {
    const service = createAiSummaryService({ ...options, db: fakeDb(rows), getApiKey: () => 'test-only', fetchImpl });
    assert.equal((await service.getSummary('g1', 'series', { allowGenerate: true })).state, 'waiting_for_data');
  }
  const service = createAiSummaryService({ ...options, db: fakeDb(games()), getApiKey: () => '', fetchImpl });
  assert.equal((await service.getSummary('g1', 'series', { allowGenerate: true })).state, 'not_configured');
});

test('GET-style reads cannot generate and invalid scope fails before any DB work', async (t) => {
  const options = await setup(t);
  const service = createAiSummaryService({ ...options, db: fakeDb(games()), getApiKey: () => 'test-only', fetchImpl: () => assert.fail('Unexpected generation') });
  assert.equal((await service.getSummary('g1')).state, 'not_generated');
  await assert.rejects(service.getSummary('g1', 'invalid'), { code: 'INVALID_REQUEST', status: 400 });
});

test('generation sends DB facts with strict schema, keeps keys in headers, and persists a shared cache', async (t) => {
  const options = await setup(t);
  let calls = 0;
  const fetchImpl = async (url, request) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(request.headers.Authorization, 'Bearer test-only');
    const body = JSON.parse(request.body);
    assert.equal(body.store, false);
    assert.equal(body.text.format.type, 'json_schema');
    assert.equal(body.text.format.strict, true);
    assert.ok(!request.body.includes('test-only'));
    const evidence = JSON.parse(body.input);
    assert.deepEqual(evidence.recordedScore, [1, 1]);
    assert.equal(evidence.sets.length, 2);
    await new Promise((resolve) => setImmediate(resolve));
    return completion();
  };
  const service = createAiSummaryService({ ...options, db: fakeDb(games()), getApiKey: () => 'test-only', fetchImpl });
  const [first, second] = await Promise.all([
    service.getSummary('g1', 'series', { allowGenerate: true }),
    service.getSummary('g2', 'series', { allowGenerate: true }),
  ]);
  assert.equal(calls, 1);
  assert.equal(first.state, 'ready');
  assert.deepEqual(first, second);
  const restarted = createAiSummaryService({ ...options, db: fakeDb(games()), getApiKey: () => '', fetchImpl: () => assert.fail('Cache must survive restart') });
  assert.deepEqual(await restarted.getSummary('g2'), first);
});

test('a single-set summary uses only that game and refreshed records invalidate earlier summaries', async (t) => {
  const options = await setup(t);
  const rows = games();
  let calls = 0;
  const service = createAiSummaryService({ ...options, db: fakeDb(rows), getApiKey: () => 'test-only', fetchImpl: async (_, request) => {
    calls++;
    const evidence = JSON.parse(JSON.parse(request.body).input);
    assert.equal(evidence.sets.length, 1);
    assert.equal(evidence.sets[0].gameId, 'g1');
    return completion();
  } });
  await service.getSummary('g1', 'game', { allowGenerate: true });
  rows[0].gamelength_number = 32;
  await service.getSummary('g1', 'game', { allowGenerate: true });
  assert.equal(calls, 2);
});

test('missing player stats still allow a result-only report with that limit represented', async (t) => {
  const options = await setup(t);
  const service = createAiSummaryService({ ...options, db: fakeDb(games(), [], true), getApiKey: () => 'test-only', fetchImpl: async (_, request) => {
    const evidence = JSON.parse(JSON.parse(request.body).input);
    assert.equal(evidence.playerStatsAvailable, false);
    assert.deepEqual(evidence.players, []);
    return completion();
  } });
  assert.equal((await service.getSummary('g1', 'series', { allowGenerate: true })).state, 'ready');
});

test('invalid or refused AI output is never presented or cached as a summary', async (t) => {
  const options = await setup(t);
  assert.throws(() => validateReport({ ...report(), teamAssessments: [{ team: 'FAKE', assessment: 'wrong team' }] }, ['ALPHA', 'BETA']), { code: 'AI_INVALID_OUTPUT' });
  for (const body of [
    { status: 'incomplete', output: [] },
    { status: 'completed', output: [{ content: [{ type: 'refusal', refusal: 'No' }] }] },
    { status: 'completed', output: [{ content: [{ type: 'output_text', text: 'not json' }] }] },
  ]) {
    const service = createAiSummaryService({ ...options, db: fakeDb(games()), getApiKey: () => 'test-only', fetchImpl: async () => ({ ok: true, json: async () => body }) });
    await assert.rejects(service.getSummary('g1', 'series', { allowGenerate: true }), { code: 'AI_INVALID_OUTPUT' });
  }
  assert.equal((await fs.readdir(options.cacheDir)).length, 0);
});

test('provider rate limits remain retriable and do not expose provider errors or credentials', async (t) => {
  const options = await setup(t);
  let calls = 0;
  const service = createAiSummaryService({ ...options, db: fakeDb(games()), getApiKey: () => 'test-only', fetchImpl: async () => {
    calls++;
    return calls === 1 ? { ok: false, status: 429 } : completion();
  } });
  await assert.rejects(service.getSummary('g1', 'series', { allowGenerate: true }), { status: 429, code: 'AI_RATE_LIMITED' });
  assert.equal((await service.getSummary('g1', 'series', { allowGenerate: true })).state, 'ready');
});

test('HTTP routes expose the unavailable-key state without fabricating an AI report', async (t) => {
  const options = await setup(t);
  const service = createAiSummaryService({ ...options, db: fakeDb(games()), getApiKey: () => '' });
  const app = express();
  app.use('/api', createAiSummaryRouter(service));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${base}/api/matches/g1/ai-summary?scope=series`);
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.equal(value.state, 'not_configured');
  assert.equal(value.report, undefined);
  const invalid = await fetch(`${base}/api/matches/g1/ai-summary?scope=invalid`, { method: 'POST', headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(invalid.status, 400);
});

function subscriptionStream(events) {
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

test('ChatGPT inference follows the subscription contract and isolates caches by account and model', async (t) => {
  const options = await setup(t);
  let context = { kind: 'chatgpt', token: 'qa-oauth', model: 'account-model', cacheScope: 'chatgpt:account-one' };
  let calls = 0;
  const service = createAiSummaryService({ ...options, db: fakeDb(games()),
    getApiKey: () => assert.fail('Subscription mode must not use an API key'),
    getInferenceContext: async () => context,
    fetchImpl: async (url, request) => {
      calls++;
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(request.headers.Authorization, 'Bearer qa-oauth');
      const body = JSON.parse(request.body);
      assert.equal(body.model, context.model);
      assert.equal(body.store, false);
      assert.equal(body.stream, true);
      assert.ok(Array.isArray(body.input));
      assert.deepEqual(JSON.parse(body.input[0].content).recordedScore, [1, 1]);
      assert.equal(body.max_output_tokens, 2000);
      assert.deepEqual(body.reasoning, { effort: 'low' });
      assert.equal(body.previous_response_id, undefined);
      const response = await completion().json();
      return subscriptionStream([
        { type: 'response.output_item.done', output_index: 0, item: { ...response.output[0], status: 'completed' } },
        { type: 'response.completed', response: { ...response, output: [] } },
      ]);
    },
  });
  const first = await service.getSummary('g1', 'series', { allowGenerate: true });
  assert.equal(first.billing, 'chatgpt_plan');
  assert.deepEqual(await service.getSummary('g2'), first);
  assert.equal(calls, 1);
  context = { ...context, cacheScope: 'chatgpt:account-two' };
  assert.equal((await service.getSummary('g1')).state, 'not_generated');
  await service.getSummary('g1', 'series', { allowGenerate: true });
  context = { ...context, model: 'other-account-model' };
  assert.equal((await service.getSummary('g1')).state, 'not_generated');
  await service.getSummary('g1', 'series', { allowGenerate: true });
  assert.equal(calls, 3);
  context = { state: 'sign_in_required' };
  assert.equal((await service.getSummary('g1', 'series', { allowGenerate: true })).state, 'sign_in_required');
  assert.equal(calls, 3);
});

test('a subscription limit after partial streaming never becomes a completed or cached summary', async (t) => {
  const options = await setup(t);
  const service = createAiSummaryService({ ...options, db: fakeDb(games()),
    getInferenceContext: async () => ({ kind: 'chatgpt', token: 'qa-oauth', model: 'account-model', cacheScope: 'chatgpt:one' }),
    getApiKey: () => assert.fail('No API-key fallback is permitted'),
    fetchImpl: async () => subscriptionStream([
      { type: 'response.output_text.delta', delta: 'incomplete draft' },
      { type: 'response.output_item.done', output_index: 0, item: { type: 'message', status: 'completed', content: [{type:'output_text', text:JSON.stringify(report())}] } },
      { type: 'response.failed', response: { status: 'failed', error: { code: 'subscription_sharing_usage_limit_exceeded' } } },
    ]),
  });
  await assert.rejects(service.getSummary('g1', 'series', { allowGenerate: true }), { code: 'CHATGPT_USAGE_LIMIT', status: 429, state: 'usage_limit' });
  assert.equal((await fs.readdir(options.cacheDir)).length, 0);
});

test('a single fifth-set report retains its source set number separately from collected order',()=>{
  const evidence=buildEvidence([{...games()[0],game_number:5}],[],'game');
  assert.equal(evidence.sets[0].gameNumber,5);
  assert.equal(evidence.sets[0].recordedOrder,1);
});

test('timeline evidence is scoped to the verified set and its gold values reach guarded AI generation',async t=>{
 const options=await setup(t);
 const timeline={state:'ready',gameId:'g1',blue:{team:'BETA'},red:{team:'ALPHA'},coverage:{timeBasis:'feed_elapsed',positions:false,experience:false,steals:false},milestones:[{minute:10,seconds:600,blueGold:21000,redGold:27000,goldDifference:-6000}],events:[{kind:'dragon',team:'ALPHA',seconds:480,count:1,stealConfirmed:false}]};
 const service=createAiSummaryService({...options,db:fakeDb(games(),numericPlayers()),getApiKey:()=> 'test-only',getTimeline:async id=>id==='g1'?timeline:{state:'not_recorded'},fetchImpl:async(_,request)=>{
  const {input,instructions}=JSON.parse(request.body),evidence=JSON.parse(input);
  assert.equal(evidence.timelineAvailable,true);assert.equal(evidence.timelines.length,1);assert.equal(evidence.timelines[0].gameId,'g1');
  assert.equal(evidence.sets.find(g=>g.gameId==='g1').blueTeam,'BETA');assert.equal(evidence.sets.find(g=>g.gameId==='g2').blueTeam,'BETA');
  assert.match(instructions,/스틸·역전이라고 쓰지/);assert.equal(evidence.timelines[0].coverage.positions,false);
  return completion({...report(),overview:'약 10분 ALPHA의 기록은 27000골드입니다.'});
 }});
 const result=await service.getSummary('g1','series',{allowGenerate:true});assert.equal(result.source.timelineSets,1);assert.equal(result.source.timelineAvailable,true);assert.equal(result.source.sets,2);
});
test('a timeline from another game does not enable narrative analysis',()=>{
 const evidence=buildEvidence([games()[0]],[],'game',true,[{state:'ready',gameId:'unrelated',blue:{team:'ALPHA'},red:{team:'BETA'}}]);
 assert.equal(evidence.timelineAvailable,false);assert.equal(evidence.timelines.length,0);
});

test('a Baron claim cannot use an inhibitor timestamp; missing event times and unsupported steals are rejected',()=>{
 const {validateTimelineClaims}=require('./aiSummary');
 const evidence={timelineAvailable:true,timelines:[{events:[{kind:'baron',seconds:2011},{kind:'inhibitor',seconds:1910},{kind:'kills',seconds:236}],milestones:[{seconds:1800}]}]};
 for(const detail of ['약 31분 50초에 바론을 확보했습니다.','약 4분 22초 첫 킬을 기록했습니다.','바론 스틸로 역전했습니다.'])assert.throws(()=>validateTimelineClaims({...report(),keyPoints:[{title:'시점 검증',detail}]},evidence),{code:'AI_FACT_MISMATCH'});
 for(const detail of ['약 33분 31초에 바론을 확보했습니다.','약 31분 50초 억제기를 파괴했습니다.','약 30분 골드 차이를 확인했습니다.'])assert.ok(validateTimelineClaims({...report(),keyPoints:[{title:'시점 검증',detail}]},evidence));
});


test('compact inference evidence retains every event and milestone without mutating validation evidence', () => {
  const evidence = buildEvidence(games(), [], 'series');
  evidence.timelines = [{ gameId: 'g1', coverage: { positions: false, rawFrames: 8000 }, milestones: [{ seconds: 300, blueGold: 10000, redGold: 9000 }], events: Array.from({ length: 44 }, (_, i) => ({ id: 'long-source-id-' + i, timestamp: '2026-10-01T00:00:00Z', fromSeconds: i, seconds: i + 1, kind: 'kill', team: 'ALPHA', pairingConfirmed: false, killers: [{ id: 1, name: 'Player', champion: 'Ahri', role: 'MID', count: 1 }] })) }];
  const before = JSON.stringify(evidence);
  const compact = compactEvidence(evidence);
  assert.equal(JSON.stringify(evidence), before);
  assert.equal(compact.timelines[0].events.length, 44);
  assert.deepEqual(compact.timelines[0].milestones, evidence.timelines[0].milestones);
  assert.equal(compact.timelines[0].events[43].seconds, 44);
  assert.equal(compact.timelines[0].events[0].pairingConfirmed, false);
  assert.equal(compact.timelines[0].coverage.positions, false);
  assert.ok(JSON.stringify(compact).length < before.length);
});
