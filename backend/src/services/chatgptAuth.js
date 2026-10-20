const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const ISSUER = 'https://auth.openai.com';
const RESOURCE = 'https://api.openai.com/v1';
const PLAN_SCOPE = 'chatgpt.tokens.use.direct';
const SCOPES = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const random = () => crypto.randomBytes(32).toString('base64url');

class ChatGptAuthError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}

function createChatGptAuth({
  directory = path.resolve(__dirname, '../../.local/chatgpt-auth'),
  callbackUrl = 'http://127.0.0.1:3000/auth/callback',
  fetchImpl = globalThis.fetch, verifyIdToken,
  fixedModel = null,
  preferredModel = () => process.env.CHATGPT_MODEL,
  now = () => Date.now(),
} = {}) {
  const callback = new URL(callbackUrl);
  if (callback.protocol !== 'http:' || callback.hostname !== '127.0.0.1' || callback.pathname !== '/auth/callback') throw new Error('A loopback /auth/callback is required');
  let store;
  let initializing;
  let discoveryPromise;
  let jwks;
  let writes = Promise.resolve();
  let loginGeneration = 0;
  const pending = new Map();
  const refreshing = new Map();
  const modelCache = new Map();
  const file = path.join(directory, 'accounts.json');

  async function save() {
    const snapshot = JSON.stringify(store);
    const task = writes.catch(() => {}).then(async () => {
      await fs.mkdir(directory, { recursive: true, mode: 0o700 });
      await fs.chmod(directory, 0o700);
      const temporary = path.join(directory, `${crypto.randomUUID()}.tmp`);
      try {
        await fs.writeFile(temporary, snapshot, { mode: 0o600 });
        await fs.rename(temporary, file);
        await fs.chmod(file, 0o600);
      } finally { await fs.unlink(temporary).catch(() => {}); }
    });
    writes = task;
    await task;
  }

  async function initialize() {
    if (store) return;
    if (!initializing) initializing = (async () => {
      try {
        const saved = JSON.parse(await fs.readFile(file, 'utf8'));
        if (saved.version !== 1 || !saved.hostId?.startsWith('urn:uuid:') || !Array.isArray(saved.profiles)) throw new Error('Invalid local registration');
        store = saved;
        await fs.chmod(directory, 0o700);
        await fs.chmod(file, 0o600);
      } catch (error) {
        if (error.code !== 'ENOENT') throw new ChatGptAuthError('AUTH_STORAGE_FAILED', '저장된 ChatGPT 연결 정보를 확인하지 못했습니다.', 503);
        store = { version: 1, hostId: `urn:uuid:${crypto.randomUUID()}`, activeId: null, profiles: [] };
        await save();
      }
    })().catch((error) => { initializing = null; throw error; });
    await initializing;
  }

  async function jsonRequest(url, options = {}) {
    try {
      const response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(15000) });
      if (!response.ok) {
        let code;
        try { code = (await response.json()).error; } catch { /* Do not expose provider bodies. */ }
        const error = new ChatGptAuthError('CHATGPT_CONNECTION_FAILED', 'ChatGPT 연결을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.', 503);
        error.providerStatus = response.status;
        error.providerCode = typeof code === 'string' ? code : null;
        throw error;
      }
      return await response.json();
    } catch (error) {
      if (error instanceof ChatGptAuthError) throw error;
      throw new ChatGptAuthError('CHATGPT_CONNECTION_FAILED', 'ChatGPT에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.', 503);
    }
  }

  async function discovery() {
    if (!discoveryPromise) discoveryPromise = jsonRequest(`${ISSUER}/.well-known/openid-configuration`).then((data) => {
      if (data.issuer !== ISSUER) throw new Error('Issuer mismatch');
      for (const key of ['authorization_endpoint', 'token_endpoint', 'jwks_uri', 'revocation_endpoint']) {
        if (new URL(data[key]).origin !== ISSUER) throw new Error('Invalid discovery endpoint');
      }
      return data;
    }).catch(() => {
      discoveryPromise = null;
      throw new ChatGptAuthError('AUTH_DISCOVERY_FAILED', 'ChatGPT 로그인 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 503);
    });
    return discoveryPromise;
  }

  async function verify(token, clientId, nonce) {
    const config = await discovery();
    let claims;
    if (verifyIdToken) claims = await verifyIdToken(token, { issuer: config.issuer, audience: clientId, nonce });
    else {
      const jose = await import('jose');
      if (!jwks) jwks = jose.createRemoteJWKSet(new URL(config.jwks_uri), { [jose.customFetch]: fetchImpl });
      const result = await jose.jwtVerify(token, jwks, {
        issuer: config.issuer, audience: clientId, requiredClaims: ['sub', 'exp', 'iat'], clockTolerance: 10,
      });
      claims = result.payload;
    }
    if (!claims.sub || (nonce && claims.nonce !== nonce)) throw new ChatGptAuthError('ID_TOKEN_INVALID', '로그인 계정을 검증하지 못했습니다. 다시 로그인해 주세요.');
    return claims;
  }

  function credentials(token, previous = {}) {
    const scopes = typeof token.scope === 'string' ? token.scope.split(/\s+/).filter(Boolean)
      : Array.isArray(token.scopes) ? token.scopes : previous.scopes || [];
    if (scopes.includes(PLAN_SCOPE) && (typeof token.access_token !== 'string' || !token.access_token || token.token_type?.toLowerCase() !== 'bearer'
      || !Number.isFinite(Number(token.expires_in)) || Number(token.expires_in) <= 0)) {
      throw new ChatGptAuthError('TOKEN_RESPONSE_INVALID', '로그인을 완료하지 못했습니다. 다시 시도해 주세요.');
    }
    return {
      accessToken: token.access_token || null, refreshToken: token.refresh_token || previous.refreshToken || null,
      idToken: token.id_token || previous.idToken || null, scopes,
      expiresAt: now() + (Number(token.expires_in) || 3600) * 1000, savedAt: new Date(now()).toISOString(),
    };
  }

  const active = () => store.profiles.find((item) => item.id === store.activeId);
  function publicProfile(profile) {
    return {
      id: profile.id, label: profile.label, email: profile.email || null,
      connected: Boolean(profile.credentials?.idToken),
      planEnabled: Boolean(profile.credentials?.scopes.includes(PLAN_SCOPE)),
      selectedModel: profile.selectedModel || null,
    };
  }

  async function status() {
    await initialize();
    const profile = active();
    return {
      mode: 'chatgpt', activeId: store.activeId,
      signInPending: [...pending.values()].some((attempt) => attempt.expiresAt > now()),
      profiles: store.profiles.map(publicProfile),
      connected: Boolean(profile?.credentials?.idToken),
      planEnabled: Boolean(profile?.credentials?.scopes.includes(PLAN_SCOPE)),
      welcomePending: Boolean(profile?.welcomePending && profile.credentials?.scopes.includes(PLAN_SCOPE)),
      account: profile ? publicProfile(profile) : null,
    };
  }

  async function beginSignIn({ profileId, newAccount = false } = {}) {
    await initialize();
    const config = await discovery();
    const selected = !newAccount && (profileId ? store.profiles.find((item) => item.id === profileId) : active());
    if (profileId && !selected && !newAccount) throw new ChatGptAuthError('ACCOUNT_NOT_FOUND', '연결할 계정을 다시 선택해 주세요.');
    for (const [key, value] of pending) if (value.expiresAt < now()) pending.delete(key);
    if (pending.size >= 5) throw new ChatGptAuthError('TOO_MANY_SIGN_INS', '열려 있는 로그인을 먼저 완료하거나 잠시 후 다시 시도해 주세요.', 429);
    const state = random(), nonce = random(), verifier = random();
    const attempt = { state, nonce, verifier, generation: loginGeneration, profileId: selected?.id || null, clientId: selected?.clientId || null, expiresAt: now() + 600000 };
    pending.set(state, attempt);
    const url = new URL(config.authorization_endpoint);
    const params = {
      client_id: attempt.clientId || 'dynamic_agent_client', ext_agent_host_id: store.hostId,
      response_type: 'code', redirect_uri: callbackUrl, scope: SCOPES, resource: RESOURCE,
      state, nonce, code_challenge_method: 'S256',
      code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'),
    };
    if (!attempt.clientId) params.agent_name_hint = 'dol.gg';
    else if (selected.credentials?.idToken) params.id_token_hint = selected.credentials.idToken;
    if (selected && !selected.credentials?.scopes.includes(PLAN_SCOPE)) params.prompt = 'consent';
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    // This URL is returned only to the local browser and must never be logged.
    return { authorizationUrl: url.href, expiresIn: 600 };
  }

  async function completeSignIn(params) {
    await initialize();
    const attempt = typeof params.state === 'string' && pending.get(params.state);
    if (!attempt || attempt.expiresAt < now()) throw new ChatGptAuthError('OAUTH_STATE_INVALID', '로그인 요청이 만료되었거나 일치하지 않습니다. 앱에서 다시 시작해 주세요.');
    pending.delete(params.state);
    if (params.error) throw new ChatGptAuthError('OAUTH_DENIED', '로그인 또는 구독 사용 승인이 취소되었습니다.');
    const clientId = params.client_id || attempt.clientId;
    if (typeof clientId !== 'string' || !clientId || clientId === 'dynamic_agent_client'
      || (attempt.clientId && clientId !== attempt.clientId) || typeof params.code !== 'string' || !params.code) {
      throw new ChatGptAuthError('OAUTH_CLIENT_INVALID', '로그인 등록 정보를 확인하지 못했습니다. 앱에서 다시 시작해 주세요.');
    }
    const config = await discovery();
    const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, code: params.code,
      code_verifier: attempt.verifier, redirect_uri: callbackUrl, resource: RESOURCE });
    const token = await jsonRequest(config.token_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
    if (typeof token.id_token !== 'string') throw new ChatGptAuthError('ID_TOKEN_MISSING', '로그인 계정을 검증하지 못했습니다. 다시 시도해 주세요.');
    let claims;
    try { claims = await verify(token.id_token, clientId, attempt.nonce); }
    catch { throw new ChatGptAuthError('ID_TOKEN_INVALID', '로그인 계정을 검증하지 못했습니다. 다시 시도해 주세요.'); }
    if (attempt.generation !== loginGeneration) throw new ChatGptAuthError('OAUTH_STATE_INVALID', '취소된 로그인입니다. 앱에서 다시 시작해 주세요.');
    const previous = attempt.profileId && store.profiles.find((item) => item.id === attempt.profileId);
    if (previous && (previous.subject !== claims.sub || previous.issuer !== config.issuer)) {
      throw new ChatGptAuthError('ACCOUNT_MISMATCH', '선택한 계정과 로그인 계정이 다릅니다. 다른 계정 추가로 다시 시도해 주세요.');
    }
    const id = crypto.createHash('sha256').update(JSON.stringify([config.issuer, clientId, claims.sub])).digest('hex').slice(0, 24);
    const stored = store.profiles.find((item) => item.id === id);
    const creds = credentials(token);
    const profile = {
      id, clientId, issuer: config.issuer, subject: claims.sub, email: typeof claims.email === 'string' ? claims.email : null,
      label: `${typeof claims.email === 'string' ? claims.email : 'ChatGPT 계정'} · ${id.slice(0, 6)}`,
      credentials: creds, selectedModel: stored?.selectedModel || null,
      welcomeAcknowledged: Boolean(stored?.welcomeAcknowledged),
      welcomePending: creds.scopes.includes(PLAN_SCOPE) && !stored?.welcomeAcknowledged,
    };
    store.profiles = store.profiles.filter((item) => item.id !== id).concat(profile);
    store.activeId = id;
    modelCache.delete(id);
    await save();
    if (creds.scopes.includes(PLAN_SCOPE)) await listModels().catch(() => {});
    return status();
  }

  async function accessToken(profile) {
    const creds = profile?.credentials;
    if (!creds?.accessToken) throw new ChatGptAuthError('CHATGPT_SIGN_IN_REQUIRED', 'ChatGPT에 로그인해 구독 사용을 연결해 주세요.', 401);
    if (creds.expiresAt > now() + 60000) return creds.accessToken;
    if (!creds.refreshToken) throw new ChatGptAuthError('CHATGPT_SIGN_IN_REQUIRED', 'ChatGPT 연결이 만료되었습니다. 다시 로그인해 주세요.', 401);
    if (!refreshing.has(profile.id)) {
      const task = (async () => {
        const config = await discovery();
        let token;
        try {
          token = await jsonRequest(config.token_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ grant_type: 'refresh_token', client_id: profile.clientId, refresh_token: creds.refreshToken, resource: RESOURCE }).toString() });
        } catch (error) {
          if (error.providerStatus === 401 || error.providerCode === 'invalid_grant') {
            profile.credentials = null;
            modelCache.delete(profile.id);
            await save();
            throw new ChatGptAuthError('CHATGPT_SIGN_IN_REQUIRED', 'ChatGPT 연결이 만료되었습니다. 다시 로그인해 주세요.', 401);
          }
          throw error;
        }
        if (token.id_token) {
          const identity = await verify(token.id_token, profile.clientId);
          if (identity.sub !== profile.subject) throw new ChatGptAuthError('ACCOUNT_MISMATCH', '연결된 ChatGPT 계정을 다시 확인해 주세요.', 401);
        }
        // A disconnected session must not be restored by an in-flight refresh.
        if (profile.credentials !== creds) throw new ChatGptAuthError('CHATGPT_SIGN_IN_REQUIRED', 'ChatGPT에 다시 로그인해 주세요.', 401);
        profile.credentials = credentials(token, creds);
        await save();
        return profile.credentials.accessToken;
      })().finally(() => refreshing.delete(profile.id));
      refreshing.set(profile.id, task);
    }
    return refreshing.get(profile.id);
  }

  async function listModels({ force = false, profile: selected } = {}) {
    await initialize();
    const profile = selected || active();
    if (!profile?.credentials?.scopes.includes(PLAN_SCOPE)) throw new ChatGptAuthError('CHATGPT_PLAN_PERMISSION_REQUIRED', 'ChatGPT 구독 사용 권한을 연결해 주세요.', 403);
    const token = await accessToken(profile);
    const cached = modelCache.get(profile.id);
    if (!force && cached?.expiresAt > now()) return cached.models;
    const data = await jsonRequest(`${RESOURCE}/models`, { headers: { Authorization: `Bearer ${token}` } });
    const models = (Array.isArray(data.models) ? data.models : []).filter((item) => item.visibility === 'list' && typeof item.slug === 'string' && (!fixedModel || item.slug === fixedModel))
      .map((item) => ({ slug: item.slug, displayName: typeof item.display_name === 'string' ? item.display_name : item.slug }));
    if (!models.length) throw new ChatGptAuthError('CHATGPT_NO_MODELS', '사용 가능한 구독 모델을 확인하지 못했습니다.', 503);
    modelCache.set(profile.id, { models, expiresAt: now() + 60000 });
    if (!models.some((item) => item.slug === profile.selectedModel)) {
      profile.selectedModel = models.find((item) => item.slug === preferredModel())?.slug || models[0].slug;
      await save();
    }
    return models;
  }

  async function selectModel(slug) {
    await initialize();
    const profile = active();
    const models = await listModels({ profile });
    if (profile !== active()) throw new ChatGptAuthError('ACCOUNT_CHANGED', '선택된 계정이 변경되었습니다. 모델을 다시 선택해 주세요.', 409);
    if (!models.some((item) => item.slug === slug)) throw new ChatGptAuthError('MODEL_NOT_AVAILABLE', '계정에서 사용할 수 있는 모델을 선택해 주세요.');
    profile.selectedModel = slug;
    await save();
    return status();
  }

  async function selectAccount(id) {
    await initialize();
    if (!store.profiles.some((item) => item.id === id)) throw new ChatGptAuthError('ACCOUNT_NOT_FOUND', '연결할 계정을 다시 선택해 주세요.');
    store.activeId = id;
    await save();
    return status();
  }

  async function acknowledgeWelcome() {
    await initialize();
    const profile = active();
    if (profile) { profile.welcomeAcknowledged = true; profile.welcomePending = false; await save(); }
    return status();
  }

  async function disconnect() {
    await initialize();
    loginGeneration++;
    pending.clear();
    const profile = active();
    if (!profile) return { ...(await status()), revocationConfirmed: true };
    const running = refreshing.get(profile.id);
    if (running) await running.catch(() => {});
    const token = profile.credentials?.refreshToken;
    // Stop local use before waiting for remote revocation.
    profile.credentials = null;
    profile.welcomePending = false;
    modelCache.delete(profile.id);
    await save();
    let confirmed = !token;
    if (token) {
      for (let attempt = 0; attempt < 2 && !confirmed; attempt++) {
        try {
          const config = await discovery();
          const response = await fetchImpl(config.revocation_endpoint, { method: 'POST', signal: AbortSignal.timeout(10000),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ token, token_type_hint: 'refresh_token', client_id: profile.clientId }).toString() });
          confirmed = response.status === 200;
          if (!confirmed && response.status < 500) break;
        } catch { /* The local connection remains cleared. */ }
        if (!confirmed && attempt === 0) await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    return { ...(await status()), revocationConfirmed: confirmed,
      message: confirmed ? 'ChatGPT 연결을 해제했습니다.' : '이 기기에서는 연결을 해제했습니다. 원격 해제를 확인하지 못했으니 ChatGPT 설정에서 dol.gg 연결도 확인해 주세요.' };
  }

  async function summaryContext() {
    await initialize();
    const profile = active();
    if (!profile?.credentials) return { state: 'sign_in_required', message: 'ChatGPT에 로그인해 구독 사용을 연결해 주세요.' };
    if (!profile.credentials.scopes.includes(PLAN_SCOPE)) return { state: 'plan_permission_required', message: 'ChatGPT 구독 사용 권한을 승인해 주세요.' };
    try {
      await listModels({ profile });
      const token = await accessToken(profile);
      return { kind: 'chatgpt', token, model: profile.selectedModel, cacheScope: `chatgpt:${profile.id}` };
    } catch (error) {
      if (error.code === 'CHATGPT_SIGN_IN_REQUIRED') return { state: 'sign_in_required', message: error.message };
      throw error;
    }
  }

  return { status, beginSignIn, completeSignIn, listModels, selectModel, selectAccount, acknowledgeWelcome, disconnect, summaryContext };
}

module.exports = { createChatGptAuth, ChatGptAuthError };
