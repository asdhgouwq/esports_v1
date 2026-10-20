// Imports the verified 2026 Worlds C9 vs KC game 1. Public feed; no API key or paid service.
const fs=require('node:fs/promises');const path=require('node:path');
const {normalizeTimeline,fileName}=require('../src/services/matchTimeline');
const db=require('../src/config/supabase');
const {collectWindows}=require('../src/services/lolesportsTimelineSource');
const gameId='2026 Season World Championship/Play-In_Round 1_1_1';
async function main(){
 const input=process.argv[2];
 const game=await db.from('matches').select('*').eq('game_id',gameId).single();
 const players=await db.from('player_stats').select('*').eq('game_id',gameId);
 if(game.error||players.error)throw Error('Stored match lookup failed');
 const windows=input?JSON.parse(await fs.readFile(path.resolve(input),'utf8')):await collectWindows({sourceGameId:'115660588583171787',startTime:game.data.datetime_utc,durationSeconds:Math.round(game.data.gamelength_number*60),progress:value=>console.log(JSON.stringify(value))});
 const timeline=normalizeTimeline(windows,{game:game.data,players:players.data,sourceEventId:'115660588583171786',sourceGameId:'115660588583171787'});
 const directory=path.resolve(__dirname,'../data/timelines');await fs.mkdir(directory,{recursive:true});
 await fs.writeFile(path.join(directory,fileName(gameId)),JSON.stringify(timeline));
 console.log(JSON.stringify({gameId,samples:timeline.samples.length,events:timeline.events.length,coverage:timeline.coverage}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
