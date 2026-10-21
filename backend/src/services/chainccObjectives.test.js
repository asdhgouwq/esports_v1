const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {gzipSync} = require('node:zlib');
const {parseObjectives,matchObjectives,createChainccSource} = require('./chainccObjectives');
const {createMatchObjectivesService} = require('./matchObjectives');

const epoch = Date.parse('2026-10-15T18:16:00Z');
const game = {game_id:'2026 Season World Championship/Play-In_Round 1_1_1',game_number:1,datetime_utc:new Date(epoch).toISOString(),gamelength_number:35,team1:'C9',team2:'KC',win_team:'C9'};
const players = ['KC','C9'].flatMap((team,index) => Array.from({length:5}, (_,i) => ({game_id:game.game_id,name:`${team}${i}`,team,champion:`Champ${index}${i}`,gold:10000,kills:index ? 4 : 0})));
const draft = {state:'ready',sidesConfirmed:true,gameId:game.game_id,blue:{team:'KC'},red:{team:'C9'}};
const rows = ['KC','C9'].map((team,index) => ({game_id:'TOURNAMENT_123',date:'2026-10-15 18:16:33',league:'WLDs',year:'2026',game_number:'1',side:index ? 'Red' : 'Blue',team_name:team,opponent_team_name:index ? 'KC' : 'C9',result:index ? 'TRUE' : 'FALSE',gamelength:'2100',teamkills:index ? '20' : '0',totalgold:'50000',heralds:index ? '0' : '1',opp_heralds:index ? '1' : '0',void_grubs:index ? '0' : '3',opp_void_grubs:index ? '3' : '0',...Object.fromEntries(Array.from({length:5}, (_,i) => [`pick${i+1}`,`Champ${index}${i}`]))}));
const snapshot = {year:2026,fetchedAt:new Date(epoch).toISOString(),rows};
const clone = value => structuredClone(value);
const csv = records => {
  const headers = Object.keys(rows[0]);
  const quote = value => `"${String(value ?? '').replaceAll('"','""')}"`;
  return [headers.join(','),...records.map(row => headers.map(field => quote(row[field])).join(','))].join('\r\n');
};

test('CSV schema, quoted fields and season filtering are validated', () => {
  const quoted = {...rows[0],team_name:'Team, "One"\nClub'};
  const parsed = parseObjectives(csv([quoted,rows[1],{...rows[0],year:'2025'},{...rows[0],league:'LCK'}]),2026);
  assert.equal(parsed.length,2); assert.equal(parsed[0].team_name,quoted.team_name);
  assert.throws(() => parseObjectives('game_id,side\nabc,Blue',2026),/SCHEMA/);
  assert.throws(() => parseObjectives('',2026),/EMPTY/);
});

test('verified counts respect actual sides, preserve zero and never invent timed events', () => {
  const value = matchObjectives(game,players,draft,snapshot);
  assert.deepEqual(value.blue,{team:'KC',grubs:3,herald:1});
  assert.deepEqual(value.red,{team:'C9',grubs:0,herald:0});
  assert.equal(value.source.gameId,'TOURNAMENT_123');
  assert.equal(value.coverage.eventTimes,false); assert.equal(value.events,undefined);
  const partial = clone(snapshot); partial.rows[0].heralds = '';
  assert.equal(matchObjectives(game,players,draft,partial).blue.herald,null);
});

test('wrong set, side, date, result, duration, champion, totals, invalid count and ambiguous matches are rejected', () => {
  for (const edit of [
    value => {value.rows[0].game_number='2';}, value => {value.rows[0].side='Red';},
    value => {value.rows.forEach(row => {row.date='2026-10-16 18:16:33';});},
    value => {value.rows[0].result='TRUE';}, value => {value.rows[0].gamelength='2200';},
    value => {value.rows[0].pick1='Wrong';}, value => {value.rows[0].totalgold='50001';},
    value => {value.rows[0].teamkills='1';}, value => {value.rows[0].void_grubs='-1';},
    value => {value.rows[0].heralds='1.5';}, value => {value.rows[1].opp_void_grubs='2';},
    value => {value.rows.push(...clone(value.rows).map(row => ({...row,game_id:'DUPLICATE'})));},
  ]) {
    const changed = clone(snapshot); edit(changed);
    assert.equal(matchObjectives(game,players,draft,changed),null);
  }
  assert.equal(matchObjectives(game,players,{...draft,blue:draft.red,red:draft.blue},snapshot),null);
  assert.equal(matchObjectives(game,players,{...draft,sidesConfirmed:false},snapshot),null);
  assert.equal(matchObjectives(game,players.slice(1),draft,snapshot),null);
  assert.equal(matchObjectives(game,players.map(player => ({...player,gold:null})),draft,snapshot),null);
});

