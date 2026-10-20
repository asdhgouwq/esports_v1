const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {normalizeLoadouts,createPlayerLoadoutService}=require('./playerLoadouts');
function fixture(){
 const roster=Array.from({length:10},(_,i)=>({name:`Player${i}`,game_id:'g1',team:i<5?'A':'B',champion:`Champion${i}`}));
 const rows=roster.map(p=>({Name:p.name,GameId:p.game_id,Team:p.team,Champion:p.champion,PrimaryTree:'Precision',SecondaryTree:'Resolve',Keystone:'Conqueror',SummonerSpells:'Flash,Teleport',Items:'Sword;;Boots;;;Shield',Trinket:'Stealth Ward',RoleBoundItem:'Top Lane Quest Reward'}));
 return {roster,rows};
}
test('loadouts preserve item slot positions and validate game, player, champion and team identities',()=>{
 const {roster,rows}=fixture(),result=normalizeLoadouts(rows,roster,'g1');
 assert.deepEqual(result[0].items,['Sword',null,'Boots',null,null,'Shield']);
 assert.deepEqual(result[0].spells,['Flash','Teleport']);assert.equal(result[0].secondaryTree,'Resolve');assert.equal(result[0].roleBoundItem,'Top Lane Quest Reward');
 for(const patch of [{Name:'Other'},{GameId:'g2'},{Team:'B'},{Champion:'Other'}])assert.throws(()=>normalizeLoadouts([{...rows[0],...patch},...rows.slice(1)],roster,'g1'));
 assert.throws(()=>normalizeLoadouts(rows.slice(1),roster,'g1'));
 assert.throws(()=>normalizeLoadouts([rows[0],rows[0],...rows.slice(2)],roster,'g1'));
});
test('verified public loadouts persist and simultaneous reads share one source request',async t=>{
 const {roster,rows}=fixture();const directory=await fs.mkdtemp(path.join(os.tmpdir(),'dol-loadouts-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));let calls=0;
 const db={from(table){return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{game_id:'g1',team1:'A',team2:'B'}}),then(resolve,reject){return Promise.resolve({data:table==='player_stats'?roster:[],error:null}).then(resolve,reject);}};}};
 const options={db,directory,source:{async cargoQuery(params){calls++;assert.match(params.fields,/SecondaryTree/);assert.match(params.fields,/RoleBoundItem/);return rows;}}};
 const service=createPlayerLoadoutService(options);const [a,b]=await Promise.all([service.getLoadouts('g1'),service.getLoadouts('g1')]);assert.deepEqual(a,b);assert.equal(calls,1);
 assert.deepEqual(await service.getLoadouts('g1'),a);assert.equal(calls,1);
 assert.equal((await createPlayerLoadoutService(options).getLoadouts('g1')).players.length,10);assert.equal(calls,1);
 const file=path.join(directory,(await fs.readdir(directory))[0]);await fs.writeFile(file,JSON.stringify({...a,version:1}));
 assert.equal((await createPlayerLoadoutService(options).getLoadouts('g1')).version,2);assert.equal(calls,2);
});

test('corrupt identities and expired disk caches are refreshed; memory avoids repeated database reads', async t => {
 const {roster,rows}=fixture();
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'dol-loadouts-expiry-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 let dbCalls=0, sourceCalls=0, time=Date.now();
 const db={from(table){dbCalls++;return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{game_id:'g1',team1:'A',team2:'B'}}),then(resolve,reject){return Promise.resolve({data:table==='player_stats'?roster:[],error:null}).then(resolve,reject);}};}};
 const options={db,directory,now:()=>time,source:{async cargoQuery(){sourceCalls++;return rows;}}};
 const service=createPlayerLoadoutService(options);
 await service.getLoadouts('g1');await service.getLoadouts('g1');
 assert.equal(dbCalls,2);assert.equal(sourceCalls,1);
 time+=61000;await service.getLoadouts('g1');assert.equal(dbCalls,4);assert.equal(sourceCalls,1);
 const file=path.join(directory,(await fs.readdir(directory))[0]);
 const cached=JSON.parse(await fs.readFile(file,'utf8'));cached.players[0].champion='WrongChampion';
 await fs.writeFile(file,JSON.stringify(cached));
 assert.equal((await createPlayerLoadoutService(options).getLoadouts('g1')).players[0].champion,'Champion0');
 assert.equal(sourceCalls,2);
 time+=86400001;await createPlayerLoadoutService(options).getLoadouts('g1');assert.equal(sourceCalls,3);
});

test('verified loadouts remain available when the disk cache cannot be written', async t => {
 const {roster,rows}=fixture();
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'dol-loadouts-readonly-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 const blocked=path.join(directory,'file');await fs.writeFile(blocked,'not a directory');
 const db={from(table){return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{game_id:'g1',team1:'A',team2:'B'}}),then(resolve,reject){return Promise.resolve({data:table==='player_stats'?roster:[],error:null}).then(resolve,reject);}};}};
 const service=createPlayerLoadoutService({db,directory:blocked,source:{cargoQuery:async()=>rows}});
 assert.equal((await service.getLoadouts('g1')).players.length,10);
 const invalid=createPlayerLoadoutService({db:{from(){assert.fail('Invalid game must not query DB');}}});
 assert.deepEqual(await invalid.getLoadouts(''),{state:'unavailable'});
});
