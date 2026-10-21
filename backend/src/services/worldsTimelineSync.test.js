const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createWorldsTimelineSync,sourceForGame,savedTimelineMatches}=require('./worldsTimelineSync');
const {fileName}=require('./matchTimeline');

const epoch=Date.parse('2026-10-16T12:00:00Z');
const game=(number=1)=>({game_id:`2026 Season World Championship/Play-In_Round 1_1_${number}`,match_id:'2026 Season World Championship/Play-In_Round 1_1',game_number:number,team1:'Cloud9',team2:'Karmine Corp',win_team:'Cloud9',gamelength_number:30,datetime_utc:new Date(epoch+(number-1)*2100000).toISOString()});
const roster=game=>[game.team1,game.team2].flatMap((team,side)=>Array.from({length:5},(_,i)=>({game_id:game.game_id,team,name:`${team}${i}`,champion:`Champion${side}${i}`,gold:10000+i,kills:side?0:1})));
const source=game=>({gameId:`100${game.game_number}`,eventId:'200',gameNumber:game.game_number,teams:['C9','KC'],seriesStartTime:new Date(epoch).toISOString()});
function saved(game,players,entry=source(game)){
  const team=side=>({team:side?game.team2:game.team1,participants:players.filter(player=>player.team===(side?game.team2:game.team1)).map((player,i)=>({id:side*5+i+1,name:player.name,champion:player.champion}))});
  return {version:1,state:'ready',gameId:game.game_id,blue:team(0),red:team(1),source:{gameId:entry.gameId,eventId:entry.eventId},coverage:{complete:true,largestGapSeconds:10,durationSeconds:1800},samples:[{seconds:1800,blueGold:50010,redGold:50010,blueKills:5,redKills:0}],events:[]};
}
async function fixture(t,options={}){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'dolgg-worlds-timeline-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const directory=path.join(root,'data'),storageDir=path.join(root,'state');await fs.mkdir(directory);
  const games=options.games||[game(1),game(2)],players=options.players||games.flatMap(roster),sources=options.sources||games.map(source);
  const reads=[],collected=[];let catalogReads=0,clock=epoch;
  const db={from(table){const query={table};reads.push(query);return{select(){return this;},like(field,value){query.like=[field,value];return this;},order(){return this;},in(field,values){query.ids=values;return this;},limit(count){query.limit=count;return Promise.resolve({data:(table==='matches'?games:players.filter(player=>query.ids.includes(player.game_id))).slice(0,Math.min(count,1000))});}};}};
  const timers=[];
  const settings={db,directory,storageDir,enabled:false,now:()=>clock,setTimer:(fn,delay)=>{timers.push({fn,delay});return{};},clearTimer:()=>{},catalog:{getGames:async()=>{catalogReads++;return sources;}},collect:async settings=>{collected.push(settings.sourceGameId);return[];},normalize:(_windows,{game,players,sourceGameId,sourceEventId})=>saved(game,players,{gameId:sourceGameId,eventId:sourceEventId}),...options};
  const makeSync=overrides=>createWorldsTimelineSync({...settings,...overrides});
  return{root,directory,storageDir,games,players,sources,reads,collected,timers,sync:makeSync(),makeSync,setClock:value=>{clock=value;},catalogReads:()=>catalogReads};
}
async function run(sync){sync.startSync();await sync.wait();}
const readTimeline=(fixture,game)=>fs.readFile(path.join(fixture.directory,fileName(game.game_id)),'utf8').then(JSON.parse);

test('source mapping requires the exact set, aliased teams and nearby date; ambiguity is rejected',()=>{
  const current=game(2),entry=source(current);
  assert.equal(sourceForGame(current,[{...entry,gameNumber:1},entry]),entry);
  assert.equal(sourceForGame({...current,datetime_utc:'2026-10-16 12:35:00'},[entry]),entry);
  assert.equal(sourceForGame(current,[{...entry,teams:['C9','Other']}]),undefined);
  assert.equal(sourceForGame(current,[{...entry,seriesStartTime:new Date(epoch-19*3600000).toISOString()}]),undefined);
  assert.equal(sourceForGame({...current,datetime_utc:'unknown'},[entry]),undefined);
  assert.throws(()=>sourceForGame(current,[entry,{...entry,gameId:'different'}]),{code:'TIMELINE_INVALID'});
  assert.ok(sourceForGame({...current,team1:'Gen.G',team2:'Invictus Gaming'},[{...entry,teams:['Gen.G Esports','IG']}]));
});

