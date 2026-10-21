const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
const {normalizeTimeline,createMatchTimelineService,fileName}=require('./matchTimeline');
function fixture(){
 const players=['A','B'].flatMap((team,side)=>Array.from({length:5},(_,i)=>({game_id:'g',name:`${team}${i}`,team,role:['Top','Jungle','Mid','Bot','Support'][i],champion:`C${side}${i}`,gold:600,kills:team==='B'&&i===0?1:0})));
 const game={game_id:'g',team1:'A',team2:'B',gamelength_number:23/60};
 const meta=team=>({esportsTeamId:team,participantMetadata:players.filter(p=>p.team===team).map((p,i)=>({participantId:(team==='B'?1:6)+i,championId:p.champion}))});
 const frames=Array.from({length:24},(_,i)=>({rfc460Timestamp:new Date(Date.UTC(2026,9,15,0,0,i)).toISOString(),gameState:i===23?'finished':'in_game',...Object.fromEntries([['blueTeam','B',1],['redTeam','A',6]].map(([side,team,start])=>[side,{totalGold:i===23?3000:2500+i*10,totalKills:team==='B'&&i>=5?1:0,dragons:team==='B'&&i>=10?['infernal']:[],barons:0,towers:0,inhibitors:0,participants:Array.from({length:5},(_,n)=>({participantId:start+n,totalGold:i===23?600:500+i*2,level:1,kills:team==='B'&&n===0&&i>=5?1:0,deaths:team==='A'&&n===0&&i>=5?1:0,assists:0,creepScore:0}))}]))}));
 const windows=[{esportsGameId:'123',esportsMatchId:'456',gameMetadata:{blueTeamMetadata:meta('B'),redTeamMetadata:meta('A')},frames}];
 return {windows,options:{game,players,sourceGameId:'123',sourceEventId:'456'}};
}
test('timeline identifies teams by all five champions and preserves feed sides, duplicates and observed intervals',()=>{
 const {windows,options}=fixture();const data=normalizeTimeline([...windows,...windows],options);
 assert.equal(data.blue.team,'B');assert.equal(data.red.team,'A');assert.equal(data.coverage.rawFrames,24);
 assert.equal(data.events[0].seconds,5);assert.equal(data.events[0].fromSeconds,4);
 assert.equal(data.events[0].killers[0].name,'B0');assert.equal(data.events[0].victims[0].name,'A0');assert.equal(data.events[0].pairingConfirmed,false);
 assert.equal(data.events[1].kind,'dragon');assert.equal(data.events[1].stealConfirmed,false);
 assert.equal(data.coverage.experience,false);assert.equal(data.coverage.positions,false);assert.equal(data.coverage.timeBasis,'feed_elapsed');
});
test('wrong match, incomplete archive, roster mismatch, frame gaps and contradictory totals cannot become ready',()=>{
 const variants=[f=>f.windows[0].esportsGameId='wrong',f=>f.windows[0].frames.at(-1).gameState='in_game',f=>f.options.players[0].champion='other',f=>f.windows[0].frames.splice(2,15),f=>f.options.players[0].gold=9000,f=>f.windows[0].frames[3].blueTeam.participants.pop(),f=>f.windows[0].frames[3]=null,f=>f.windows[0].gameMetadata.blueTeamMetadata.participantMetadata[0]=null,f=>f.options.sourceGameNumber=0];
 for(const change of variants){const f=fixture();change(f);assert.throws(()=>normalizeTimeline(f.windows,f.options),{code:'TIMELINE_INVALID'});}
});
test('champion display names map to source aliases and VOD links retain the correct set number',()=>{
 const f=fixture();
 f.options.players[0].champion='Wukong';
 f.windows[0].gameMetadata.redTeamMetadata.participantMetadata[0].championId='MonkeyKing';
 f.options.sourceGameNumber=3;
 const result=normalizeTimeline(f.windows,f.options);
 assert.equal(result.red.participants[0].champion,'Wukong');
 assert.equal(result.source.url,'https://lolesports.com/vod/456/3');
});
test('changed source rosters and per-player contradictions are rejected even when team totals agree',()=>{
 const inconsistent=fixture();
 const next=structuredClone(inconsistent.windows[0]);
 next.gameMetadata.blueTeamMetadata.participantMetadata[0].championId='Other';
 assert.throws(()=>normalizeTimeline([...inconsistent.windows,next],inconsistent.options),{code:'TIMELINE_INVALID'});
 const totals=fixture();
 totals.options.players[0].gold=500;
 totals.options.players[1].gold=700;
 assert.throws(()=>normalizeTimeline(totals.windows,totals.options),{code:'TIMELINE_INVALID'});
});
test('only explicit pause/resume evidence adjusts the clock while unmarked frame gaps remain invalid',()=>{
 const f=fixture(), frames=f.windows[0].frames;
 for(let index=6;index<frames.length;index++)frames[index].rfc460Timestamp=new Date(Date.parse(frames[index].rfc460Timestamp)+100000).toISOString();
 frames[5].gameState='paused';
 const resumed=structuredClone(frames[5]);resumed.gameState='in_game';resumed.rfc460Timestamp=new Date(Date.parse(frames[5].rfc460Timestamp)+100000).toISOString();
 frames.splice(6,0,resumed);
 const result=normalizeTimeline(f.windows,f.options);
 assert.equal(result.coverage.durationSeconds,23);
 assert.equal(result.coverage.wallDurationSeconds,123);
 assert.equal(result.coverage.pauseDurationSeconds,100);
 assert.equal(result.coverage.largestGapSeconds,1);
 assert.equal(result.coverage.largestWallGapSeconds,100);
 assert.equal(result.coverage.timeBasis,'feed_elapsed_pause_adjusted');
 assert.deepEqual(result.coverage.pauseIntervals,[{startTimestamp:frames[5].rfc460Timestamp,endTimestamp:resumed.rfc460Timestamp,durationSeconds:100}]);
 frames[5].gameState='in_game';
 assert.throws(()=>normalizeTimeline(f.windows,f.options),{code:'TIMELINE_INVALID'});
});
test('an imported timeline persists across service restarts; arbitrary game IDs never become file paths',async t=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'dolgg-timeline-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 const f=fixture(),data=normalizeTimeline(f.windows,f.options);await fs.writeFile(path.join(directory,fileName('g')),JSON.stringify(data));
 assert.equal((await createMatchTimelineService({directory}).getTimeline('g')).events.length,2);
 assert.equal((await createMatchTimelineService({directory}).getTimeline('../../.env')).state,'not_recorded');
});
