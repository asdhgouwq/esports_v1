import {test} from 'node:test';
import assert from 'node:assert/strict';
import {playerDamageRanking} from './playerDamage.js';
test('damage ranking keeps zero, excludes missing invalid or other-set records and preserves ties',()=>{
 const input=[['A','g1',300],['B','g1','500'],['C','g1',500],['Zero','g1',0],['Missing','g1',null],['Invalid','g1',-1],['Other','g2',900]].map(([name,game_id,damage_to_champions])=>({name,game_id,damage_to_champions}));
 const original=JSON.stringify(input), result=playerDamageRanking(input,'g1');
 assert.deepEqual(result.players.map(p=>[p.name,p.damage,p.rank]),[['B',500,1],['C',500,1],['A',300,3],['Zero',0,4]]);
 assert.equal(result.missing,2);assert.equal(JSON.stringify(input),original);
});

import {playerDamageSegments,damageTeamRoster} from './playerDamage.js';
test('15 minute segments require recorded absolute damage and never infer it from shares',()=>{
 assert.equal(playerDamageSegments({damage:10000,championDamageShare:0.3}),null);
 assert.equal(playerDamageSegments({damage:10000,damage_to_champions_at_15:null}),null);
 assert.equal(playerDamageSegments({damage:10000,damage_to_champions_at_15:10001}),null);
 assert.equal(playerDamageSegments({damage:10000,damage_to_champions_at_15:-1}),null);
 assert.deepEqual(playerDamageSegments({damage:10000,damage_to_champions_at_15:3000}),{before:3000,after:7000});
 assert.deepEqual(playerDamageSegments({damage:0,damage_to_champions_at_15:0}),{before:0,after:0});
});
test('team comparisons preserve role order and never assign unknown-team players',()=>{
 const players=[{name:'ADC',role:'Bot',team:'A'},{name:'Mid',role:'Mid',team:'A'},{name:'Unknown',role:'Top',team:null},{name:'Other',role:'Top',team:'B'},{name:'Top',role:'Top',team:'A'}];
 assert.deepEqual(damageTeamRoster(players,'A').map(p=>p.name),['Top','Mid','ADC']);
});
