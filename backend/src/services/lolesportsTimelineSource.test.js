const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { collectWindows } = require('./lolesportsTimelineSource');

const sourceGameId = '115660588583171787';
const epoch = Date.parse('2026-10-15T18:16:00Z');
const stamp = seconds => new Date(epoch + seconds * 1000).toISOString();
function window(first, last, finished = false) {
  return { esportsGameId: sourceGameId, frames: Array.from({ length: last - first + 1 }, (_, index) => ({
    gameState: finished && index === last - first ? 'finished' : 'in_game', rfc460Timestamp: stamp(first + index),
  })) };
}
const response = data => ({ ok: true, status: 200, json: async () => data });
async function options(t, overrides = {}) {
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dolgg-feed-'));
  t.after(() => fs.rm(cacheDir, { recursive: true, force: true }));
  return { cacheDir, sourceGameId, startTime: stamp(0), durationSeconds: 50, sleep: async () => {}, ...overrides };
}

test('source advances by actual coverage, stops at the completed frame and reuses its archive', async t => {
  const requests = [];
  const settings = await options(t, { fetchImpl: async (url, settings) => {
    const parsed = new URL(url);
    assert.equal(parsed.hostname, 'feed.lolesports.com');
    assert.equal(settings.headers, undefined);
    requests.push(parsed.searchParams.get('startingTime'));
    return response(requests.length === 1 ? window(0, 39) : requests.length === 2 ? window(40, 50, true) : window(50, 59, true));
  } });
  const first = await collectWindows(settings);
  assert.equal(first.length, 3);
  assert.deepEqual(requests, [stamp(0), stamp(40), stamp(50)]);
  assert.equal((await collectWindows(settings)).length, 3);
  assert.equal(requests.length, 3);
  assert.equal((await fs.readdir(settings.cacheDir)).filter(name => name.endsWith('.tmp')).length, 0);
});

test('untimed first-frame discovery is separate from complete timestamp windows and cached across retries', async t => {
  const requests = [];
  const settings = await options(t, { startTime: undefined, fetchImpl: async url => {
    const startingTime = new URL(url).searchParams.get('startingTime');
    requests.push(startingTime);
    if (!startingTime) return response(window(5, 6));
    return response(startingTime === stamp(0) ? window(5, 9) : startingTime === stamp(10) ? window(10, 19, true) : window(20, 29, true));
  } });
  const data = await collectWindows(settings);
  assert.deepEqual(requests, [null, stamp(0), stamp(10), stamp(20)]);
  assert.equal(data[0].frames.at(-1).rfc460Timestamp, stamp(9));
  await collectWindows(settings);
  assert.equal(requests.length, 4);
});

test('an interrupted import resumes from saved coverage without repeating earlier requests', async t => {
  const controller = new AbortController();
  const settings = await options(t, { signal: controller.signal });
  let calls = 0;
  await assert.rejects(collectWindows({ ...settings, fetchImpl: async () => {
    calls++;
    if (calls === 1) return response(window(0, 9));
    controller.abort();
    throw controller.signal.reason;
  } }), { name: 'AbortError' });
  const requests = [];
  const data = await collectWindows({ ...settings, signal: undefined, fetchImpl: async url => {
    requests.push(new URL(url).searchParams.get('startingTime'));
    return response(requests.length === 1 ? window(10, 19, true) : window(20, 29, true));
  } });
  assert.deepEqual(requests, [stamp(10), stamp(20)]);
  assert.equal(data.length, 3);
});

test('legacy numbered windows are reused without a new origin or timeline request', async t => {
  const settings = await options(t, { startTime: undefined, fetchImpl: async () => assert.fail('archive should satisfy the request') });
  await fs.writeFile(path.join(settings.cacheDir, `${sourceGameId}-000.json`), JSON.stringify(window(4, 9)));
  await fs.writeFile(path.join(settings.cacheDir, `${sourceGameId}-001.json`), JSON.stringify(window(10, 19, true)));
  await fs.writeFile(path.join(settings.cacheDir, `${sourceGameId}-002.json`), JSON.stringify(window(20, 29, true)));
  assert.equal((await collectWindows(settings)).length, 3);
});

