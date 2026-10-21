const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const SCHEDULE_URL = 'https://lolesports.com/en-US/leagues/worlds';
const ID = /^\d{10,25}$/;
const MAX_PAGE_BYTES = 8 * 1024 * 1024;
const isId = value => typeof value === 'string' && ID.test(value);

function validYear(year) {
  if (!Number.isInteger(year) || year < 2009 || year > 2100) throw new Error('Invalid Worlds year');
}

function jsonAt(text, start) {
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{' || char === '[') depth++;
    else if ((char === '}' || char === ']') && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  throw new Error('Incomplete official schedule data');
}

function embeddedTexts(html) {
  const texts = [html];
  let flight = '';
  for (const match of html.matchAll(/<script[^>]*>self\.__next_f\.push\(([\s\S]*?)\)<\/script>/g)) {
    try {
      const record = JSON.parse(match[1]);
      if (record[0] === 1 && typeof record[1] === 'string') flight += record[1];
    } catch {}
  }
  if (flight) texts.push(flight);
  return texts;
}

function parseWorldsSchedule(html, year) {
  validYear(year);
  if (typeof html !== 'string' || Buffer.byteLength(html) > MAX_PAGE_BYTES) throw new Error('Official schedule exceeds the size limit');
  const games = new Map(), slots = new Map();
  let foundSchedule = false;
  for (const text of embeddedTexts(html)) {
    for (const match of text.matchAll(/\{\s*"__typename"\s*:\s*"EventMatch"/g)) {
      foundSchedule = true;
      const event = jsonAt(text, match.index);
      if (event.league?.slug !== 'worlds' || event.state !== 'completed' || event.match?.state !== 'completed') continue;
      const start = Date.parse(event.startTime);
      if (!Number.isFinite(start) || new Date(start).getUTCFullYear() !== year) continue;
      if (!isId(event.id) || !Array.isArray(event.matchTeams) || event.matchTeams.length !== 2 || !Array.isArray(event.match.games)) throw new Error('Incomplete official Worlds match');
      const teams = event.matchTeams.map(team => typeof team.name === 'string' ? team.name.trim() : '');
      if (teams.some(team => !team || team.length > 100) || new Set(teams).size !== 2) throw new Error('Incomplete official Worlds teams');
      for (const game of event.match.games) {
        if (game.state !== 'completed') continue;
        if (!isId(game.id) || !Number.isInteger(game.number) || game.number < 1 || game.number > 7) throw new Error('Incomplete official Worlds game');
        const entry = {
          eventId: event.id, gameId: game.id, gameNumber: game.number, teams,
          teamCodes: event.matchTeams.map(team => typeof team.code === 'string' ? team.code.trim() : ''),
          teamIds: event.matchTeams.map(team => isId(team.teamId) ? team.teamId : null),
          seriesStartTime: new Date(start).toISOString(), state: 'completed',
        };
        const previous = games.get(game.id);
        if (previous && (previous.eventId !== entry.eventId || previous.gameNumber !== entry.gameNumber || [...previous.teams].sort().join('\0') !== [...teams].sort().join('\0'))) throw new Error('Conflicting official Worlds game identifiers');
        const slot = `${event.id}:${game.number}`;
        if (slots.has(slot) && slots.get(slot) !== game.id) throw new Error('Conflicting official Worlds game numbers');
        slots.set(slot, game.id);
        games.set(game.id, entry);
        if (games.size > 256) throw new Error('Official Worlds game count exceeds the limit');
      }
    }
  }
  if (!foundSchedule) throw new Error('Official schedule format is unavailable');
  return [...games.values()].sort((a, b) => a.seriesStartTime.localeCompare(b.seriesStartTime) || a.eventId.localeCompare(b.eventId) || a.gameNumber - b.gameNumber);
}

async function boundedText(response) {
  if (Number(response.headers?.get('content-length')) > MAX_PAGE_BYTES) throw new Error('Official schedule exceeds the size limit');
  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text) > MAX_PAGE_BYTES) throw new Error('Official schedule exceeds the size limit');
    return text;
  }
  const reader = response.body.getReader(), chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_PAGE_BYTES) throw new Error('Official schedule exceeds the size limit');
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString('utf8');
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
}

function waitFor(promise, signal) {
  if (!signal) return promise;
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason || new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

function validCache(value, year, now, ttlMs) {
  return value?.version === 1 && value.year === year && value.url === SCHEDULE_URL && Number.isFinite(value.fetchedAt) && now >= value.fetchedAt && now - value.fetchedAt < ttlMs && Array.isArray(value.games) && value.games.length <= 256 && value.games.every(game => isId(game.eventId) && isId(game.gameId) && Number.isInteger(game.gameNumber) && game.gameNumber >= 1 && game.gameNumber <= 7 && game.state === 'completed' && Array.isArray(game.teams) && game.teams.length === 2 && game.teams.every(team => typeof team === 'string' && team.length > 0 && team.length <= 100) && new Date(game.seriesStartTime).getUTCFullYear() === year) && new Set(value.games.map(game => game.gameId)).size === value.games.length;
}

function createLolesportsCatalog({ cacheDir = path.resolve(__dirname, '../../.cache/lolesports/catalog'), fetchImpl = globalThis.fetch, now = Date.now, ttlMs = 15 * 60000, timeoutMs = 20000 } = {}) {
  const memory = new Map(), pending = new Map();
  async function load(year) {
    const file = path.join(cacheDir, `${year}.json`);
    try {
      const cached = JSON.parse(await fs.readFile(file, 'utf8'));
      if (validCache(cached, year, now(), ttlMs)) { memory.set(year, cached); return cached.games; }
    } catch {}
    const response = await fetchImpl(SCHEDULE_URL, { headers: { Accept: 'text/html' }, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      const error = new Error(`Official Worlds schedule returned ${response.status}`);
      error.status = response.status;
      if (response.status === 429) {
        const retry = response.headers?.get('retry-after');
        const seconds = Number(retry), date = Date.parse(retry);
        error.retryAt = Number.isFinite(seconds) && seconds > 0 ? now() + Math.min(seconds * 1000, 86400000) : Number.isFinite(date) && date > now() ? date : now() + ttlMs;
      }
      throw error;
    }
    const games = parseWorldsSchedule(await boundedText(response), year);
    const value = { version: 1, year, url: SCHEDULE_URL, fetchedAt: now(), games };
    memory.set(year, value);
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(temporary, JSON.stringify(value));
      await fs.rename(temporary, file);
    } catch { await fs.rm(temporary, { force: true }).catch(() => {}); }
    return games;
  }
  async function getGames(year, { signal } = {}) {
    validYear(year);
    signal?.throwIfAborted();
    const cached = memory.get(year);
    if (validCache(cached, year, now(), ttlMs)) return structuredClone(cached.games);
    if (!pending.has(year)) pending.set(year, load(year).finally(() => pending.delete(year)));
    return structuredClone(await waitFor(pending.get(year), signal));
  }
  return { getGames };
}

module.exports = { createLolesportsCatalog, parseWorldsSchedule, SCHEDULE_URL };
