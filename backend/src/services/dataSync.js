const path = require('node:path');
const crypto = require('node:crypto');
const leaguepedia = require('./leaguepedia');
const supabase = require('../config/supabase');
const { LeaguepediaError, writeJson } = require('./leaguepedia');
const { normalizeDraft } = require('./matchDraft');
const { champions, championKey } = require('./playerTeams');

const fail = (message) => { throw new LeaguepediaError('SOURCE_INCOMPLETE', message, 422); };
const numeric = (value) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const roles = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];
function normalizeGame(game) {
  if (!game?.GameId || !game.MatchId || !game.Tournament || !game.Team1 || !game.Team2 || game.Team1 === game.Team2 || ![game.Team1, game.Team2].includes(game.WinTeam) || !Number.isInteger(numeric(game.GameNumber)) || numeric(game.GameNumber) < 1 || numeric(game.GameNumber) > 7) fail('종료된 경기의 세트 번호·대진과 승리 팀을 확인하지 못했습니다.');
  const date = String(game.DateTime_UTC || '').trim().replace(' ', 'T');
  const timestamp = Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(date) ? date : `${date}Z`);
  if (!Number.isFinite(timestamp)) fail('경기 날짜나 종료 시간을 확인하지 못했습니다.');
  const match = {
    game_id: game.GameId, match_id: game.MatchId, tournament: game.Tournament, game_number: numeric(game.GameNumber),
    datetime_utc: new Date(timestamp).toISOString(), team1: game.Team1, team2: game.Team2,
    win_team: game.WinTeam, loss_team: game.WinTeam === game.Team1 ? game.Team2 : game.Team1,
    patch: game.Patch || null, gamelength_number: numeric(game.Gamelength_Number) > 0 ? numeric(game.Gamelength_Number) : null,
    team1_bans: game.Team1Bans || null, team2_bans: game.Team2Bans || null,
    team1_picks: game.Team1Picks || null, team2_picks: game.Team2Picks || null,
  };
  return match;
}
function normalizeBundle(game, players, drafts, { requireDraft = true } = {}) {
  const match = normalizeGame(game);
  if (!match.gamelength_number) fail('경기 시간을 확인하지 못했습니다.');
  const allPicks = [...champions(match.team1_picks), ...champions(match.team2_picks)];
  if (allPicks.length !== 10 || new Set(allPicks).size !== 10 || players.length !== 10) fail('양 팀의 챔피언 10개와 선수 10명 기록이 모두 있어야 가져올 수 있습니다.');
  const names = new Set();
  for (const team of [match.team1, match.team2]) {
    const teamPlayers = players.filter((player) => player.Team === team);
    if (teamPlayers.length !== 5 || new Set(teamPlayers.map((player) => player.Role)).size !== 5) fail('팀별 선수 5명과 포지션을 확인하지 못했습니다.');
    const picks = champions(match.team1 === team ? match.team1_picks : match.team2_picks);
    for (const player of teamPlayers) {
      if (player.GameId !== match.game_id || !player.Name || names.has(player.Name) || !roles.includes(player.Role) || !picks.includes(championKey(player.Champion))) fail('선수 기록의 경기·팀·챔피언이 원본과 일치하지 않습니다.');
      for (const field of ['Kills', 'Deaths', 'Assists', 'CS', 'Gold']) if (!Number.isInteger(numeric(player[field])) || numeric(player[field]) < 0) fail('선수의 기본 통계가 누락되어 있습니다.');
      names.add(player.Name);
    }
    if (new Set(teamPlayers.map((player) => championKey(player.Champion))).size !== 5) fail('선수의 챔피언 기록이 중복됩니다.');
  }
  const draft = drafts.length === 1 ? normalizeDraft(drafts[0], match) : null;
  if (requireDraft && (!draft || ![draft.blue, draft.red].every((side) => side.picks.every(Boolean) && side.bans.every(Boolean)))) fail('선택 순서와 밴 10개가 모두 확인되는 경기만 가져올 수 있습니다.');
  const stats = players.map((player) => {
    const items = String(player.Items || '').split(';');
    // Leaguepedia may return item names. Only numeric IDs are valid DDragon IDs.
    const itemId = (value) => /^\d+$/.test(String(value || '').trim()) ? String(value).trim() : null;
    return {
      id: `${player.GameId}_${player.Name}`, game_id: player.GameId, name: player.Name, team: player.Team,
      role: player.Role, champion: player.Champion, kills: numeric(player.Kills), deaths: numeric(player.Deaths), assists: numeric(player.Assists),
      gold: numeric(player.Gold), cs: numeric(player.CS), damage_to_champions: numeric(player.DamageToChampions),
      ...Object.fromEntries(Array.from({ length: 6 }, (_, index) => [`item${index}`, itemId(items[index])])),
      trinket: itemId(player.Trinket), primary_tree: player.PrimaryTree || null, keystone: player.Keystone || null,
    };
  });
  return { match, stats, draft };
}

