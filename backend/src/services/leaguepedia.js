const axios = require('axios');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { CookieJar } = require('tough-cookie');

class LeaguepediaError extends Error {
  constructor(code, message, status = 503, retryAt) {
    super(message); Object.assign(this, { code, status, retryAt });
  }
}
const literal = (value) => String(value).replace(/\\/g, '\\\\').replace(/'/g, "''");
async function readJson(file) { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return null; } }
async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(value), { mode: 0o600 });
  await fs.rename(temp, file);
  await fs.chmod(file, 0o600);
}

class LeaguepediaService {
  constructor({ storageDir = path.resolve(__dirname, '../../.local/leaguepedia'), cacheDir = path.resolve(__dirname, '../../.cache/leaguepedia'), transport = (options) => axios(options), now = () => Date.now(), sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), minInterval = 15000, credentials } = {}) {
    Object.assign(this, { storageDir, cacheDir, transport, now, sleep, minInterval, credentials });
    this.apiUrl = 'https://lol.fandom.com/api.php';
    this.jar = new CookieJar();
    this.queue = Promise.resolve();
    this.pending = new Map();
    this.account = null;
    this.loginPromise = null;
  }
  async savedCredentials() {
    if (this.credentials) return this.credentials;
    if (process.env.LEAGUEPEDIA_USERNAME && process.env.LEAGUEPEDIA_BOT_PASSWORD) return { username: process.env.LEAGUEPEDIA_USERNAME, password: process.env.LEAGUEPEDIA_BOT_PASSWORD };
    return readJson(path.join(this.storageDir, 'credentials.json'));
  }
  async status() {
    const credentials = await this.savedCredentials();
    const throttle = await readJson(path.join(this.storageDir, 'throttle.json'));
    return { configured: Boolean(credentials?.username && credentials?.password), connected: Boolean(this.account), username: this.account?.name || null, retryAt: throttle?.blockedUntil > this.now() ? new Date(throttle.blockedUntil).toISOString() : null };
  }
  async request(params, { post = false, timeout = 20000 } = {}) {
    try {
      const headers = { 'User-Agent': 'DolGG/1.0 (https://github.com/asdhgouwq/esports_v1; post-match statistics importer)', Cookie: await this.jar.getCookieString(this.apiUrl) };
      if (post) headers['Content-Type'] = 'application/x-www-form-urlencoded';
      const data = { format: 'json', ...params };
      const response = await this.transport({ url: this.apiUrl, method: post ? 'POST' : 'GET', timeout, maxRedirects: 0, headers, ...(post ? { data: new URLSearchParams(data).toString() } : { params: data }) });
      for (const cookie of response.headers?.['set-cookie'] || []) await this.jar.setCookie(cookie, this.apiUrl);
      const error = response.data?.error;
      if (error?.code === 'ratelimited') throw this.rateLimit(response.headers?.['retry-after']);
      if (error) {
        if (error.code === 'assertuserfailed') this.account = null;
        throw new LeaguepediaError(error.code || 'SOURCE_ERROR', 'Leaguepedia가 조회를 거절했습니다. 계정과 Cargo 권한을 확인해 주세요.');
      }
      if (!response.data || typeof response.data !== 'object') throw new LeaguepediaError('SOURCE_INVALID', 'Leaguepedia 응답을 확인하지 못했습니다.');
      return response.data;
    } catch (error) {
      if (error instanceof LeaguepediaError) throw error;
      if (error.response?.status === 429) throw this.rateLimit(error.response.headers?.['retry-after']);
      // Axios errors contain request credentials; never expose them to callers or logs.
      throw new LeaguepediaError('SOURCE_UNAVAILABLE', 'Leaguepedia에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }
  rateLimit(header) {
    const seconds = Number(header);
    const until = Number.isFinite(seconds) && seconds > 0 ? this.now() + seconds * 1000 : Date.parse(header);
    const retryAt = Math.max(this.now() + 120000, Number.isFinite(until) ? until : 0);
    return new LeaguepediaError('ratelimited', 'Leaguepedia 요청 한도에 도달했습니다. 대기 시간이 지난 후 다시 시도해 주세요.', 429, retryAt);
  }
  async authenticate(credentials) {
    if (!credentials?.username || !credentials?.password) throw new LeaguepediaError('LEAGUEPEDIA_AUTH_REQUIRED', '이메일 인증된 Fandom 계정의 Bot Password를 연결해 주세요.', 401);
    this.account = null;
    this.jar = new CookieJar();
    const tokens = await this.request({ action: 'query', meta: 'tokens', type: 'login' });
    const token = tokens.query?.tokens?.logintoken;
    if (!token) throw new LeaguepediaError('LOGIN_FAILED', '로그인 준비에 실패했습니다.');
    const result = await this.request({ action: 'login', lgname: credentials.username, lgpassword: credentials.password, lgtoken: token }, { post: true });
    if (result.login?.result !== 'Success') throw new LeaguepediaError('LOGIN_FAILED', 'Bot 로그인 이름과 Bot Password를 확인해 주세요. 일반 계정 비밀번호는 사용할 수 없습니다.', 401);
    const info = await this.request({ action: 'query', meta: 'userinfo', uiprop: 'rights|groups' });
    const user = info.query?.userinfo;
    if (!user?.id || Object.hasOwn(user, 'anon')) throw new LeaguepediaError('LOGIN_FAILED', 'Fandom 로그인 세션을 확인하지 못했습니다.', 401);
    if (!user.rights?.includes('runcargoqueries')) throw new LeaguepediaError('CARGO_PERMISSION_REQUIRED', 'Fandom 이메일 인증과 Bot Password의 Cargo 권한을 확인해 주세요.', 403);
    this.account = { name: user.name };
  }
  async ensureLogin() {
    if (this.account) return;
    if (!this.loginPromise) this.loginPromise = this.authenticate(await this.savedCredentials()).finally(() => { this.loginPromise = null; });
    return this.loginPromise;
  }
  exclusive(action) {
    const task = this.queue.then(action);
    this.queue = task.catch(() => {});
    return task;
  }
  async connect({ username, password } = {}) {
    if (typeof username !== 'string' || !username.trim() || username.length > 200 || typeof password !== 'string' || !password || password.length > 500) throw new LeaguepediaError('INVALID_CREDENTIALS', 'Bot 로그인 이름과 Bot Password를 입력해 주세요.', 400);
    return this.exclusive(async () => {
      const credentials = { username: username.trim(), password };
      await this.authenticate(credentials);
      await writeJson(path.join(this.storageDir, 'credentials.json'), credentials);
      this.credentials = credentials;
      return this.status();
    });
  }
  async cargoQuery(params, { timeout = 20000, ttl = 86400000 } = {}) {
    const key = crypto.createHash('sha256').update(JSON.stringify(params)).digest('hex');
    const file = path.join(this.cacheDir, `${key}.json`);
    const cached = await readJson(file);
    if (cached?.expiresAt > this.now() && Array.isArray(cached.rows)) return cached.rows;
    if (this.pending.has(key)) return this.pending.get(key);
    const task = this.exclusive(async () => {
      await this.ensureLogin();
      let throttle = (await readJson(path.join(this.storageDir, 'throttle.json'))) || {};
      if (throttle.blockedUntil > this.now()) throw new LeaguepediaError('ratelimited', 'Leaguepedia 재시도 대기 중입니다.', 429, throttle.blockedUntil);
      if (throttle.nextAt > this.now()) await this.sleep(throttle.nextAt - this.now());
      throttle = { nextAt: this.now() + this.minInterval, blockedUntil: 0 };
      await writeJson(path.join(this.storageDir, 'throttle.json'), throttle);
      try {
        const response = await this.request({ action: 'cargoquery', assert: 'user', ...params }, { timeout });
        if (!Array.isArray(response.cargoquery)) throw new LeaguepediaError('SOURCE_INVALID', '경기 원본 응답 형식이 올바르지 않습니다.');
        const rows = response.cargoquery.map((item) => item.title);
        await writeJson(file, { fetchedAt: new Date(this.now()).toISOString(), expiresAt: this.now() + (rows.length ? ttl : 300000), rows });
        return rows;
      } catch (error) {
        if (error.code === 'ratelimited') await writeJson(path.join(this.storageDir, 'throttle.json'), { ...throttle, blockedUntil: error.retryAt });
        throw error;
      }
    }).finally(() => this.pending.delete(key));
    this.pending.set(key, task);
    return task;
  }
  async getWorldsSnapshot(year = 2026, progress = () => {}) {
    if (!Number.isInteger(year) || year < 2011 || year > 2100) throw new LeaguepediaError('INVALID_YEAR', '대회 연도를 확인해 주세요.', 400);
    const root = `${year} Season World Championship`;
    const collect = async (params) => {
      const rows = [];
      for (let offset = 0; offset < 10000; offset += 500) {
        const page = await this.cargoQuery({ ...params, limit: 500, offset }, { ttl: 900000 });
        rows.push(...page);
        if (page.length < 500) return rows;
      }
      throw new LeaguepediaError('SOURCE_TRUNCATED', '조회 범위를 초과했습니다. 전체 데이터가 확인될 때까지 저장하지 않습니다.');
    };
    progress('월즈 대진과 예정 일정 조회 중');
    const schedules = await collect({ tables: 'MatchSchedule=MS,Tournaments=T', join_on: 'MS.OverviewPage=T.OverviewPage', fields: 'MS.MatchId=MatchId,MS.OverviewPage=OverviewPage,T.Name=Tournament,MS.Team1=Team1,MS.Team2=Team2,MS.Team1Score=Team1Score,MS.Team2Score=Team2Score,MS.Winner=Winner,MS.BestOf=BestOf,MS.DateTime_UTC=DateTime_UTC,MS.HasTime=HasTime,MS.Tab=Stage,MS.IsNullified=IsNullified', where: `MS.OverviewPage LIKE '${literal(root)}%'`, order_by: 'MS.DateTime_UTC,MS.MatchId' });
    progress('종료된 모든 세트 결과 조회 중');
    const games = await collect({ tables: 'ScoreboardGames=SG,Tournaments=T', join_on: 'SG.OverviewPage=T.OverviewPage', fields: 'SG.GameId=GameId,SG.MatchId=MatchId,T.Name=Tournament,SG.DateTime_UTC=DateTime_UTC,SG.N_GameInMatch=GameNumber,SG.Team1=Team1,SG.Team2=Team2,SG.WinTeam=WinTeam,SG.LossTeam=LossTeam,SG.Patch=Patch,SG.Team1Bans__full=Team1Bans,SG.Team2Bans__full=Team2Bans,SG.Team1Picks__full=Team1Picks,SG.Team2Picks__full=Team2Picks,SG.Gamelength_Number=Gamelength_Number', where: `SG.OverviewPage LIKE '${literal(root)}%' AND SG.WinTeam IS NOT NULL`, order_by: 'SG.GameId' });
    progress('월즈 선수별 통계 조회 중');
    const players = await collect({ tables: 'ScoreboardPlayers', fields: 'GameId,Link=Name,Team,Role,Champion,Kills,Deaths,Assists,Gold,CS,DamageToChampions,Items__full=Items,Trinket,PrimaryTree,KeystoneRune=Keystone', where: `OverviewPage LIKE '${literal(root)}%'`, order_by: 'GameId,Link' });
    progress('월즈 밴픽 순서 조회 중');
    const fields = ['GameId', 'Team1', 'Team2', ...[1, 2].flatMap((team) => ['Ban', 'Pick'].flatMap((kind) => Array.from({ length: 5 }, (_, index) => `Team${team}${kind}${index + 1}`)))];
    const drafts = await collect({ tables: 'PicksAndBansS7', fields: fields.join(','), where: `OverviewPage LIKE '${literal(root)}%'`, order_by: 'GameId' });
    return { year, root, source: 'Leaguepedia', fetchedAt: new Date(this.now()).toISOString(), schedules, games, players, drafts };
  }
  async getRecentMatches(tournamentName = 'LCK%', limit = 1) {
    return this.cargoQuery({
      tables: 'ScoreboardGames=SG,Tournaments=T', join_on: 'SG.OverviewPage=T.OverviewPage',
      fields: 'SG.GameId=GameId,SG.MatchId=MatchId,T.Name=Tournament,SG.DateTime_UTC=DateTime_UTC,SG.N_GameInMatch=GameNumber,SG.Team1=Team1,SG.Team2=Team2,SG.WinTeam=WinTeam,SG.LossTeam=LossTeam,SG.Patch=Patch,SG.Team1Bans__full=Team1Bans,SG.Team2Bans__full=Team2Bans,SG.Team1Picks__full=Team1Picks,SG.Team2Picks__full=Team2Picks,SG.Gamelength_Number=Gamelength_Number',
      where: `T.Name LIKE '${literal(tournamentName)}' AND SG.WinTeam IS NOT NULL AND SG.N_GameInMatch = 1`, order_by: 'SG.DateTime_UTC DESC,SG.GameId DESC', limit,
    }, { ttl: 300000 });
  }
  async getPlayerStats(gameId) {
    return this.cargoQuery({ tables: 'ScoreboardPlayers', fields: 'GameId,Link=Name,Team,Role,Champion,Kills,Deaths,Assists,Gold,CS,DamageToChampions,Items__full=Items,Trinket,PrimaryTree,KeystoneRune=Keystone', where: `GameId = '${literal(gameId)}'`, limit: 20 });
  }
  async getDraft(gameId) {
    const fields = ['GameId', 'Team1', 'Team2', ...[1, 2].flatMap((team) => ['Ban', 'Pick'].flatMap((kind) => Array.from({ length: 5 }, (_, index) => `Team${team}${kind}${index + 1}`)))];
    return this.cargoQuery({ tables: 'PicksAndBansS7', fields: fields.join(', '), where: `GameId = '${literal(gameId)}'`, limit: 2 }, { timeout: 12000 });
  }
}

module.exports = new LeaguepediaService();
module.exports.LeaguepediaService = LeaguepediaService;
module.exports.LeaguepediaError = LeaguepediaError;
module.exports.writeJson = writeJson;
