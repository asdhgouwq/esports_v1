const path = require('node:path');
const fs = require('node:fs/promises');
const { LeaguepediaError, writeJson } = require('./leaguepedia');
const { normalizeGame, normalizeBundle } = require('./dataSync');
const { normalizeDraft } = require('./matchDraft');
const number = (v) => v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v);
const text = (v) => typeof v === 'string' && v.trim() ? v.trim() : null;
const utc = (v) => { const s = text(v); if (!s) return null; const d = Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : `${s.replace(' ', 'T')}Z`); return Number.isFinite(d) ? new Date(d).toISOString() : null; };
function normalizeSchedule(row, updatedAt) {
  if (!row.MatchId || !row.OverviewPage || !row.Tournament) throw new LeaguepediaError('SOURCE_INCOMPLETE', '월즈 일정의 식별자가 누락되었습니다.');
  const knownTeam = (v) => /^(TBD|TBA|Unknown|To Be Determined)$/i.test(text(v) || '') ? null : text(v);
  const team1 = knownTeam(row.Team1), team2 = knownTeam(row.Team2);
  const s1 = number(row.Team1Score), s2 = number(row.Team2Score), side = number(row.Winner);
  return { match_id: row.MatchId, overview_page: row.OverviewPage, tournament: row.Tournament,
    stage: text(row.Stage), team1, team2, team1_score: s1, team2_score: s2,
    winner: team1 && team2 && s1 !== null && s2 !== null && ((side === 1 && s1 > s2) || (side === 2 && s2 > s1)) ? (side === 1 ? team1 : team2) : null,
    best_of: number(row.BestOf), datetime_utc: utc(row.DateTime_UTC), has_time: row.HasTime === '1' || row.HasTime === true,
    is_nullified: row.IsNullified === '1' || row.IsNullified === true, source: 'Leaguepedia', updated_at: updatedAt };
}
function prepareSnapshot(snapshot) {
  if (!snapshot.schedules.length) throw new LeaguepediaError('SOURCE_INCOMPLETE', '월즈 일정 원본이 비어 있어 기존 데이터를 유지합니다.');
  const schedules = snapshot.schedules.map(row => normalizeSchedule(row, snapshot.fetchedAt));
  const unique = (rows, field) => { if (new Set(rows.map(r=>r[field])).size !== rows.length) throw new LeaguepediaError('SOURCE_DUPLICATE', '중복된 원본 식별자가 있어 저장을 중단했습니다.'); };
  unique(schedules, 'match_id');
  const playerMap = Map.groupBy(snapshot.players, p=>p.GameId), draftMap = Map.groupBy(snapshot.drafts, d=>d.GameId);
  const matches = [], players = [], drafts = [], pending = [];
  for (const raw of snapshot.games) {
    const match = normalizeGame(raw);
    const rawDrafts = draftMap.get(raw.GameId) || [];
    const draft = rawDrafts.length === 1 && normalizeDraft(rawDrafts[0], match);
    // Scoreboard team order can follow the series, while PicksAndBansS7
    // records the actual blue/red sides for this set.
    if (draft && draft.blue.team !== match.team1) {
      for (const suffix of ['', '_picks', '_bans']) {
        [match[`team1${suffix}`], match[`team2${suffix}`]] = [match[`team2${suffix}`], match[`team1${suffix}`]];
      }
    }
    matches.push(match);
    if (draft && [draft.blue, draft.red].every(s=>s.picks.every(Boolean) && s.bans.every(Boolean))) drafts.push({ game_id: raw.GameId, raw_draft: rawDrafts[0], updated_at: snapshot.fetchedAt });
    else pending.push({ gameId: raw.GameId, kind: 'draft' });
    try { players.push(...normalizeBundle(raw, playerMap.get(raw.GameId) || [], rawDrafts, { requireDraft: false }).stats); }
    catch (error) { if (error.code !== 'SOURCE_INCOMPLETE') throw error; pending.push({ gameId: raw.GameId, kind: 'players' }); }
  }
  unique(matches, 'game_id'); unique(players, 'id');
  return { schedules, matches, players, drafts, pending };
}
function createWorldsSync({ db, source, storageDir = path.resolve(__dirname, '../../.local/worlds-sync'), now = () => Date.now(), serverConfigured = () => Boolean(process.env.SUPABASE_SECRET_KEY), intervalMs = 15 * 60000, enabled = process.env.WORLDS_AUTO_SYNC === 'true', year = 2026, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let running = null, timer, nextRunAt = null, last = null;
  const stateFile = path.join(storageDir, 'status.json');
  const status = () => ({ year, enabled, intervalMinutes: intervalMs / 60000, serverWriteConfigured: serverConfigured(), running: Boolean(running), nextRunAt: nextRunAt ? new Date(nextRunAt).toISOString() : null, last });
  const save = () => writeJson(stateFile, { last });
  const verifyWrite = async (table, rows, id) => {
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const result = await db.from(table).upsert(batch, { onConflict: id }).select(id);
      if (result.error || result.data?.length !== batch.length) throw new LeaguepediaError('DATABASE_WRITE_FAILED', `Supabase ${table} 저장을 확인하지 못했습니다. 원본은 이 Mac에 보관되어 재시도할 수 있습니다.`);
    }
  };
  async function sync() {
    if (!serverConfigured() || !db) throw new LeaguepediaError('SERVER_KEY_REQUIRED', 'Supabase 서버 키 설정이 필요합니다.');
    last = { state: 'running', startedAt: new Date(now()).toISOString(), message: '월즈 데이터 조회 준비 중' };
    await save();
    const snapshot = await source.getWorldsSnapshot(year, message => { last.message = message; });
    await writeJson(path.join(storageDir, `snapshot-${year}.json`), snapshot);
    const bundle = prepareSnapshot(snapshot);
    last.message = 'Supabase 경기·선수·밴픽·일정 저장 중';
    await verifyWrite('matches', bundle.matches, 'game_id');
    await verifyWrite('player_stats', bundle.players, 'id');
    await verifyWrite('game_drafts', bundle.drafts, 'game_id');
    await verifyWrite('match_schedules', bundle.schedules, 'match_id');
    const counts = { schedules: bundle.schedules.length, completedSeries: bundle.schedules.filter(s=>s.winner && !s.is_nullified).length, pendingSeries: bundle.schedules.filter(s=>!s.winner && !s.is_nullified).length, games: bundle.matches.length, players: bundle.players.length, drafts: bundle.drafts.length, pendingDetails: bundle.pending.length };
    last = { ...last, state: 'complete', message: '월즈 데이터를 갱신했습니다.', finishedAt: new Date(now()).toISOString(), sourceFetchedAt: snapshot.fetchedAt, counts, pending: bundle.pending };
    await save();
    return last;
  }
  function schedule(delay = intervalMs) {
    clearTimer(timer); nextRunAt = null;
    if (!enabled) return;
    nextRunAt = now() + delay;
    timer = setTimer(() => startSync(), delay); timer.unref?.();
  }
  function startSync() {
    if (running) return status();
    clearTimer(timer); nextRunAt = null;
    // Set the promise before work begins; manual and timer requests share this job.
    running = Promise.resolve().then(sync).catch(async error => {
      last = { ...last, state: 'failed', message: error instanceof LeaguepediaError ? error.message : '월즈 데이터를 갱신하지 못했습니다.', code: error.code || 'SYNC_FAILED', finishedAt: new Date(now()).toISOString(), retryAt: error.retryAt ? new Date(error.retryAt).toISOString() : null };
      await save();
    }).finally(() => { running = null; schedule(Math.max(intervalMs, Date.parse(last?.retryAt || '') - now() || 0)); });
    return status();
  }
  async function start() {
    try { last = JSON.parse(await fs.readFile(stateFile, 'utf8')).last; if (last?.state === 'running') last = { ...last, state: 'interrupted', message: '서버가 재시작되어 다음 갱신에서 이어갑니다.' }; } catch {}
    if (enabled && serverConfigured()) schedule(1000);
  }
  async function event() {
    const root = `${year} Season World Championship`;
    const fixtures = await db.from('match_schedules').select('*').like('overview_page', `${root}%`).order('datetime_utc', { ascending: true, nullsFirst: false }).limit(500);
    const games = await db.from('matches').select('game_id,match_id,game_number,datetime_utc').like('match_id', `${root}%`).order('game_number', { ascending: true }).limit(1000);
    if (fixtures.error || games.error) throw new LeaguepediaError('DATABASE_READ_FAILED', '월즈 일정과 경기 정보를 불러오지 못했습니다.');
    return { ...status(), source: 'Leaguepedia', schedules: fixtures.data.map(row => ({ ...row, status: row.is_nullified ? 'cancelled' : row.winner ? 'completed' : 'scheduled', games: games.data.filter(g=>g.match_id===row.match_id) })) };
  }
  return { start, startSync, status, event, wait: () => running, stop: () => { enabled = false; clearTimer(timer); nextRunAt = null; } };
}
module.exports = { createWorldsSync, prepareSnapshot, normalizeSchedule };
