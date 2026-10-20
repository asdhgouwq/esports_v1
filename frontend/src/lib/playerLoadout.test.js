import {test} from 'node:test';
import assert from 'node:assert/strict';
import {findRune,findSpell,findItem,findRoleQuest,matchingLoadout} from './playerLoadout.js';
test('rune and spell catalogs resolve source names and avoid alternate game modes',()=>{
 assert.equal(findRune(null,[{id:8000,name:'Precision'}]),null);
 assert.equal(findRune('Conqueror',[{id:8010,name:'Conqueror',icon:'rune.png'}]).id,8010);
 const spells=[{id:'SummonerFlash_Jade',name:'Flash',modes:['CLASSIC']},{id:'SummonerFlash',key:'4',name:'Flash',modes:['CLASSIC']}];
 assert.equal(findSpell('Flash',spells).id,'SummonerFlash');assert.equal(findSpell('4',spells).id,'SummonerFlash');assert.equal(findSpell('',spells),null);
});

test('catalog lookup ignores inherited object properties and malformed rosters',()=>{
 const catalog=Object.assign(Object.create({shadow:{name:'Secret item'}}),{'1001':{name:'Boots'}});
 assert.equal(findItem('shadow',catalog),null);
 assert.equal(findItem('constructor',catalog),null);
 assert.equal(findItem('__proto__',catalog),null);
 assert.equal(matchingLoadout({state:'ready',gameId:'g1',players:{}},{game_id:'g1'}),null);
});
test('item names resolve standard icons, preserve unknowns and never reuse another player or set loadout',()=>{
 const catalog={'3042':{name:'Muramana',image:{full:'3042.png'},maps:{11:true}},'323042':{name:'Muramana',image:{full:'323042.png'},maps:{11:true}}};
 assert.equal(findItem('Muramana',catalog).id,'3042');assert.equal(findItem('323042',catalog).id,'323042');assert.equal(findItem('unknown',catalog),null);
 const player={game_id:'g1',name:'A',team:'T',champion:'Ahri'},row={name:'A',team:'T',champion:'Ahri',items:[null,'Muramana']};
 assert.equal(matchingLoadout({state:'ready',gameId:'g1',players:[row]},player),row);
 for(const patch of [{game_id:'g2'},{name:'B'},{team:'U'},{champion:'Gnar'}])assert.equal(matchingLoadout({state:'ready',gameId:'g1',players:[row]},{...player,...patch}),null);
});

test('role quest slot uses source item and only a generic jungle icon when pet variant is absent',()=>{
 const catalog={'1205':{name:'Jungle Quest Reward',image:{full:'1205.png'}},'1209':{name:'Jungle Quest Reward',image:{full:'1209.png'}},'1221':{name:'Top Lane Quest Reward',image:{full:'1221.png'}}};
 assert.equal(findRoleQuest('Top Lane Quest Reward',catalog).id,'1221');
 assert.equal(findRoleQuest('Jungle Quest Reward',catalog).id,'1205');
 assert.equal(findRoleQuest('Jungle Quest Reward',catalog).generic,true);
 assert.equal(findRoleQuest('Missing Quest',catalog),null);assert.equal(findRoleQuest(null,catalog),null);
});
