const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { LeaguepediaService } = require('./leaguepedia');
const { createLeaguepediaRouter } = require('../api/leaguepediaRoutes');

async function client(t, options = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dol-leaguepedia-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return new LeaguepediaService({ storageDir: path.join(dir, 'private'), cacheDir: path.join(dir, 'cache'), ...options });
}
function transport(cargo, calls = []) {
  return async (request) => {
    calls.push(request);
    if (request.method === 'POST') {
      assert.match(request.headers.Cookie, /session=fixture/);
      assert.equal(new URLSearchParams(request.data).get('lgtoken'), 'fixture-token');
      return { data: { login: { result: 'Success' } } };
    }
    if (request.params.meta === 'tokens') return { headers: { 'set-cookie': ['session=fixture; Path=/; Secure'] }, data: { query: { tokens: { logintoken: 'fixture-token' } } } };
    if (request.params.meta === 'userinfo') return { data: { query: { userinfo: { id: 1, name: 'FixtureUser', rights: ['read', 'runcargoqueries'] } } } };
    return cargo(request);
  };
}
const credentials = { username: 'FixtureUser@dolgg', password: 'test-only-secret' };

test('anonymous imports require official bot authentication without sending Cargo requests', async (t) => {
  const source = await client(t, { transport: () => assert.fail('no network expected') });
  await assert.rejects(source.cargoQuery({ tables: 'ScoreboardGames' }), { code: 'LEAGUEPEDIA_AUTH_REQUIRED' });
});
test('bot login retains session cookies and saves credentials privately without returning secrets', async (t) => {
  const source = await client(t, { transport: transport(() => ({ data: { cargoquery: [] } })) });
  const status = await source.connect(credentials);
  assert.equal(status.connected, true);
  assert.equal(status.username, 'FixtureUser');
  assert.ok(!JSON.stringify(status).includes(credentials.password));
  const file = path.join(source.storageDir, 'credentials.json');
  assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
  assert.equal((await fs.stat(source.storageDir)).mode & 0o777, 0o700);
  assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')), credentials);
});
test('all Cargo consumers share a queue, in-flight requests, and persistent cached results', async (t) => {
  let now = 1000000, queries = 0;
  const sleeps = [];
  const source = await client(t, { credentials, now: () => now, sleep: async (ms) => { sleeps.push(ms); now += ms; }, transport: transport(() => { queries++; return { data: { cargoquery: [{ title: { GameId: 'fixture' } }] } }; }) });
  await Promise.all([source.cargoQuery({ tables: 'A' }), source.cargoQuery({ tables: 'A' }), source.cargoQuery({ tables: 'B' })]);
  assert.equal(queries, 2);
  assert.deepEqual(sleeps, [15000]);
  const restarted = new LeaguepediaService({ storageDir: source.storageDir, cacheDir: source.cacheDir, now: () => now, transport: () => assert.fail('cache must avoid network') });
  assert.deepEqual(await restarted.cargoQuery({ tables: 'A' }), [{ GameId: 'fixture' }]);
});
test('rate limits honor Retry-After and survive server restart without retrying Cargo', async (t) => {
  let queries = 0;
  const source = await client(t, { credentials, now: () => 1000000, transport: transport(() => { queries++; return { headers: { 'retry-after': '600' }, data: { error: { code: 'ratelimited' } } }; }) });
  await assert.rejects(source.cargoQuery({ tables: 'A' }), { code: 'ratelimited', retryAt: 1600000 });
  const restarted = new LeaguepediaService({ storageDir: source.storageDir, cacheDir: source.cacheDir, credentials, now: () => 1000000, transport: transport(() => assert.fail('cooldown must avoid Cargo')) });
  await assert.rejects(restarted.cargoQuery({ tables: 'B' }), { code: 'ratelimited', retryAt: 1600000 });
  assert.equal(queries, 1);
});
test('authentication failures never persist invalid credentials or expose upstream passwords', async (t) => {
  const source = await client(t, { transport: () => { throw Object.assign(new Error('secret in axios config'), { config: credentials }); } });
  await assert.rejects(source.connect(credentials), (error) => error.code === 'SOURCE_UNAVAILABLE' && !error.message.includes('secret'));
  assert.equal((await source.status()).configured, false);
});
test('source uses documented player, list and tournament fields and quotes filter literals', async (t) => {
  const source = await client(t);
  source.cargoQuery = async (params) => params;
  const games = await source.getRecentMatches("LCK' OR '1'='1", 1);
  assert.equal(games.join_on, 'SG.OverviewPage=T.OverviewPage');
  assert.match(games.fields, /Team1Picks__full/);
  assert.match(games.where, /LCK'' OR ''1''=''1/);
  const players = await source.getPlayerStats("league/2024'game");
  assert.match(players.fields, /Items__full=Items/);
  assert.match(players.fields, /Link=Name,Team/);
  assert.ok(!players.fields.includes('Item0'));
  assert.equal(players.where, "GameId = 'league/2024''game'");
});
test('local credential and import endpoints reject foreign origins and originless writes', async (t) => {
  let calls = 0;
  const source = { status: async () => ({ configured: true }), connect: async () => { calls++; return { connected: true }; } };
  const app = express(); app.use(express.json()); app.use('/api', createLeaguepediaRouter(source, { getJob: () => null, startImport: () => ({ state: 'running' }) }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
  const url = `http://127.0.0.1:${server.address().port}/api/leaguepedia/connect`;
  for (const origin of [undefined, 'https://foreign.example']) {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: '{}' });
    assert.equal(response.status, 403);
  }
  assert.equal(calls, 0);
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:5173' }, body: '{}' });
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
});