test('one bounded download is shared, cached on disk, and conditionally refreshed', async t => {
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(),'dolgg-chaincc-'));
  t.after(() => fs.rm(cacheDir,{recursive:true,force:true}));
  let clock = epoch, calls = 0;
  const fetchImpl = async (_url,{headers}) => {
    calls++;
    if (calls === 1) return new Response(gzipSync(csv(rows)),{headers:{etag:'"v1"'}});
    assert.equal(headers['If-None-Match'],'"v1"');
    return new Response(null,{status:304});
  };
  const settings = {cacheDir,fetchImpl,now:() => clock};
  const source = createChainccSource(settings);
  const result = await Promise.all([source.getSnapshot(),source.getSnapshot()]);
  assert.deepEqual(result[0],result[1]); assert.equal(calls,1);
  await createChainccSource(settings).getSnapshot(); assert.equal(calls,1);
  clock += 3600000;
  assert.equal((await source.getSnapshot()).fetchedAt,new Date(epoch).toISOString());
  assert.equal(calls,2);
});

test('rate limits back off and malformed replacements do not overwrite a valid cache', async t => {
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(),'dolgg-chaincc-fail-'));
  t.after(() => fs.rm(cacheDir,{recursive:true,force:true}));
  let clock = epoch, calls = 0, mode = 'ok';
  const source = createChainccSource({cacheDir,now:() => clock,fetchImpl:async () => {
    calls++;
    return mode === 'rate' ? new Response(null,{status:429,headers:{'Retry-After':'7200'}})
      : new Response(gzipSync(mode === 'ok' ? csv(rows) : 'wrong,columns\na,b'));
  }});
  await source.getSnapshot(); clock += 3600000; mode = 'rate';
  await assert.rejects(source.getSnapshot(),/429/);
  await assert.rejects(source.getSnapshot(),/RETRY/); assert.equal(calls,2);
  clock += 7200000; mode = 'bad'; await assert.rejects(source.getSnapshot(),/SCHEMA/);
  const saved = JSON.parse(await fs.readFile(path.join(cacheDir,'teams-2026.json'),'utf8'));
  assert.equal(saved.rows[0].void_grubs,'3');
});

test('automatic sync stores current and later games without timelines, survives restart and retains counts on outage', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(),'dolgg-objectives-'));
  t.after(() => fs.rm(directory,{recursive:true,force:true}));
  let games = [game], roster = players, sourceRows = rows, fail = false;
  const timers = [], reads = [];
  const db = {from(table) {
    let ids;
    reads.push(table);
    return {select(){return this;},like(){return this;},order(){return this;},in(_field,value){ids=value;return this;},limit(){
      const data = table === 'matches' ? games : table === 'player_stats' ? roster.filter(row => ids.includes(row.game_id))
        : games.filter(g => ids.includes(g.game_id)).map(g => ({game_id:g.game_id,raw_draft:{GameId:g.game_id,Team1:'C9',Team2:'KC',Blue:'KC',Red:'C9',SwitchedSides:true,Team1Pick1:'Champ10',Team2Pick1:'Champ00'}}));
      return Promise.resolve({data});
    }};
  }};
  const settings = {db,directory,enabled:true,now:() => epoch,setTimer:(fn,delay) => {timers.push({fn,delay});return {};},clearTimer:() => {},source:{getSnapshot:async () => {if(fail)throw new Error('offline');return {...snapshot,rows:sourceRows};}}};
  const service = createMatchObjectivesService(settings);
  await service.start(); assert.equal(timers[0].delay,1000);
  timers[0].fn(); service.startSync(); await service.wait();
  assert.equal(reads.filter(table => table === 'matches').length,1);
  assert.equal(service.status().ready,1);
  const later = {...game,game_id:game.game_id.replace(/1$/,'2'),game_number:2};
  games = [game,later]; roster = [...players,...players.map(player => ({...player,game_id:later.game_id}))];
  sourceRows = [...rows,...rows.map(row => ({...row,game_id:'SECOND',game_number:'2'}))];
  assert.equal(timers.at(-1).delay,15*60000);
  timers.at(-1).fn(); await service.wait();
  assert.equal((await service.getObjectives(later.game_id)).blue.grubs,3);
  const restarted = createMatchObjectivesService({...settings,enabled:false});
  assert.equal((await restarted.getObjectives(game.game_id)).red.herald,0);
  fail = true; service.startSync(); await service.wait();
  assert.equal(service.status().last.state,'failed'); assert.equal(service.status().ready,2);
  assert.equal((await service.getObjectives(game.game_id)).blue.herald,1);
  fail = false; sourceRows = sourceRows.map(row => row.game_id === 'SECOND' ? {...row,totalgold:'1'} : row);
  service.startSync(); await service.wait();
  assert.equal((await service.getObjectives(later.game_id)).state,'pending');
  assert.equal(service.status().ready,1);
  service.stop(); restarted.stop();
});