test('completed sets are read in batches, concurrent starts share one job, and verified files are reused',async t=>{
  const f=await fixture(t);f.sync.startSync();f.sync.startSync();await f.sync.wait();
  assert.deepEqual(f.reads.map(read=>read.table),['matches','player_stats']);
  assert.deepEqual(f.reads[1].ids,f.games.map(game=>game.game_id));
  assert.equal(f.catalogReads(),1);assert.deepEqual(f.collected,['1001','1002']);
  assert.equal(f.sync.status().ready,2);assert.equal(f.sync.status().total,2);
  for(const current of f.games)assert.equal((await readTimeline(f,current)).gameId,current.game_id);
  await run(f.makeSync());assert.deepEqual(f.collected,['1001','1002']);
});

test('429 stops the entire queue and the persisted cooldown survives a server restart',async t=>{
  const f=await fixture(t);let limited=true;const calls=[];
  const collect=async settings=>{calls.push(settings.sourceGameId);if(limited)throw Object.assign(new Error('limited'),{code:'SOURCE_RATE_LIMITED',retryAt:new Date(epoch+3600000).toISOString()});return[];};
  const sync=f.makeSync({collect,enabled:true});await run(sync);
  assert.deepEqual(calls,['1001']);assert.equal(sync.gameStatus(f.games[0].game_id).state,'retrying');assert.equal(sync.gameStatus(f.games[1].game_id).state,'queued');
  const restarted=f.makeSync({collect,enabled:true});await restarted.start();restarted.startSync();await restarted.wait();
  assert.deepEqual(calls,['1001']);assert.ok(f.timers.at(-1).delay>=3600000);
  limited=false;f.setClock(epoch+3600000);await run(restarted);
  assert.deepEqual(calls,['1001','1001','1002']);assert.equal(restarted.status().ready,2);
  sync.stop();restarted.stop();
});

test('a full tournament exceeding the database row cap keeps all ten player rows for every set',async t=>{
  const games=Array.from({length:101},(_,i)=>({...game(1),game_id:`2026 Season World Championship/series${i}_1`,team1:`TeamA${i}`,team2:`TeamB${i}`,win_team:`TeamA${i}`}));
  const sources=games.map((current,i)=>({...source(current),gameId:`game${i}`,teams:[current.team1,current.team2]}));
  const f=await fixture(t,{games,sources});await run(f.sync);
  assert.equal(f.sync.status().ready,101);assert.equal(f.collected.length,101);
  assert.equal(f.reads.filter(read=>read.table==='player_stats').length,2);
  assert.ok(f.reads.filter(read=>read.table==='player_stats').every(read=>read.ids.length<=90));
});

test('missing players and absent source mappings stay pending while another set is collected',async t=>{
  const games=[game(1),game(2),game(3)];
  const f=await fixture(t,{games,players:games.flatMap(roster).filter(player=>player.name!=='Cloud90'||player.game_id!==games[0].game_id),sources:games.slice(0,2).map(source)});
  await run(f.sync);
  assert.equal(f.sync.gameStatus(games[0].game_id).state,'waiting_for_players');
  assert.equal(f.sync.gameStatus(games[2].game_id).state,'waiting_for_source');
  assert.deepEqual(f.collected,['1002']);assert.equal(f.sync.status().ready,1);assert.equal(f.sync.status().pending,2);
});

test('unavailable sources and verification failures never publish a graph or block other sets',async t=>{
  const games=[game(1),game(2),game(3)];const f=await fixture(t,{games});
  const sync=f.makeSync({collect:async settings=>{if(settings.sourceGameId==='1001')throw Object.assign(new Error('no archive'),{code:'SOURCE_UNAVAILABLE'});return settings.sourceGameId;},normalize:(windows,options)=>{if(windows==='1002')throw Object.assign(new Error('pause or final totals mismatch'),{code:'TIMELINE_INVALID'});return saved(options.game,options.players);}});
  await run(sync);
  assert.equal(sync.gameStatus(games[0].game_id).state,'source_unavailable');assert.equal(sync.gameStatus(games[1].game_id).state,'verification_failed');
  assert.equal(sync.status().ready,1);assert.equal(sync.status().unavailable,1);assert.equal(sync.status().failed,1);
  await assert.rejects(readTimeline(f,games[0]),{code:'ENOENT'});await assert.rejects(readTimeline(f,games[1]),{code:'ENOENT'});
  assert.equal((await readTimeline(f,games[2])).state,'ready');
});

