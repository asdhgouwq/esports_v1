const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');

class TimelineSourceError extends Error {
  constructor(code, message, { status = 503, sourceStatus, retryAt } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    if (sourceStatus !== undefined) this.sourceStatus = sourceStatus;
    if (retryAt) this.retryAt = retryAt;
  }
}

function windowRange(data, sourceGameId) {
  if (String(data?.esportsGameId) !== sourceGameId || !Array.isArray(data.frames) || !data.frames.length || data.frames.some(frame => !frame || typeof frame !== 'object')) return null;
  let first = Infinity, last = -Infinity, state;
  for (const frame of data.frames) {
    const time = Date.parse(frame.rfc460Timestamp);
    if (!Number.isFinite(time)) return null;
    first = Math.min(first, time);
    if (time >= last) { last = time; state = frame.gameState; }
  }
  return { first, last, state, finished: state === 'finished' };
}

function retryDelay(response, now) {
  const header = response.headers?.get('retry-after');
  if (header && /^\d+(?:\.\d+)?$/.test(header.trim())) return Math.max(1000, Number(header) * 1000);
  const timestamp = Date.parse(header);
  return Number.isFinite(timestamp) ? Math.max(1000, timestamp - now) : 15000;
}

async function cachedWindows(cacheDir, sourceGameId) {
  const records = [];
  const prefix = `${sourceGameId}-`;
  for (const name of await fs.readdir(cacheDir)) {
    if (!name.startsWith(prefix) || !/^\d+\.json$/.test(name.slice(prefix.length))) continue;
    try {
      const data = JSON.parse(await fs.readFile(path.join(cacheDir, name), 'utf8'));
      const range = windowRange(data, sourceGameId);
      if (range) records.push({ data, ...range, suffix: Number(name.slice(prefix.length, -5)) });
    } catch (error) {
      if (!['ENOENT', 'SyntaxError'].includes(error.code || error.name)) throw error;
    }
  }
  const legacyFirst = records.find(record => record.suffix === 0);
  const legacyStart = legacyFirst && Math.floor(legacyFirst.first / 10000) * 10000;
  for (const record of records) {
    record.requested = record.suffix >= 1e12 ? record.suffix : legacyStart === undefined ? null : legacyStart + record.suffix * 10000;
  }
  return records.sort((a, b) => a.first - b.first);
}

async function saveWindow(file, data) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(data), { flag: 'wx', mode: 0o600 });
    await fs.rename(temporary, file);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}

