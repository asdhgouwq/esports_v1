const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createLolesportsCatalog, parseWorldsSchedule, SCHEDULE_URL } = require('./lolesportsCatalog');

function event(overrides = {}) {
  return {
    __typename: 'EventMatch', id: '115660588583171786', startTime: '2026-10-15T18:00:00Z', state: 'completed',
    league: { slug: 'worlds' },
    matchTeams: [{ name: 'Karmine Corp', code: 'KC', teamId: '111692118851466302' }, { name: 'Cloud9 Kia', code: 'C9', teamId: '98767991877340524' }],
    match: { state: 'completed', games: [{ id: '115660588583171787', number: 1, state: 'completed' }, { id: '116299649500204436', number: 4, state: 'completed' }, { id: '115660588583171790', number: 6, state: 'unneeded' }] },
    ...overrides,
  };
}

const page = (...events) => `<html><script>(window.someTransport ??= []).push({"data":undefined,"events":${JSON.stringify(events)}})</script></html>`;
const response = html => ({ ok: true, status: 200, headers: new Headers(), text: async () => html });
async function temporary(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dol-catalog-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}

test('official schedule supplies exact nonsequential game IDs and filters other years, leagues and unfinished games', () => {
  const games = parseWorldsSchedule(page(event(), event(), event({ startTime: '2025-10-15T18:00:00Z' }), event({ league: { slug: 'msi' } }), event({ state: 'inProgress' })), 2026);
  assert.deepEqual(games.map(game => [game.gameId, game.gameNumber]), [['115660588583171787', 1], ['116299649500204436', 4]]);
  assert.deepEqual(games[0].teams, ['Karmine Corp', 'Cloud9 Kia']);
  assert.deepEqual(games[0].teamCodes, ['KC', 'C9']);
  assert.equal(games[0].seriesStartTime, '2026-10-15T18:00:00.000Z');
  assert.equal(games[0].startTime, undefined);
});

test('SSR flight data is decoded as JSON without evaluating page JavaScript', () => {
  const html = `<script>throw Error('must not execute')</script><script>self.__next_f.push(${JSON.stringify([1, '1:' + JSON.stringify({ events: [event()] })])})</script>`;
  assert.equal(parseWorldsSchedule(html, 2026).length, 2);
  assert.throws(() => parseWorldsSchedule('<html>maintenance</html>', 2026), /format/);
  assert.throws(() => parseWorldsSchedule(page(event({ matchTeams: [{ name: 'KC' }] })), 2026), /Incomplete/);
  assert.throws(() => parseWorldsSchedule(page(event()), 2026.5), /year/);
});

test('conflicting official game or game-number mappings are rejected', () => {
  assert.throws(() => parseWorldsSchedule(page(event(), event({ id: '115660588583171799' })), 2026), /Conflicting/);
  const changed = event();
  changed.match.games = [{ id: '115660588583171788', number: 1, state: 'completed' }];
  assert.throws(() => parseWorldsSchedule(page(event(), changed), 2026), /Conflicting/);
  changed.match.games[0].id = Number('115660588583171788');
  assert.throws(() => parseWorldsSchedule(page(changed), 2026), /Incomplete/);
});

test('one public schedule request is shared, cloned for callers and cached across restarts until expiry', async t => {
  const cacheDir = await temporary(t);
  let calls = 0, clock = 100000;
  const options = { cacheDir, now: () => clock, ttlMs: 60000, fetchImpl: async (url, init) => {
    calls++;
    assert.equal(url, SCHEDULE_URL);
    assert.equal(init.headers.Authorization, undefined);
    assert.ok(init.signal instanceof AbortSignal);
    return response(page(event()));
  } };
  const source = createLolesportsCatalog(options);
  const [a, b] = await Promise.all([source.getGames(2026), source.getGames(2026)]);
  a[0].teams[0] = 'changed';
  assert.equal(b[0].teams[0], 'Karmine Corp');
  await source.getGames(2026);
  await createLolesportsCatalog(options).getGames(2026);
  assert.equal(calls, 1);
  clock += 60001;
  await source.getGames(2026);
  assert.equal(calls, 2);
});

test('a cancelled caller does not cancel another caller sharing the official request', async t => {
  const cacheDir = await temporary(t);
  let finish;
  const source = createLolesportsCatalog({ cacheDir, fetchImpl: () => new Promise(resolve => { finish = () => resolve(response(page(event()))); }) });
  const controller = new AbortController();
  const cancelled = source.getGames(2026, { signal: controller.signal });
  const kept = source.getGames(2026);
  const rejected = assert.rejects(cancelled, error => error.name === 'AbortError');
  controller.abort();
  await rejected;
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  finish();
  assert.equal((await kept).length, 2);
});

test('rate-limited and malformed public responses are not cached as successful catalogues', async t => {
  const cacheDir = await temporary(t);
  let calls = 0;
  const source = createLolesportsCatalog({ cacheDir, now: () => 100000, fetchImpl: async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 429, headers: new Headers({ 'Retry-After': '60' }) };
    if (calls === 2) return response('<html>maintenance</html>');
    return response(page(event()));
  } });
  await assert.rejects(source.getGames(2026), error => error.status === 429 && error.retryAt === 160000);
  await assert.rejects(source.getGames(2026), /format/);
  assert.equal((await source.getGames(2026)).length, 2);
  assert.equal(calls, 3);
});

test('unsafe or duplicate persisted catalogue entries are replaced with validated source data', async t => {
  const cacheDir = await temporary(t);
  const games = parseWorldsSchedule(page(event()), 2026);
  await fs.writeFile(path.join(cacheDir, '2026.json'), JSON.stringify({ version: 1, year: 2026, url: SCHEDULE_URL, fetchedAt: 100000, games: [games[0], games[0]] }));
  let calls = 0;
  const source = createLolesportsCatalog({ cacheDir, now: () => 100001, fetchImpl: async () => { calls++; return response(page(event())); } });
  assert.equal((await source.getGames(2026)).length, 2);
  assert.equal(calls, 1);
});
