const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const { createChatGptAuth } = require('./chatgptAuth');
const { createChatGptRouter } = require('../api/chatgptRoutes');
const { readChatGptResponse } = require('./chatgptStream');

let keys;
async function fixture(t) {
  const jose = await import('jose');
  if (!keys) keys = jose.generateKeyPair('RS256');
  const pair = await keys;
  const publicJwk = { ...(await jose.exportJWK(pair.publicKey)), kid: 'qa-key', alg: 'RS256', use: 'sig' };
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dolgg-auth-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const control = { nonce: '', scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct', tokenCalls: [], claims: {}, clock: Date.now(), revokeOk: true };
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchImpl = async (url, options = {}) => {
    url = String(url);
    if (url.endsWith('/.well-known/openid-configuration')) return json({ issuer: 'https://auth.openai.com', authorization_endpoint: 'https://auth.openai.com/api/accounts/authorize', token_endpoint: 'https://auth.openai.com/api/accounts/oauth/token', jwks_uri: 'https://auth.openai.com/.well-known/jwks.json', revocation_endpoint: 'https://auth.openai.com/oauth/revoke' });
    if (url.endsWith('/.well-known/jwks.json')) return json({ keys: [publicJwk] });
    if (url.endsWith('/oauth/token')) {
      const form = new URLSearchParams(options.body);
      control.tokenCalls.push(form);
      if (control.refreshInvalid && form.get('grant_type') === 'refresh_token') return json({ error: 'invalid_grant' }, 400);
      const idToken = await new jose.SignJWT({ sub: 'qa-subject', email: 'qa@example.invalid', nonce: control.nonce, ...control.claims })
        .setProtectedHeader({ alg: 'RS256', kid: 'qa-key' }).setIssuer('https://auth.openai.com')
        .setAudience(control.audience || form.get('client_id')).setIssuedAt().setExpirationTime('1h').sign(pair.privateKey);
      return json({ id_token: idToken, access_token: `qa-access-${control.tokenCalls.length}`, refresh_token: `qa-refresh-${control.tokenCalls.length}`, token_type: 'Bearer', expires_in: 3600, scope: control.scope });
    }
    if (url.endsWith('/models')) return json({ models: [{ slug: 'hidden', display_name: 'Hidden', visibility: 'hide' }, { slug: 'qa-model-first', display_name: 'QA First', visibility: 'list' }, { slug: 'qa-model-second', display_name: 'QA Second', visibility: 'list' }] });
    if (url.endsWith('/oauth/revoke')) return new Response(null, { status: control.revokeOk ? 200 : 503 });
    assert.fail(`Unexpected endpoint ${url}`);
  };
  const make = (options = {}) => createChatGptAuth({ directory, fetchImpl, now: () => control.clock, ...options });
  const auth = make();
  async function begin(options) {
    const result = await auth.beginSignIn(options);
    const params = new URL(result.authorizationUrl).searchParams;
    control.nonce = params.get('nonce');
    return params;
  }
  async function finish(params, clientId = 'oaiapp_qa_first') {
    return auth.completeSignIn({ state: params.get('state'), code: 'qa-code', client_id: clientId });
  }
  return { auth, control, directory, begin, finish, make };
}

test('fresh registration uses PKCE and stable host ID; validated credentials stay outside status responses', async (t) => {
  const f = await fixture(t);
  const params = await f.begin();
  assert.equal(params.get('client_id'), 'dynamic_agent_client');
  assert.equal(params.get('agent_name_hint'), 'dol.gg');
  assert.equal(params.get('redirect_uri'), 'http://127.0.0.1:3000/auth/callback');
  assert.equal(params.get('code_challenge_method'), 'S256');
  assert.match(params.get('ext_agent_host_id'), /^urn:uuid:/);
  const result = await f.finish(params);
  assert.equal(result.connected, true);
  assert.equal(result.planEnabled, true);
  assert.equal(result.welcomePending, true);
  assert.equal(result.account.selectedModel, 'qa-model-first');
  const form = f.control.tokenCalls[0];
  assert.equal(form.get('client_id'), 'oaiapp_qa_first');
  assert.equal(crypto.createHash('sha256').update(form.get('code_verifier')).digest('base64url'), params.get('code_challenge'));
  assert.ok(!JSON.stringify(result).includes('qa-access-'));
  assert.ok(!JSON.stringify(result).includes('refreshToken'));
  const stat = await fs.stat(path.join(f.directory, 'accounts.json'));
  assert.equal(stat.mode & 0o777, 0o600);
  await f.auth.acknowledgeWelcome();
  assert.equal((await f.auth.status()).welcomePending, false);
  const restarted = f.make();
  assert.equal((await restarted.status()).activeId, result.activeId);
  const returning = new URL((await restarted.beginSignIn()).authorizationUrl).searchParams;
  assert.equal(returning.get('ext_agent_host_id'), params.get('ext_agent_host_id'));
  assert.equal(returning.get('client_id'), 'oaiapp_qa_first');
  assert.equal(returning.get('agent_name_hint'), null);
  assert.ok(returning.get('id_token_hint'));
});

test('bad state, nonce, audience, and replayed callbacks cannot activate an account', async (t) => {
  const f = await fixture(t);
  await assert.rejects(f.auth.completeSignIn({ state: 'untrusted', code: 'qa' }), { code: 'OAUTH_STATE_INVALID' });
  assert.equal(f.control.tokenCalls.length, 0);
  let params = await f.begin();
  f.control.claims = { nonce: 'wrong-nonce' };
  await assert.rejects(f.finish(params), { code: 'ID_TOKEN_INVALID' });
  assert.equal((await f.auth.status()).connected, false);
  f.control.claims = {};
  params = await f.begin();
  f.control.audience = 'wrong-audience';
  await assert.rejects(f.finish(params), { code: 'ID_TOKEN_INVALID' });
  f.control.audience = null;
  params = await f.begin();
  await f.finish(params);
  await assert.rejects(f.finish(params), { code: 'OAUTH_STATE_INVALID' });
});

test('disconnect cancels pending authorization callbacks', async (t) => {
  const f = await fixture(t);
  await f.finish(await f.begin());
  const pending = await f.begin();
  await f.auth.disconnect();
  await assert.rejects(f.finish(pending), { code: 'OAUTH_STATE_INVALID' });
  assert.equal((await f.auth.status()).connected, false);
  assert.equal((await f.auth.status()).signInPending, false);
});

test('denied consent consumes the attempt and identity-only consent cannot enable inference', async (t) => {
  const f = await fixture(t);
  const denied = await f.begin();
  await assert.rejects(f.auth.completeSignIn({ state: denied.get('state'), error: 'access_denied' }), { code: 'OAUTH_DENIED' });
  assert.equal(f.control.tokenCalls.length, 0);
  const params = await f.begin();
  f.control.scope = 'openid profile email';
  const result = await f.finish(params);
  assert.equal(result.connected, true);
  assert.equal(result.planEnabled, false);
  assert.equal((await f.auth.summaryContext()).state, 'plan_permission_required');
});

test('returning identity and client IDs must match; same-email registrations remain separate', async (t) => {
  const f = await fixture(t);
  await f.finish(await f.begin());
  const original = await f.auth.status();
  const params = await f.begin();
  await assert.rejects(f.finish(params, 'oaiapp_wrong'), { code: 'OAUTH_CLIENT_INVALID' });
  assert.equal(f.control.tokenCalls.length, 1);
  const changedIdentity = await f.begin();
  f.control.claims = { sub: 'other-subject' };
  await assert.rejects(f.finish(changedIdentity), { code: 'ACCOUNT_MISMATCH' });
  assert.equal((await f.auth.status()).activeId, original.activeId);
  f.control.claims = {};
  await f.finish(await f.begin({ newAccount: true }), 'oaiapp_qa_second');
  const multiple = await f.auth.status();
  assert.equal(multiple.profiles.length, 2);
  assert.notEqual(multiple.profiles[0].label, multiple.profiles[1].label);
  await f.auth.selectAccount(original.activeId);
  assert.equal((await f.auth.summaryContext()).cacheScope, `chatgpt:${original.activeId}`);
});

test('expired access tokens refresh once across concurrent requests and rotate credentials atomically', async (t) => {
  const f = await fixture(t);
  await f.finish(await f.begin());
  f.control.clock += 3600000;
  const [a, b] = await Promise.all([f.auth.summaryContext(), f.auth.summaryContext()]);
  assert.equal(a.token, 'qa-access-2');
  assert.equal(b.token, a.token);
  assert.equal(f.control.tokenCalls.length, 2);
  const refresh = f.control.tokenCalls[1];
  assert.equal(refresh.get('grant_type'), 'refresh_token');
  assert.equal(refresh.get('client_id'), 'oaiapp_qa_first');
  assert.equal(refresh.get('scope'), null);
  const saved = JSON.parse(await fs.readFile(path.join(f.directory, 'accounts.json'), 'utf8'));
  assert.equal(saved.profiles[0].credentials.refreshToken, 'qa-refresh-2');
});

test('invalid refresh and unconfirmed remote revocation clear local use without losing account registration', async (t) => {
  const f = await fixture(t);
  await f.finish(await f.begin());
  f.control.clock += 3600000;
  f.control.refreshInvalid = true;
  assert.equal((await f.auth.summaryContext()).state, 'sign_in_required');
  assert.equal((await f.auth.status()).connected, false);
  f.control.refreshInvalid = false;
  await f.finish(await f.begin());
  f.control.revokeOk = false;
  const disconnected = await f.auth.disconnect();
  assert.equal(disconnected.connected, false);
  assert.equal(disconnected.revocationConfirmed, false);
  assert.match(disconnected.message, /원격 해제를 확인하지 못했/);
  const saved = JSON.parse(await fs.readFile(path.join(f.directory, 'accounts.json'), 'utf8'));
  assert.equal(saved.profiles[0].credentials, null);
  assert.equal(saved.profiles[0].clientId, 'oaiapp_qa_first');
  assert.equal((await f.begin()).get('id_token_hint'), null);
});

test('only models from the selected account catalog can be selected', async (t) => {
  const f = await fixture(t);
  await f.finish(await f.begin());
  assert.deepEqual((await f.auth.listModels()).map((item) => item.slug), ['qa-model-first', 'qa-model-second']);
  await assert.rejects(f.auth.selectModel('hidden'), { code: 'MODEL_NOT_AVAILABLE' });
  await f.auth.selectModel('qa-model-second');
  assert.equal((await f.auth.summaryContext()).model, 'qa-model-second');
});

test('local auth endpoints reject foreign origins and callbacks with no matching state', async (t) => {
  const f = await fixture(t);
  await f.finish(await f.begin());
  const app = express();
  app.use(express.json());
  app.use(createChatGptRouter(f.auth));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const origin of [undefined, 'https://untrusted.example']) {
    const response = await fetch(`${base}/api/chatgpt/sign-in`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: '{}' });
    assert.equal(response.status, 403);
  }
  const allowed = await fetch(`${base}/api/chatgpt/sign-in`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:5173' }, body: '{}' });
  assert.equal(allowed.status, 200);
  const launch = await allowed.json();
  assert.equal(new URL(launch.authorizationUrl).origin, base);
  assert.ok(!JSON.stringify(launch).includes('id_token_hint'));
  const redirect = await fetch(launch.authorizationUrl, { redirect: 'manual' });
  assert.equal(redirect.status, 302);
  const provider = new URL(redirect.headers.get('location'));
  assert.equal(provider.origin, 'https://auth.openai.com');
  assert.ok(provider.searchParams.get('id_token_hint'));
  assert.equal((await fetch(launch.authorizationUrl, {redirect:'manual'})).status, 400);
  const invalid = await fetch(`${base}/auth/callback?state=wrong&code=wrong`);
  assert.equal(invalid.status, 400);
  assert.equal(invalid.headers.get('cache-control'), 'no-store');
});