async function collectWindows({
  sourceGameId,
  startTime,
  durationSeconds,
  cacheDir = path.resolve(__dirname, '../../.cache/lolesports'),
  fetchImpl = globalThis.fetch,
  sleep = (milliseconds, { signal } = {}) => delay(milliseconds, undefined, { signal }),
  progress = () => {},
  signal,
  minIntervalMs = 750,
  maxAttempts = 3,
  maxRetryDelayMs = 30000,
  maxPauseSeconds = 900,
  now = Date.now,
}) {
  if (typeof sourceGameId !== 'string' || !/^\d{10,25}$/.test(sourceGameId) || (startTime !== undefined && !Number.isFinite(Date.parse(startTime))) || !(durationSeconds > 0 && durationSeconds <= 7200)) {
    throw new TimelineSourceError('SOURCE_INVALID', 'Invalid timeline request', { status: 400 });
  }
  signal?.throwIfAborted();
  const pause = async milliseconds => {
    signal?.throwIfAborted();
    await sleep(milliseconds, { signal });
    signal?.throwIfAborted();
  };
  await fs.mkdir(cacheDir, { recursive: true });
  const archive = await cachedWindows(cacheDir, sourceGameId);
  const windows = [];
  let requests = 0;
  let cacheHits = 0;
  let finishedWindows = 0;
  let pauseSeekSeconds = 0;
  const attempts = Math.max(1, Math.min(5, maxAttempts));
  const requestWindow = async stamp => {
    const url = new URL(`https://feed.lolesports.com/livestats/v1/window/${sourceGameId}`);
    if (stamp) url.searchParams.set('startingTime', stamp);
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (requests) await pause(Math.max(0, minIntervalMs));
      let response;
      try {
        const timeout = AbortSignal.timeout(25000);
        response = await fetchImpl(url.toString(), { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
        requests++;
      } catch (error) {
        requests++;
        signal?.throwIfAborted();
        if (attempt + 1 < attempts) { await pause(1000 * 2 ** attempt); continue; }
        throw new TimelineSourceError('SOURCE_TIMEOUT', 'Public timeline source could not be reached', { retryAt: new Date(now() + 60000).toISOString() });
      }
      if (response.status === 429 || response.status >= 500) {
        const wait = response.status === 429 ? retryDelay(response, now()) : 1000 * 2 ** attempt;
        const options = { status: response.status === 429 ? 429 : 503, sourceStatus: response.status, retryAt: new Date(now() + wait).toISOString() };
        if (attempt + 1 >= attempts || wait > maxRetryDelayMs) throw new TimelineSourceError(response.status === 429 ? 'SOURCE_RATE_LIMITED' : 'SOURCE_TIMEOUT', `Public timeline source returned ${response.status}`, options);
        await pause(wait);
        continue;
      }
      if (!response.ok) throw new TimelineSourceError(response.status === 400 ? 'SOURCE_NOT_READY' : 'SOURCE_UNAVAILABLE', `Public timeline source returned ${response.status}`, {
        status: 503, sourceStatus: response.status,
        ...(response.status === 400 ? { retryAt: new Date(now() + 300000).toISOString() } : {}),
      });
      let data;
      try { data = await response.json(); } catch { throw new TimelineSourceError('SOURCE_INVALID', 'Unexpected timeline source response'); }
      if (!windowRange(data, sourceGameId)) throw new TimelineSourceError('SOURCE_INVALID', 'Unexpected timeline source response');
      return data;
    }
  };
  if (startTime === undefined) {
    const originFile = path.join(cacheDir, `${sourceGameId}-origin.json`);
    let origin;
    try { origin = JSON.parse(await fs.readFile(originFile, 'utf8')); } catch (error) {
      if (!['ENOENT', 'SyntaxError'].includes(error.code || error.name)) throw error;
    }
    const firstCached = archive.find(record => record.suffix === 0) || archive[0];
    if (!windowRange(origin, sourceGameId) && firstCached) origin = firstCached.data;
    if (!windowRange(origin, sourceGameId)) {
      origin = await requestWindow();
      await saveWindow(originFile, origin);
    }
    startTime = new Date(windowRange(origin, sourceGameId).first).toISOString();
  }
  const start = Math.floor(Date.parse(startTime) / 10000) * 10000;
  const legacyFirst = archive.find(record => record.suffix === 0 && record.first >= start && record.first - start <= 180000);
  let cursor = legacyFirst ? legacyFirst.requested : start;
  const pauseLimit = Math.max(0, Math.min(900, maxPauseSeconds));
  const latest = start + (durationSeconds + 300 + pauseLimit) * 1000;
  const maxWindows = Math.ceil((durationSeconds + 300 + pauseLimit) / 10) + 2;

  while (cursor <= latest && windows.length < maxWindows) {
    signal?.throwIfAborted();
    const cached = archive.find(record => record.requested === cursor)
      || archive.find(record => record.first <= cursor + 9999 && record.last > cursor);
    let data = cached?.data;
    let range = cached;
    if (data) cacheHits++;
    else {
      data = await requestWindow(new Date(cursor).toISOString());
      range = windowRange(data, sourceGameId);
      if (range.last < cursor && range.finished && finishedWindows) return windows;
      if (range.last < cursor && range.state !== 'paused') throw new TimelineSourceError('SOURCE_INCOMPLETE', 'Timeline source stopped advancing', { retryAt: new Date(now() + 300000).toISOString() });
      await saveWindow(path.join(cacheDir, `${sourceGameId}-${cursor}.json`), data);
      archive.push({ data, ...range, requested: cursor });
    }
    windows.push(data);
    const finished = range.finished;
    progress({ windows: windows.length, requests, cached: cacheHits, lastTime: new Date(range.last).toISOString(), finished, paused: range.state === 'paused' });
    if (finished && ++finishedWindows >= 2) return windows;
    if (!finished && finishedWindows) throw new TimelineSourceError('SOURCE_INVALID', 'Timeline source returned an unfinished state after completion');
    let next = Math.ceil(range.last / 10000) * 10000;
    if (next <= cursor && range.state === 'paused') {
      pauseSeekSeconds += 10;
      if (pauseSeekSeconds > pauseLimit) throw new TimelineSourceError('SOURCE_INCOMPLETE', 'Timeline pause exceeded the bounded discovery interval', { retryAt: new Date(now() + 3600000).toISOString() });
      next = cursor + 10000;
    }
    if (next <= cursor) throw new TimelineSourceError('SOURCE_INCOMPLETE', 'Timeline source stopped advancing', { retryAt: new Date(now() + 300000).toISOString() });
    cursor = next;
  }
  throw new TimelineSourceError('SOURCE_INCOMPLETE', 'Timeline did not reach the game end; nothing imported', { retryAt: new Date(now() + 300000).toISOString() });
}

module.exports = { collectWindows, TimelineSourceError };
