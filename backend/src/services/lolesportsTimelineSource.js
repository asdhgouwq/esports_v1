const fs=require('node:fs/promises');const path=require('node:path');
// A narrowly scoped public-feed importer. This is not a guaranteed/supported Riot developer API.
async function collectWindows({sourceGameId,startTime,durationSeconds,cacheDir=path.resolve(__dirname,'../../.cache/lolesports'),fetchImpl=globalThis.fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms)),progress=()=>{}}){
 if(!/^\d{10,25}$/.test(sourceGameId)||!Number.isFinite(Date.parse(startTime))||!(durationSeconds>0&&durationSeconds<=7200))throw Error('Invalid timeline request');
 await fs.mkdir(cacheDir,{recursive:true});const start=Math.floor(Date.parse(startTime)/10000)*10000, windows=[];let seenFinished=false;
 for(let n=0;n<Math.ceil((durationSeconds+180)/10);n++){
  const stamp=new Date(start+n*10000).toISOString(),file=path.join(cacheDir,`${sourceGameId}-${start+n*10000}.json`);let data;
  try{data=JSON.parse(await fs.readFile(file,'utf8'));}catch{}
  if(!data){
   for(let attempt=0;attempt<3;attempt++){
    const response=await fetchImpl(`https://feed.lolesports.com/livestats/v1/window/${sourceGameId}?startingTime=${encodeURIComponent(stamp)}`,{signal:AbortSignal.timeout(25000)});
    if(response.status===429){await sleep(Math.max(15000,Math.min(300000,Number(response.headers.get('retry-after'))*1000||15000)));continue;}
    if(!response.ok)throw Error(`Public timeline source returned ${response.status}`);
    data=await response.json();break;
   }
   if(!data)throw Error('Source rate limit; retry after the requested cooldown');
   if(String(data.esportsGameId)!==sourceGameId||!Array.isArray(data.frames)||!data.frames.length)throw Error('Unexpected timeline source response');
   await fs.writeFile(file,JSON.stringify(data));await sleep(750);
  }
  windows.push(data);if(n%20===0)progress({windows:windows.length,lastTime:data.frames.at(-1).rfc460Timestamp});
  if(data.frames.some(f=>f.gameState==='finished')){if(seenFinished)return windows;seenFinished=true;}
 }
 throw Error('Timeline did not reach the game end; nothing imported');
}
module.exports={collectWindows};
