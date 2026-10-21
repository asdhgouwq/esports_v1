class MatchDraftError extends Error {
  constructor(code, message, status) { super(message); this.code = code; this.status = status; }
}

const name = (value) => {
  const text = typeof value === 'string' ? value.trim() : '';
  return !text || ['none', 'null', '-', '—', 'n/a'].includes(text.toLowerCase()) ? null : text.slice(0, 120);
};
const identity = (value) => {
  const normalized = String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  return { wukong: 'monkeyking', renataglasc: 'renata', nunuwillump: 'nunu' }[normalized] || normalized;
};
const list = (value) => (typeof value === 'string' ? value.split(',') : Array.isArray(value) ? value : []).map(name).filter(Boolean).map(identity).sort();

function normalizeDraft(record, match) {
  if (!record || record.GameId !== match.game_id || !record.Team1 || !record.Team2 || record.Team1 === record.Team2
    || ![record.Team1, record.Team2].every((team) => [match.team1, match.team2].includes(team))) return null;
  const teams = [1, 2].map((side) => ({
    team: record[`Team${side}`],
    picks: Array.from({ length: 5 }, (_, index) => name(record[`Team${side}Pick${index + 1}`])),
    bans: Array.from({ length: 5 }, (_, index) => name(record[`Team${side}Ban${index + 1}`])),
  }));
  for (const side of teams) {
    const storedSide = match.team1 === side.team ? 1 : 2;
    const stored = list(match[`team${storedSide}_picks`]);
    const ordered = list(side.picks);
    // Two complete records must describe the same final composition.
    if (stored.length === 5 && ordered.length === 5 && stored.join('|') !== ordered.join('|')) return null;
  }
  const picks = teams.flatMap((side) => side.picks.filter(Boolean).map(identity));
  if (new Set(picks).size !== picks.length) return null;
  if (!teams.some((side) => [...side.picks, ...side.bans].some(Boolean))) return null;
  const knownTeam = value => teams.find(team => team.team === name(value))?.team || null;
  const firstPickTeam = knownTeam(record.FirstPick) || teams[0].team;
  // PicksAndBansS7 stores the first-picking team first, independently of map side.
  if (firstPickTeam !== teams[0].team || (name(record.FirstPick) && !knownTeam(record.FirstPick))) return null;
  const switched = [true, 1, '1'].includes(record.SwitchedSides) ? true : [false, 0, '0'].includes(record.SwitchedSides) ? false : null;
  let blueTeam = knownTeam(record.Blue), redTeam = knownTeam(record.Red);
  if (name(record.Blue) || name(record.Red)) {
    if (!blueTeam || !redTeam || blueTeam === redTeam) return null;
    if (switched !== null && blueTeam !== teams[switched ? 1 : 0].team) return null;
  } else if (switched !== null) {
    blueTeam = teams[switched ? 1 : 0].team;
    redTeam = teams[switched ? 0 : 1].team;
  }
  const sidesConfirmed = Boolean(blueTeam && redTeam);
  return { state: 'ready', gameId: match.game_id, format: 'tournament', teams, firstPickTeam, sidesConfirmed,
    firstPickSide: sidesConfirmed ? (firstPickTeam === blueTeam ? 'blue' : 'red') : null,
    blue: teams.find(team => team.team === blueTeam) || null, red: teams.find(team => team.team === redTeam) || null,
    selections: { side: knownTeam(record.SideSelection), pick: knownTeam(record.PickSelection), first: knownTeam(record.FirstSelection) },
    source: 'Leaguepedia · PicksAndBansS7 / MatchScheduleGame' };
}

const hasDraftMetadata = record => record && ['SwitchedSides', 'Blue', 'Red', 'SideSelection', 'PickSelection', 'FirstPick'].every(key => Object.hasOwn(record, key));

function createMatchDraftService({ db, loadDraft, now = () => Date.now() }) {
  const cache = new Map();
  const pending = new Map();
  let backoffUntil = 0;
  const unavailable = (gameId) => ({ state: 'unavailable', gameId, message: '밴픽 순서 원본을 지금 확인할 수 없어 최종 목록을 표시합니다.' });
  async function getDraft(gameId) {
    if (typeof gameId !== 'string' || !gameId.trim() || gameId.length > 300) throw new MatchDraftError('INVALID_GAME', '올바른 경기를 선택해 주세요.', 400);
    if (!db) throw new MatchDraftError('DATA_UNAVAILABLE', '경기 데이터 연결을 확인하고 있습니다.', 503);
    const { data: match, error } = await db.from('matches').select('*').eq('game_id', gameId).maybeSingle();
    if (error) throw new MatchDraftError('DATA_QUERY_FAILED', '경기 기록을 불러오지 못했습니다.', 503);
    if (!match) return { state: 'waiting_for_data', gameId };
    const key = JSON.stringify([gameId, match.team1, match.team2, match.team1_picks, match.team2_picks]);
    if (cache.get(key)?.expiresAt > now()) return cache.get(key).value;
    if (pending.has(key)) return pending.get(key);
    if (backoffUntil > now() || pending.size >= 2) return unavailable(gameId);
    const task = (async () => {
      let value, ttl = 300000;
      try {
        const rows = await loadDraft(gameId);
        value = Array.isArray(rows) && rows.length === 1 ? normalizeDraft(rows[0], match) : null;
        if (value) ttl = 1800000;
        else value = { state: 'not_recorded', gameId, message: '선택 순서 기록이 없어 최종 목록을 표시합니다.' };
      } catch (error) {
        value = unavailable(gameId);
        ttl = 60000;
        if (error.code === 'ratelimited' || error.response?.status === 429) backoffUntil = now() + 600000;
      }
      cache.set(key, { value, expiresAt: now() + ttl });
      if (cache.size > 200) cache.delete(cache.keys().next().value);
      return value;
    })().finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
  }
  return { getDraft };
}

module.exports = { createMatchDraftService, normalizeDraft, hasDraftMetadata, MatchDraftError };
