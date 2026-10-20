import {test} from 'node:test';
import assert from 'node:assert/strict';
import {objectiveTimeline} from './objectiveTimeline.js';
const data=events=>({blue:{team:'BLUE'},red:{team:'RED'},coverage:{complete:true},events});
const event=(id,kind,seconds,team='BLUE')=>({id,kind,seconds,team,count:1});
test('objectives retain all supported events and only game-wide first blood and tower',()=>{
 const input=data([event('k2','kills',80,'RED'),event('t2','tower',180),event('b','baron',900),event('t1','tower',120,'RED'),event('k1','kills',60),event('d','dragon',100),event('g','void_grubs',110),event('h','herald',300),event('i','inhibitor',950)]);
 const before=JSON.stringify(input);const events=objectiveTimeline(input);
 assert.deepEqual(events.map(e=>e.kind),['first_blood','dragon','void_grubs','first_tower','herald','baron']);
 assert.equal(events.find(e=>e.kind==='first_tower').team,'RED');
 assert.equal(JSON.stringify(input),before);
});
test('ambiguous or incomplete feeds never invent firsts, unrelated teams are excluded',()=>{
 const input=data([event('a','kills',60),event('b','kills',60,'RED'),event('t','tower',100),event('x','dragon',30,'OTHER')]);
 assert.deepEqual(objectiveTimeline(input).map(e=>e.kind),['first_tower']);
 input.coverage.complete=false;
 assert.deepEqual(objectiveTimeline(input),[]);
});
