const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { collectWindows } = require('./lolesportsTimelineSource');
const { normalizeTimeline, createMatchTimelineService, fileName } = require('./matchTimeline');
const { attachPlayerTeams, championKey } = require('./playerTeams');

const aliases = { cloud9kia:'cloud9', c9:'cloud9', kc:'karminecorp', movistarkoimadrid:'movistarkoi', mvk:'movistarkoi', furiaesports:'furia', geng:'gengesports', gen:'gengesports', ig:'invictusgaming' };
const teamKey = value => { const key = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, ''); return aliases[key] || key; };
const timestamp = value => Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(value || '') ? value : `${String(value || '').replace(' ', 'T')}Z`);
function sourceForGame(game, catalog) {
  const expected = [game.team1, game.team2].map(teamKey).sort().join('|');
  const candidates = catalog.filter(source => source.gameNumber === Number(game.game_number)
    && source.teams.map(teamKey).sort().join('|') === expected
    && Math.abs(timestamp(game.datetime_utc) - Date.parse(source.seriesStartTime)) <= 18 * 3600000);
  if (candidates.length > 1) throw Object.assign(new Error('경기를 고유하게 식별하지 못했습니다.'), { code:'TIMELINE_INVALID' });
  return candidates[0];
}
function savedTimelineMatches(value, game, players, source) {
  if (value?.state !== 'ready' || value.gameId !== game.game_id || value.coverage?.complete !== true
    || !Number.isFinite(value.coverage.largestGapSeconds) || value.coverage.largestGapSeconds > 12
    || !Number.isFinite(value.coverage.durationSeconds) || !Number.isFinite(Number(game.gamelength_number))
    || Math.abs(value.coverage.durationSeconds - Math.round(Number(game.gamelength_number) * 60)) > 15
    || !Array.isArray(value.samples) || !value.samples.length || !value.samples.at(-1)
    || typeof value.source?.gameId !== 'string' || typeof value.source?.eventId !== 'string'
    || ![value.blue,value.red].every(team => Array.isArray(team?.participants) && team.participants.length === 5 && team.participants.every(player => player && Number.isInteger(player.id)))
    || (source && (value.source?.gameId !== source.gameId || value.source?.eventId !== source.eventId))) return false;
  if (new Set([...(value.blue?.participants || []),...(value.red?.participants || [])].map(player => player.id)).size !== 10) return false;
  const last = value.samples.at(-1);
  return new Set([value.blue?.team, value.red?.team]).size === 2 && ['blue','red'].every(side => {
    const team = value[side], rows = players.filter(player => player.game_id === game.game_id && player.team === team?.team);
    return [game.team1, game.team2].includes(team?.team) && rows.length === 5 && team.participants?.length === 5
      && ['id','name','champion'].every(key => new Set(team.participants.map(player => player[key])).size === 5)
      && team.participants.every(player => rows.some(row => row.name === player.name && championKey(row.champion) === championKey(player.champion)))
      && last[`${side}Gold`] === rows.reduce((sum, row) => sum + Number(row.gold), 0)
      && last[`${side}Kills`] === rows.reduce((sum, row) => sum + Number(row.kills), 0);
  });
}
async function atomicJson(file, value) {
  await fs.mkdir(path.dirname(file), {recursive:true});
  const temporary = `${file}.${randomUUID()}.tmp`;
  try { await fs.writeFile(temporary, JSON.stringify(value), {mode:0o600}); await fs.rename(temporary, file); }
  finally { await fs.rm(temporary, {force:true}).catch(() => {}); }
}
function createWorldsTimelineSync({ db, catalog, collect = collectWindows, normalize = normalizeTimeline,
  directory = path.resolve(__dirname, '../../data/timelines'), storageDir = path.resolve(__dirname, '../../.local/worlds-sync/timelines'),
  year = 2026, enabled = process.env.WORLDS_TIMELINE_AUTO_SYNC !== 'false' && process.env.WORLDS_AUTO_SYNC === 'true',
  intervalMs = 15 * 60000, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const timeline = createMatchTimelineService({directory}), stateFile = path.join(storageDir, 'status.json');
  let jobs = {}, running = null, timer, controller, initialization, cooldown = 0, updatedAt = null, message = '경기 흐름 수집 준비 중';
  let persistence = Promise.resolve();
  const iso = () => new Date(now()).toISOString();
  const save = () => { const snapshot = JSON.stringify({version:1,year,jobs,updatedAt,message,cooldown}); persistence = persistence.catch(() => {}).then(() => atomicJson(stateFile, JSON.parse(snapshot))); return persistence; };
  const status = () => {
    const rows = Object.values(jobs), ready = rows.filter(row => row.state === 'ready').length;
    const unavailable = rows.filter(row => row.state === 'source_unavailable').length;
    const failed = rows.filter(row => row.state === 'verification_failed').length;
    const current = rows.find(row => row.state === 'collecting');
    return {enabled,running:Boolean(running),total:rows.length,ready,pending:rows.length-ready-unavailable-failed,unavailable,failed,
      currentGameId:current?.gameId || null,progress:current?.progress || null,message,updatedAt};
  };
  function gameStatus(gameId) {
    const row = jobs[gameId];
    return row ? {gameId,state:row.state === 'ready' ? 'queued' : row.state,
      message:row.state === 'ready' ? '저장 파일을 다시 확인한 뒤 연결합니다.' : row.message,retryAt:row.nextAttemptAt || null,progress:row.progress || null}
      : {gameId,state:enabled && gameId.startsWith(`${year} Season World Championship/`) ? 'waiting_for_source' : 'not_recorded',
        message:enabled?'다음 월즈 갱신에서 공개 원본을 확인합니다.':'아직 연결된 시간대별 기록이 없습니다.'};
  }
  async function quarantine(id) {
    const target = path.join(storageDir, 'quarantine', `${fileName(id)}.${now()}`);
    await fs.mkdir(path.dirname(target), {recursive:true});
    try { await fs.rename(path.join(directory, fileName(id)), target); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  function update(gameId, patch) {
    jobs[gameId] = {...jobs[gameId],gameId,...patch,updatedAt:iso()}; updatedAt = iso();
  }
  async function loadState() {
    try {
      const saved = JSON.parse(await fs.readFile(stateFile, 'utf8'));
      if (saved.version === 1 && saved.year === year && saved.jobs && typeof saved.jobs === 'object') {
        jobs = saved.jobs; cooldown = Number(saved.cooldown) || 0; updatedAt = saved.updatedAt || null;
        for (const row of Object.values(jobs)) if (row.state === 'collecting') { row.state = 'queued'; row.message = '저장된 수집 구간부터 이어갑니다.'; }
      }
    } catch (error) { if (error.code !== 'ENOENT' && error.name !== 'SyntaxError') throw error; }
  }
  function initialize() {
    if (!initialization) initialization = loadState().catch(error => { initialization = null; throw error; });
    return initialization;
  }
  async function sync(signal) {
    await initialize();
    if (cooldown > now()) return;
    const result = await db.from('matches').select('*').like('match_id', `${year} Season World Championship%`).order('datetime_utc', {ascending:true}).limit(1000);
    if (result.error) throw new Error('경기 목록을 불러오지 못했습니다.');
    const games = (result.data || []).filter(game => [game.team1,game.team2].includes(game.win_team) && Number(game.gamelength_number) > 0);
    const ids = new Set(games.map(game => game.game_id));
    jobs = Object.fromEntries(Object.entries(jobs).filter(([id]) => ids.has(id)));
    for (const game of games) if (!jobs[game.game_id]) update(game.game_id, {state:'queued',attempts:0,message:'공개 경기 흐름을 확인할 차례를 기다립니다.'});
    await save();
    if (!games.length) { message = '저장된 월즈 종료 경기가 없습니다.'; return; }
    const rows = [], gameIds = [...ids];
    for (let offset = 0; offset < gameIds.length; offset += 90) {
      const stats = await db.from('player_stats').select('*').in('game_id', gameIds.slice(offset,offset+90)).limit(1000);
      if (stats.error) throw new Error('선수 기록을 불러오지 못했습니다.');
      rows.push(...(stats.data || []));
    }
    const players = attachPlayerTeams(rows, games);
    let sources;
    try { sources = await catalog.getGames(year, {signal}); }
    catch (error) {
      signal.throwIfAborted();
      cooldown = Math.max(now()+intervalMs, Number(error.retryAt) || Date.parse(error.retryAt) || 0);
      message = '공식 경기 목록을 가져오지 못해 다음 갱신에서 다시 확인합니다.';
      for (const game of games) if (jobs[game.game_id].state !== 'ready') update(game.game_id, {state:'waiting_for_source',message,nextAttemptAt:new Date(cooldown).toISOString()});
      await save(); return;
    }
    for (const game of games) {
      signal.throwIfAborted();
      const id = game.game_id, row = jobs[id], roster = players.filter(player => player.game_id === id);
      let source;
      try {
        source = sourceForGame(game, sources);
        let saved;
        try { saved = await timeline.getTimeline(id); }
        catch (error) { if (error.code !== 'TIMELINE_UNAVAILABLE') throw error; await quarantine(id); }
        if (savedTimelineMatches(saved, game, roster, source)) { update(id, {state:'ready',message:'골드·선수 기록과 대조한 경기 흐름입니다.',nextAttemptAt:null,progress:null,sourceGameId:saved.source.gameId}); continue; }
        if (saved?.state === 'ready') await quarantine(id);
        if (Date.parse(row.nextAttemptAt || '') > now()) continue;
        if (!source) { update(id, {state:'waiting_for_source',message:'공식 공개 일정에 해당 세트가 등록되기를 기다립니다.',nextAttemptAt:new Date(now()+3600000).toISOString()}); continue; }
        if (roster.length !== 10 || [game.team1,game.team2].some(team => roster.filter(player => player.team === team).length !== 5)) {
          update(id, {state:'waiting_for_players',message:'선수 10명의 기록이 준비되면 원본과 대조합니다.',nextAttemptAt:new Date(now()+intervalMs).toISOString()}); continue;
        }
        update(id, {state:'collecting',attempts:(row.attempts || 0)+1,message:'시간대별 골드와 주요 이벤트를 수집하고 있습니다.',sourceGameId:source.gameId,sourceEventId:source.eventId,nextAttemptAt:null,progress:null});
        message = `${games.indexOf(game)+1}/${games.length}세트 경기 흐름 확인 중`; await save();
        const windows = await collect({sourceGameId:source.gameId,durationSeconds:Math.round(Number(game.gamelength_number)*60),signal,
          progress:progress => update(id, {progress})});
        signal.throwIfAborted();
        const value = normalize(windows, {game,players:roster,sourceEventId:source.eventId,sourceGameId:source.gameId,sourceGameNumber:Number(game.game_number),fetchedAt:iso()});
        await atomicJson(path.join(directory, fileName(id)), value);
        update(id, {state:'ready',message:'골드·킬·선수 기록을 대조해 저장했습니다.',nextAttemptAt:null,progress:null,lastError:null});
      } catch (error) {
        signal.throwIfAborted();
        if (error.code === 'TIMELINE_INVALID') await quarantine(id);
        const attempts = jobs[id].attempts || 1;
        jobs[id].lastError = {code:error.code || 'SYNC_FAILED',message:error.message};
        const retry = Math.max(now()+Math.min(6*3600000,intervalMs*2**Math.min(attempts-1,5)), Number(error.retryAt) || Date.parse(error.retryAt) || 0);
        if (error.code === 'TIMELINE_INVALID' || error.code === 'TIMELINE_UNAVAILABLE' || error.code === 'SOURCE_INVALID') update(id, {state:'verification_failed',message:'원본의 수치·시점 또는 선수 구성이 일치하지 않아 표시를 보류했습니다.',nextAttemptAt:new Date(now()+6*3600000).toISOString(),progress:null});
        else if (error.code === 'SOURCE_UNAVAILABLE') update(id, {state:'source_unavailable',message:'현재 이 세트의 무료 공개 원본을 제공받을 수 없습니다.',nextAttemptAt:new Date(now()+86400000).toISOString(),progress:null});
        else update(id, {state:'retrying',message:'원본 제공 지연으로 저장된 구간부터 다시 시도합니다.',nextAttemptAt:new Date(retry).toISOString(),progress:null});
        if (error.code === 'SOURCE_RATE_LIMITED') { cooldown = retry; message = '공개 피드의 요청 제한에 따라 수집을 잠시 기다립니다.'; await save(); return; }
      }
      await save();
    }
    const count = status(); message = `경기 흐름 ${count.ready}/${count.total}세트 저장 · 나머지는 원본 제공 상태에 따라 재확인합니다.`;
    updatedAt = iso(); await save();
  }
  function schedule(delay = intervalMs) {
    clearTimer(timer);
    if (!enabled) return;
    timer = setTimer(() => startSync(), Math.max(delay, cooldown-now())); timer.unref?.();
  }
  function startSync() {
    if (running) return status();
    clearTimer(timer);
    if (cooldown > now()) { schedule(); return status(); }
    controller = new AbortController();
    running = Promise.resolve().then(() => sync(controller.signal)).catch(async error => {
      message = controller.signal.aborted ? '다음 시작 시 저장된 구간부터 이어갑니다.' : '경기 흐름 수집에 실패해 다음 갱신에서 다시 확인합니다.';
      if (!controller.signal.aborted) console.error('[Worlds timeline]', error.code || 'SYNC_FAILED');
      updatedAt = iso(); await save().catch(() => console.error('[Worlds timeline] State persistence failed'));
    }).finally(() => { running = null; schedule(); });
    return status();
  }
  return {status,gameStatus,startSync,wait:() => running,
    async start() { await initialize(); if (enabled) schedule(1000); },
    stop() {enabled=false;clearTimer(timer);controller?.abort();}};
}
module.exports = {createWorldsTimelineSync,sourceForGame,savedTimelineMatches};
