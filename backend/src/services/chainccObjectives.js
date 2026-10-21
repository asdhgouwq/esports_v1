const fs = require('node:fs/promises');
const path = require('node:path');
const {gunzipSync} = require('node:zlib');
const {parse} = require('csv-parse/sync');
const {writeJson} = require('./leaguepedia');
const {championKey} = require('./playerTeams');

const SOURCE_URL = 'https://chaincc.lol/free/data';
const LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/';
const fields = ['game_id','date','league','year','game_number','side','team_name','opponent_team_name','result','gamelength','teamkills','totalgold','heralds','opp_heralds','void_grubs','opp_void_grubs',...Array.from({length:5}, (_, i) => `pick${i+1}`)];
const integer = value => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
const timestamp = value => Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(value || '') ? value : `${String(value || '').replace(' ', 'T')}Z`);
const teamKey = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const picksKey = values => values.map(championKey).sort().join('|');
const datasetUrl = year => `https://chaincc.lol/data/chaincc-teams-${year}.csv.gz`;

function parseObjectives(csv, year) {
  let headers;
  const rows = parse(csv, {bom:true, skip_empty_lines:true, max_record_size:16384, columns:columns => {
    headers = columns;
    if (new Set(columns).size !== columns.length || fields.some(field => !columns.includes(field))) throw new Error('CHAINCC_SCHEMA_CHANGED');
    return columns;
  }});
  if (!headers) throw new Error('CHAINCC_EMPTY_FILE');
  return rows.filter(row => row.league === 'WLDs' && integer(row.year) === year).map(row => Object.fromEntries(fields.map(field => [field, row[field]])));
}

function matchObjectives(game, players, draft, snapshot) {
  if (!draft?.sidesConfirmed || draft.gameId !== game.game_id || players.length !== 10
    || new Set(players.map(player => player.name)).size !== 10 || new Set(players.map(player => championKey(player.champion))).size !== 10
    || ![game.team1,game.team2].includes(game.win_team)) return null;
  const groups = Map.groupBy(snapshot.rows.filter(row => integer(row.game_number) === Number(game.game_number)
    && Math.abs(timestamp(row.date) - timestamp(game.datetime_utc)) < 15*60000
    && Math.abs(Number(row.gamelength) - Number(game.gamelength_number)*60) <= 2), row => row.game_id);
  const matches = [];
  for (const [id, rows] of groups) {
    if (!id || rows.length !== 2) continue;
    const sides = ['blue','red'].map(side => rows.find(row => row.side === (side === 'blue' ? 'Blue' : 'Red')));
    if (sides.some(row => !row) || teamKey(sides[0].team_name) === teamKey(sides[1].team_name)) continue;
    const valid = sides.every((row, index) => {
      const side = index === 0 ? 'blue' : 'red', team = draft[side].team;
      const roster = players.filter(player => player.game_id === game.game_id && player.team === team);
      const sum = field => roster.every(player => integer(player[field]) !== null) ? roster.reduce((total, player) => total + integer(player[field]), 0) : null;
      return teamKey(row.team_name) === teamKey(team) && teamKey(row.opponent_team_name) === teamKey(sides[1-index].team_name)
        && ['TRUE','FALSE'].includes(row.result) && (row.result === 'TRUE') === (game.win_team === team)
        && roster.length === 5 && picksKey(roster.map(player => player.champion)) === picksKey(Array.from({length:5}, (_, i) => row[`pick${i+1}`]))
        && integer(row.totalgold) !== null && integer(row.totalgold) === sum('gold')
        && integer(row.teamkills) !== null && integer(row.teamkills) === sum('kills')
        && [['void_grubs','opp_void_grubs',6],['heralds','opp_heralds',2]].every(([field, opposite, max]) => {
          const value = integer(row[field]), other = integer(sides[1-index][opposite]);
          return row[field] === '' || (value !== null && value <= max && (sides[1-index][opposite] === '' || value === other));
        });
    });
    if (!valid) continue;
    matches.push({state:'ready',gameId:game.game_id,
      source:{name:'ChainCC',url:SOURCE_URL,datasetUrl:datasetUrl(snapshot.year),license:'CC BY 4.0',licenseUrl:LICENSE_URL,gameId:id,fetchedAt:snapshot.fetchedAt},
      coverage:{totalsOnly:true,eventTimes:false},
      ...Object.fromEntries(sides.map((row, index) => {
        const side = index === 0 ? 'blue' : 'red';
        return [side,{team:draft[side].team,grubs:integer(row.void_grubs),herald:integer(row.heralds)}];
      }))});
  }
  return matches.length === 1 && ['blue','red'].some(side => matches[0][side].grubs !== null || matches[0][side].herald !== null) ? matches[0] : null;
}

function createChainccSource({year=2026,cacheDir=path.resolve(__dirname,'../../.cache/chaincc'),fetchImpl=fetch,now=Date.now,ttl=3600000}={}) {
  if (!Number.isInteger(year) || year < 2014 || year > 2100) throw new Error('INVALID_YEAR');
  const file = path.join(cacheDir,`teams-${year}.json`);
  let cached, loaded = false, pending, retryAt = 0;
  async function read() {
    if (!loaded) {
      try { const value = JSON.parse(await fs.readFile(file,'utf8')); if (value.version === 1 && value.year === year && Array.isArray(value.rows)) cached = value; } catch {}
      loaded = true;
    }
    if (cached && now()-Date.parse(cached.checkedAt) >= 0 && now()-Date.parse(cached.checkedAt) < ttl) return cached;
    if (retryAt > now()) throw new Error('CHAINCC_RETRY_LATER');
    try {
      const headers = {'User-Agent':'dol.gg/1.0 (https://github.com/asdhgouwq/esports_v1)'};
      if (cached?.etag) headers['If-None-Match'] = cached.etag;
      const response = await fetchImpl(datasetUrl(year), {headers,signal:AbortSignal.timeout(30000)});
      if (response.status === 304 && cached) {
        const value = {...cached,checkedAt:new Date(now()).toISOString()};
        await writeJson(file,value); cached = value; return cached;
      }
      if (!response.ok) {
        const retry = response.headers.get('retry-after');
        retryAt = Math.max(now()+15*60000, response.status === 429 ? now()+3600000 : 0, /^\d+$/.test(retry || '') ? now()+Number(retry)*1000 : Date.parse(retry) || 0);
        await response.body?.cancel();
        throw new Error(`CHAINCC_HTTP_${response.status}`);
      }
      const chunks = []; let bytes = 0;
      for await (const chunk of response.body) {
        bytes += chunk.length;
        if (bytes > 8*1024*1024) throw new Error('CHAINCC_FILE_TOO_LARGE');
        chunks.push(chunk);
      }
      const csv = gunzipSync(Buffer.concat(chunks), {maxOutputLength:32*1024*1024}).toString('utf8');
      const value = {version:1,year,fetchedAt:new Date(now()).toISOString(),checkedAt:new Date(now()).toISOString(),etag:response.headers.get('etag'),rows:parseObjectives(csv,year)};
      if (cached?.rows.length && !value.rows.length) throw new Error('CHAINCC_INCOMPLETE_FILE');
      await writeJson(file,value); cached = value; return cached;
    } catch (error) { retryAt = Math.max(retryAt,now()+15*60000); throw error; }
  }
  return {getSnapshot() { if (!pending) pending = read().finally(() => {pending = null;}); return pending; }};
}
module.exports = {createChainccSource,parseObjectives,matchObjectives};