test('429 cooldown is respected and long cooldowns return a structured retry time without waiting', async t => {
  const sleeps = [];
  let calls = 0;
  const settings = await options(t, { sleep: async ms => sleeps.push(ms), fetchImpl: async () => {
    calls++;
    return calls === 1 ? { ok: false, status: 429, headers: { get: () => '2' } } : response(calls === 2 ? window(0, 9, true) : window(10, 19, true));
  } });
  await collectWindows(settings);
  assert.equal(calls, 3);
  assert.ok(sleeps.includes(2000));
  const long = await options(t, { now: () => epoch, fetchImpl: async () => ({ ok: false, status: 429, headers: { get: () => '120' } }) });
  await assert.rejects(collectWindows(long), { code: 'SOURCE_RATE_LIMITED', sourceStatus: 429, retryAt: stamp(120) });
});

test('denied or absent public records stop immediately; a not-ready boundary remains retryable', async t => {
  for (const status of [400, 403, 404]) {
    let calls = 0;
    const settings = await options(t, { now: () => epoch, fetchImpl: async () => { calls++; return { ok: false, status }; } });
    await assert.rejects(collectWindows(settings), error => {
      assert.equal(error.code, status === 400 ? 'SOURCE_NOT_READY' : 'SOURCE_UNAVAILABLE');
      assert.equal(error.sourceStatus, status);
      assert.equal(error.retryAt, status === 400 ? stamp(300) : undefined);
      return true;
    });
    assert.equal(calls, 1);
  }
});

test('malformed or non-advancing records never become a completed import', async t => {
  const malformed = await options(t, { fetchImpl: async () => response({ esportsGameId: sourceGameId, frames: [null] }) });
  await assert.rejects(collectWindows(malformed), { code: 'SOURCE_INVALID' });
  const stale = await options(t, { fetchImpl: async () => response(window(0, 9)) });
  await assert.rejects(collectWindows(stale), { code: 'SOURCE_INCOMPLETE' });
});

test('a marked pause advances bounded request buckets and resumes from cached pause responses', async t => {
  const requests = [];
  const paused = window(0, 9);
  paused.frames.at(-1).gameState = 'paused';
  const settings = await options(t, { fetchImpl: async url => {
    const startingTime = new URL(url).searchParams.get('startingTime');
    requests.push(startingTime);
    return response(Date.parse(startingTime) < epoch + 30000 ? paused : startingTime === stamp(30) ? window(30, 39, true) : window(40, 49, true));
  } });
  assert.equal((await collectWindows(settings)).length, 5);
  assert.deepEqual(requests, [0, 10, 20, 30, 40].map(stamp));
  await collectWindows(settings);
  assert.equal(requests.length, 5);
  const bounded = await options(t, { maxPauseSeconds: 20, fetchImpl: async () => response(paused) });
  await assert.rejects(collectWindows(bounded), { code: 'SOURCE_INCOMPLETE' });
});

test('a frozen final archive returns collected completed data for strict final-record validation', async t => {
  const settings = await options(t, { fetchImpl: async () => response(window(0, 9, true)) });
  const data = await collectWindows(settings);
  assert.equal(data.length, 1);
  assert.equal(data[0].frames.at(-1).gameState, 'finished');
});

test('a frame on an exact ten-second boundary does not skip the following bucket or reuse the previous cache entry', async t => {
  const requests = [];
  const settings = await options(t, { fetchImpl: async url => {
    const start = new URL(url).searchParams.get('startingTime');
    requests.push(start);
    if (start === stamp(0)) return response(window(0, 10));
    if (start === stamp(10)) return response(window(10, 16, true));
    return response(window(12, 16, true));
  } });
  const data = await collectWindows(settings);
  assert.equal(data.at(-1).frames.at(-1).gameState, 'finished');
  assert.deepEqual(requests, [0, 10, 20].map(stamp));
  requests.length = 0;
  await collectWindows(settings);
  assert.deepEqual(requests, [stamp(20)]);
});