function createDataSyncService({ db = supabase, source = leaguepedia, storageDir = path.resolve(__dirname, '../../.local/leaguepedia/imports') } = {}) {
  let active = null;
  let lastJob = null;
  let teamColumn;
  const databaseError = (error, stage) => new LeaguepediaError('DATABASE_WRITE_FAILED', `Supabase ${stage} 저장에 실패했습니다${error?.code === '42501' ? '. 서버의 쓰기 권한을 확인해 주세요.' : '.'} 원본은 이 기기에 보관되어 다시 가져올 수 있습니다.`, 503);
  async function storedBundleMatches(bundle) {
    const gameRead = await db.from('matches').select('*').eq('game_id', bundle.match.game_id).maybeSingle();
    const statsRead = await db.from('player_stats').select('*').eq('game_id', bundle.match.game_id);
    if (gameRead.error || statsRead.error || !gameRead.data || statsRead.data?.length !== 10) return false;
    const same = (value, expected) => expected === null ? value === null : typeof expected === 'number' ? value !== null && Number(value) === expected : value === expected;
    return Object.entries(bundle.match).every(([field, expected]) => field === 'datetime_utc' ? Date.parse(gameRead.data[field]) === Date.parse(expected) : same(gameRead.data[field], expected))
      && bundle.stats.every(({ team, ...player }) => statsRead.data.some((saved) => Object.entries(player).every(([field, expected]) => same(saved[field], expected)) && (!saved.team || saved.team === team)));
  }
  async function syncMatches(tournament = 'LCK%', limit = 1, progress = () => {}) {
    if (!db) throw new LeaguepediaError('DATABASE_UNAVAILABLE', 'Supabase 연결이 필요합니다.');
    if (typeof tournament !== 'string' || !tournament.trim() || tournament.length > 160 || Number(limit) !== 1) throw new LeaguepediaError('INVALID_IMPORT', '대회 이름을 입력하고 경기 한 개를 선택해 주세요.', 400);
    progress('종료된 경기 찾는 중');
    const games = await source.getRecentMatches(tournament.trim(), 1);
    if (!games.length) throw new LeaguepediaError('MATCH_NOT_FOUND', '해당 대회의 종료된 경기를 찾지 못했습니다.', 404);
    const game = games[0];
    progress('선수 10명 기록 확인 중');
    const players = await source.getPlayerStats(game.GameId);
    progress('실제 밴픽 선택 순서 확인 중');
    const drafts = await source.getDraft(game.GameId);
    const bundle = normalizeBundle(game, players, drafts);
    const file = path.join(storageDir, `${crypto.createHash('sha256').update(game.GameId).digest('hex')}.json`);
    await writeJson(file, { source: 'Leaguepedia', fetchedAt: new Date().toISOString(), raw: { game, players, drafts }, ...bundle });
    const result = { success: true, synced: 1, players: 10, draft: 'verified', gameId: game.GameId, tournament: bundle.match.tournament, team1: bundle.match.team1, team2: bundle.match.team2, winner: bundle.match.win_team, date: bundle.match.datetime_utc, source: 'Leaguepedia' };
    // A completed manual SQL import can be verified without granting API writes.
    // Only a full source match counts as already stored; partial rows are retried.
    if (await storedBundleMatches(bundle)) return { ...result, synced: 0, alreadyStored: true };
    progress('Supabase에 저장 중');
    if (teamColumn === undefined) {
      const probe = await db.from('player_stats').select('team').limit(0);
      if (probe.error && probe.error.code !== '42703') throw databaseError(probe.error, '스키마 확인');
      teamColumn = !probe.error;
    }
    const gameWrite = await db.from('matches').upsert(bundle.match, { onConflict: 'game_id' });
    if (gameWrite.error) throw databaseError(gameWrite.error, '경기');
    const rows = bundle.stats.map(({ team, ...rest }) => teamColumn ? { ...rest, team } : rest);
    const statsWrite = await db.from('player_stats').upsert(rows, { onConflict: 'id' });
    if (statsWrite.error) throw databaseError(statsWrite.error, '선수 기록 (경기는 저장됨)');
    progress('저장된 경기와 선수 기록 검증 중');
    if (!(await storedBundleMatches(bundle))) throw new LeaguepediaError('DATABASE_VERIFY_FAILED', '저장 결과를 검증하지 못했습니다. Supabase 조회 권한과 선수 기록을 확인해 주세요.');
    return result;
  }
  function startImport(tournament = 'LCK%') {
    if (active) return { ...lastJob };
    lastJob = { id: crypto.randomUUID(), state: 'running', message: '조회 준비 중', startedAt: new Date().toISOString() };
    const job = lastJob;
    active = syncMatches(tournament, 1, (message) => { job.message = message; }).then((result) => {
      Object.assign(job, { state: 'complete', message: '실제 경기 한 개를 연결했습니다.', result });
    }).catch((error) => {
      Object.assign(job, { state: 'failed', code: error instanceof LeaguepediaError ? error.code : 'IMPORT_FAILED', message: error instanceof LeaguepediaError ? error.message : '경기 가져오기에 실패했습니다.', retryAt: error.retryAt ? new Date(error.retryAt).toISOString() : null });
    }).finally(() => { job.finishedAt = new Date().toISOString(); active = null; });
    return { ...job };
  }
  return { syncMatches, startImport, getJob: () => lastJob && { ...lastJob } };
}
module.exports = createDataSyncService();
module.exports.createDataSyncService = createDataSyncService;
module.exports.normalizeBundle = normalizeBundle;

module.exports.normalizeGame = normalizeGame;
