const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
const {collectWindows}=require('./lolesportsTimelineSource');
test('public source fetches timestamp windows without credentials, retains the last completed frame, and reuses its archive',async t=>{
 const cacheDir=await fs.mkdtemp(path.join(os.tmpdir(),'dolgg-feed-'));t.after(()=>fs.rm(cacheDir,{recursive:true,force:true}));let requests=0;
 const options={cacheDir,sourceGameId:'115660588583171787',startTime:'2026-10-15T18:16:00Z',durationSeconds:35, sleep:async()=>{},fetchImpl:async(url,options)=>{
  const parsed=new URL(url);assert.equal(parsed.hostname,'feed.lolesports.com');assert.ok(parsed.searchParams.get('startingTime'));assert.equal(options.headers,undefined);requests++;
  return {ok:true,json:async()=>({esportsGameId:'115660588583171787',frames:[{gameState:'finished',rfc460Timestamp:parsed.searchParams.get('startingTime')}]})};
 }};
 const first=await collectWindows(options);assert.equal(first.length,2);assert.equal(requests,2);
 const again=await collectWindows(options);assert.equal(again.length,2);assert.equal(requests,2);
});
test('access errors stop collection instead of retrying authentication or accepting partial data',async t=>{
 const cacheDir=await fs.mkdtemp(path.join(os.tmpdir(),'dolgg-feed-'));t.after(()=>fs.rm(cacheDir,{recursive:true,force:true}));
 let calls=0;await assert.rejects(collectWindows({cacheDir,sourceGameId:'115660588583171787',startTime:'2026-10-15T18:16:00Z',durationSeconds:35,sleep:async()=>{},fetchImpl:async()=>{calls++;return {ok:false,status:403};}}),/403/);assert.equal(calls,1);
});