test('subscription streams require completion and preserve chunked Unicode; usage-limit failures stay explicit', async () => {
  const encode = new TextEncoder();
  const sse = (events) => {
    const bytes = encode.encode(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''));
    return new Response(new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7)); controller.close(); } }));
  };
  const response = { status: 'completed', output: [{ content: [{ type: 'output_text', text: '한국어 요약' }] }] };
  assert.deepEqual(await readChatGptResponse(sse([{ type: 'response.output_text.delta', delta: '한국어' }, { type: 'response.completed', response }])), response);
  await assert.rejects(readChatGptResponse(sse([{ type: 'response.output_text.delta', delta: 'partial' }])), { code: 'stream_interrupted' });
  await assert.rejects(readChatGptResponse(sse([{ type: 'response.failed', response: { error: { code: 'subscription_sharing_usage_limit_exceeded' } } }])), { code: 'subscription_sharing_usage_limit_exceeded' });
});


test('fixed summary model overrides previous selection and never falls back to another model', async (t) => {
  const f = await fixture(t);
  await f.finish(await f.begin());
  const fixed = f.make({ fixedModel: 'qa-model-second' });
  assert.deepEqual((await fixed.listModels()).map(item => item.slug), ['qa-model-second']);
  assert.equal((await fixed.summaryContext()).model, 'qa-model-second');
  await assert.rejects(fixed.selectModel('qa-model-first'), { code: 'MODEL_NOT_AVAILABLE' });
  await assert.rejects(f.make({ fixedModel: 'missing-model' }).listModels(), { code: 'CHATGPT_NO_MODELS' });
});