test('corrupt and stale graph files are quarantined and repaired from a fresh verified import',async t=>{
  const f=await fixture(t);
  await fs.writeFile(path.join(f.directory,fileName(f.games[0].game_id)),'{broken');
  const stale=saved(f.games[1],roster(f.games[1]));stale.samples[0].blueGold++;
  await fs.writeFile(path.join(f.directory,fileName(f.games[1].game_id)),JSON.stringify(stale));
  await run(f.sync);
  assert.equal(f.sync.status().ready,2);assert.equal(f.collected.length,2);
  assert.equal((await fs.readdir(path.join(f.storageDir,'quarantine'))).length,2);
  assert.equal((await readTimeline(f,f.games[1])).samples[0].blueGold,50010);
  assert.ok((await fs.readdir(f.directory)).every(name=>name.endsWith('.json')));
});

test('cached graph validation rejects nonfinite coverage, repeated participants and contradictory source totals',()=>{
  const current=game(),players=roster(current),entry=source(current),valid=saved(current,players);
  assert.equal(savedTimelineMatches(valid,current,players,entry),true);
  const variants=[value=>{value.coverage.durationSeconds=NaN;},value=>{value.coverage.largestGapSeconds=Infinity;},value=>{delete value.coverage.durationSeconds;},value=>{value.blue.participants[1]={...value.blue.participants[0]};},value=>{value.red.participants[0].id=value.blue.participants[0].id;},value=>{value.source.gameId='wrong';},value=>{value.samples[0].blueGold++;},value=>{value.samples[0].redKills++;},value=>{value.samples={length:1};},value=>{value.red.participants={length:5};},value=>{value.blue.participants[0]=null;}];
  for(const change of variants){const value=structuredClone(valid);change(value);assert.equal(savedTimelineMatches(value,current,players,entry),false);}
});

test('a missing ready file never returns a ready payload without graph data',async t=>{
  const f=await fixture(t,{games:[game()]});await run(f.sync);
  await fs.unlink(path.join(f.directory,fileName(f.games[0].game_id)));
  const restarted=f.makeSync();await restarted.start();
  assert.notEqual(restarted.gameStatus(f.games[0].game_id).state,'ready');
  await run(restarted);assert.equal((await readTimeline(f,f.games[0])).state,'ready');
});

test('shutdown aborts active collection and a restart resumes without publishing partial data',{timeout:3000},async t=>{
  const f=await fixture(t,{games:[game()]});let started;
  const checkpoint=path.join(f.storageDir,'partial-window.json'),collecting=new Promise(resolve=>{started=resolve;});
  const first=f.makeSync({collect:async({signal,sourceGameId})=>{await fs.writeFile(checkpoint,JSON.stringify({sourceGameId,frames:12}));started();return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}});
  first.startSync();await collecting;first.stop();await first.wait();
  await assert.rejects(readTimeline(f,f.games[0]),{code:'ENOENT'});
  let resumes=0;
  const restarted=f.makeSync({collect:async({sourceGameId})=>{const partial=JSON.parse(await fs.readFile(checkpoint,'utf8'));assert.equal(partial.sourceGameId,sourceGameId);assert.equal(partial.frames,12);resumes++;return[];}});
  await restarted.start();assert.equal(restarted.gameStatus(f.games[0].game_id).state,'queued');
  await run(restarted);assert.equal(resumes,1);assert.equal((await readTimeline(f,f.games[0])).state,'ready');
});

test('an unavailable checkpoint directory cannot crash the backend or publish a partial graph',async t=>{
  const f=await fixture(t);await fs.writeFile(f.storageDir,'not a directory');
  await run(f.sync);
  assert.equal(f.sync.status().running,false);assert.equal(f.sync.status().ready,0);
  assert.deepEqual(await fs.readdir(f.directory),[]);
});
