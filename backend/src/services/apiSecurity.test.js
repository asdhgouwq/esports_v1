const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const { localRequestGuard, localFrontendOrigins, requestErrorHandler } = require('../middleware/localRequest');
const { createApiRouter } = require('../api/routes');
const { createAiSummaryRouter } = require('../api/aiSummaryRoutes');

async function serve(t, router) {
  const app = express();
  app.use(localRequestGuard());
  app.use(express.json({ limit: '16kb' }));
  app.use('/api', router);
  app.get('/auth/callback', (_req, res) => res.sendStatus(204));
  app.use(requestErrorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}`;
}

test('foreign origins, rebinding hosts and cross-site reads cannot reach local services', async t => {
  let calls = 0;
  const router = express.Router();
  router.all('/probe', (_req, res) => { calls++; res.json({ ok: true }); });
  const base = await serve(t, router);
  for (const headers of [
    { Origin: 'https://attacker.example' },
    { 'Sec-Fetch-Site': 'cross-site' },
    { Origin: 'null' },
  ]) assert.equal((await fetch(`${base}/api/probe`, { headers })).status, 403, JSON.stringify(headers));
  const rebinding = await new Promise((resolve, reject) => {
    http.get(`${base}/api/probe`, { headers: { Host: 'attacker.example' } }, response => {
      response.resume(); resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(rebinding, 403);
  assert.equal(calls, 0);
  const allowed = await fetch(`${base}/api/probe`, { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('cache-control'), 'no-store');
  assert.equal(allowed.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await fetch(`${base}/auth/callback`, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 204);
});

test('AI generation requires a local origin and JSON, and reads cannot generate', async t => {
  const options = [];
  const base = await serve(t, createAiSummaryRouter({ async getSummary(_game, _scope, option) {
    options.push(option); return { state: 'not_generated' };
  } }));
  const endpoint = `${base}/api/matches/g1/ai-summary`;
  for (const headers of [
    {}, { 'Content-Type': 'application/json' },
    { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'text/plain' },
    { Origin: 'https://attacker.example', 'Content-Type': 'application/json' },
  ]) assert.equal((await fetch(endpoint, { method: 'POST', headers, body: '{}' })).status, 403);
  assert.equal(options.length, 0);
  assert.equal((await fetch(endpoint)).status, 200);
  assert.equal((await fetch(endpoint, { method: 'POST', headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' }, body: '{}' })).status, 200);
  assert.deepEqual(options, [{ allowGenerate: false }, { allowGenerate: true }]);
});

test('malformed and oversized JSON is rejected without exposing the request body', async t => {
  const router = express.Router();
  router.post('/probe', () => assert.fail('Invalid body must not reach the handler'));
  const base = await serve(t, router);
  const headers = { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' };
  for (const [body, status] of [['{"password":"private-marker",', 400], [JSON.stringify({ password: 'private-marker' + 'x'.repeat(17000) }), 413]]) {
    const response = await fetch(`${base}/api/probe`, { method: 'POST', headers, body });
    assert.equal(response.status, status);
    assert.doesNotMatch(await response.text(), /private-marker|SyntaxError|stack/);
  }
  assert.deepEqual(localFrontendOrigins('http://localhost'), ['http://localhost', 'http://127.0.0.1']);
  assert.deepEqual(localFrontendOrigins('http://localhost:6000'), ['http://localhost:6000', 'http://127.0.0.1:6000']);
  assert.throws(() => localFrontendOrigins('https://external.example'));
});

function database(rows = [], error = null) {
  const db = { calls: 0, from() {
    db.calls++;
    return {
      select() { return this; }, order() { return this; }, limit() { return this; }, eq() { return this; },
      then(resolve, reject) { return Promise.resolve({ data: rows, error }).then(resolve, reject); },
    };
  } };
  return db;
}

test('invalid query values and game IDs fail before a database request', async t => {
  const db = database();
  const base = await serve(t, createApiRouter({ db }));
  for (const query of ['limit=0', 'limit=-1', 'limit=201', 'limit=NaN', 'limit=1&limit=2', 'tournament=', 'tournament=A&tournament=B', 'expand_series=yes']) {
    assert.equal((await fetch(`${base}/api/matches?${query}`)).status, 400, query);
  }
  assert.equal((await fetch(`${base}/api/matches/${'g'.repeat(301)}/stats`)).status, 400);
  assert.equal(db.calls, 0);
  assert.equal((await fetch(`${base}/api/standings?tournament=`)).status, 400);
  assert.equal(db.calls, 0);
  assert.equal((await fetch(`${base}/api/matches?limit=200`)).status, 200);
});

test('database errors expose no internal details and team names cannot mutate object prototypes', async t => {
  const db = database([], { message: 'secret-password internal_schema', code: 'TEST_DB_ERROR' });
  const base = await serve(t, createApiRouter({ db }));
  const failed = await fetch(`${base}/api/matches`);
  assert.equal(failed.status, 500);
  assert.doesNotMatch(await failed.text(), /secret-password|internal_schema|TEST_DB_ERROR/);
  const teams = database([{ team1: '__proto__', team2: 'constructor', win_team: '__proto__', loss_team: 'constructor' }]);
  const standingsBase = await serve(t, createApiRouter({ db: teams }));
  const { data } = await (await fetch(`${standingsBase}/api/standings`)).json();
  assert.deepEqual(data, [{ team: '__proto__', wins: 1, losses: 0 }, { team: 'constructor', wins: 0, losses: 1 }]);
  assert.equal(Object.prototype.wins, undefined);
});
