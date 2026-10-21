const fs = require('node:fs/promises');
const path = require('node:path');
const {createChainccSource,matchObjectives} = require('./chainccObjectives');
const {attachPlayerTeams} = require('./playerTeams');
const {normalizeDraft} = require('./matchDraft');
const {writeJson} = require('./leaguepedia');

function createMatchObjectivesService({db,year=2026,source=createChainccSource({year}),directory=path.resolve(__dirname,'../../data/objectives'),
  enabled=process.env.WORLDS_AUTO_SYNC === 'true',intervalMs=15*60000,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}={}) {
  const file = path.join(directory,`worlds-${year}.json`);
  let records = {}, last = null, running, initialization, timer;
  const status = () => ({enabled,running:Boolean(running),intervalMinutes:intervalMs/60000,ready:Object.keys(records).length,last});
  function initialize() {
    if (!initialization) initialization = (async () => {
      try {
        const saved = JSON.parse(await fs.readFile(file,'utf8'));
        if (saved.version === 1 && saved.year === year && saved.records && typeof saved.records === 'object') { records = saved.records; last = saved.last; }
      } catch (error) { if (error.code !== 'ENOENT' && error.name !== 'SyntaxError') throw error; }
    })();
    return initialization;
  }
  async function sync() {
    await initialize();
    if (!db) throw new Error('DATABASE_UNAVAILABLE');
    const result = await db.from('matches').select('*').like('match_id',`${year} Season World Championship%`).order('datetime_utc').limit(1000);
    if (result.error) throw new Error('DATABASE_READ_FAILED');
    const games = (result.data || []).filter(game => [game.team1,game.team2].includes(game.win_team) && Number(game.gamelength_number) > 0);
    const stats = [], drafts = [];
    for (let offset = 0; offset < games.length; offset += 90) {
      const ids = games.slice(offset,offset+90).map(game => game.game_id);
      const results = await Promise.all([db.from('player_stats').select('*').in('game_id',ids).limit(1000),db.from('game_drafts').select('game_id,raw_draft').in('game_id',ids).limit(1000)]);
      if (results.some(value => value.error)) throw new Error('DATABASE_READ_FAILED');
      stats.push(...results[0].data); drafts.push(...results[1].data);
    }
    const snapshot = games.length ? await source.getSnapshot() : null;
    const players = Map.groupBy(attachPlayerTeams(stats,games), player => player.game_id);
    const rawDrafts = new Map(drafts.map(row => [row.game_id,row.raw_draft]));
    const next = {};
    for (const game of games) {
      const value = matchObjectives(game,players.get(game.game_id) || [],normalizeDraft(rawDrafts.get(game.game_id),game),snapshot);
      if (value) next[game.game_id] = value;
    }
    const completed = {state:'complete',updatedAt:new Date(now()).toISOString(),sourceFetchedAt:snapshot?.fetchedAt || null,total:games.length,ready:Object.keys(next).length,pending:games.length-Object.keys(next).length};
    await writeJson(file,{version:1,year,records:next,last:completed});
    records = next; last = completed;
  }
  function schedule(delay=intervalMs) {
    clearTimer(timer);
    if (enabled && db) { timer = setTimer(startSync,delay); timer.unref?.(); }
  }
  function startSync() {
    if (running) return status();
    clearTimer(timer);
    running = Promise.resolve().then(sync).catch(error => {
      last = {state:'failed',updatedAt:new Date(now()).toISOString(),message:'유충·전령 원본을 재확인하지 못해 기존 저장본을 유지합니다.'};
      console.error('[Worlds objectives]',error.code || 'SYNC_FAILED');
    }).finally(() => {running = null; schedule();});
    return status();
  }
  return {status,startSync,wait:() => running,
    async getObjectives(gameId) { await initialize(); return Object.hasOwn(records,gameId) ? records[gameId] : gameId.startsWith(`${year} Season World Championship/`) ? {state:'pending',gameId} : null; },
    async start() { await initialize(); schedule(1000); },
    stop() { enabled = false; clearTimer(timer); }};
}
module.exports = {createMatchObjectivesService};
