import {test} from 'node:test';
import assert from 'node:assert/strict';
import {teamOverview, goldComparison, objectiveTotalsForGame} from './teamOverview.js';

const game = {game_id:'game-1', team1:'KC', team2:'C9'};
const roster = Array.from({length:5}, (_, i) => ({game_id:'game-1', team:'KC', name:`player-${i}`, kills:i, deaths:4, assists:1, gold:'10000'}));
const event = (id, kind, team, count, seconds, types) => ({id, kind, team, count, seconds, types});
const timeline = {
  state:'ready', gameId:'game-1', coverage:{complete:true, voidGrubs:false},
  blue:{team:'C9'}, red:{team:'KC'},
  samples:[{blueGold:76000, redGold:57400, blueKills:20, redKills:1}],
  events:[event('k','kills','C9',2,100), event('t','tower','KC',1,500), event('d','dragon','KC',1,600,['cloud']), event('t2','tower','KC',2,700), event('b','baron','C9',2,1500), event('g','void_grubs','OTHER',3,300)],
};

test('team totals follow confirmed teams even when source team order differs from sides', () => {
  const before = JSON.stringify(timeline);
  assert.deepEqual(teamOverview(game,'KC',roster,timeline), {
    kills:1, deaths:20, assists:5, gold:57400, towers:3, dragons:1, barons:0,
    dragonTypes:['cloud'], elementalTypes:['cloud'], elementalDragons:1, elders:0, firsts:['first_tower'], grubs:null, herald:null,
  });
  const c9 = teamOverview(game,'C9',[],timeline);
  assert.equal(c9.kills,20);
  assert.equal(c9.gold,76000);
  assert.equal(c9.barons,2);
  assert.deepEqual(c9.firsts,['first_blood']);
  assert.equal(JSON.stringify(timeline), before);
});

test('incomplete, stale and mismatched feeds never supply objective counts or firsts', () => {
  for (const patch of [{coverage:{complete:false}}, {gameId:'game-2'}, {state:'collecting'}, {blue:{team:'OTHER'}}]) {
    const totals = teamOverview(game,'KC',roster,{...timeline,...patch});
    assert.equal(totals.kills,10);
    assert.equal(totals.gold,50000);
    assert.equal(totals.towers,null);
    assert.equal(totals.dragons,null);
    assert.equal(totals.barons,null);
    assert.deepEqual(totals.firsts,[]);
  }
});

test('fallback requires five unique players with complete valid stats in the same game', () => {
  for (const players of [roster.slice(1), [...roster.slice(1),roster[1]], roster.map(p=>({...p,game_id:'other'})), roster.map(p=>({...p,kills:null,gold:-1}))]) {
    const totals = teamOverview(game,'KC',players);
    assert.equal(totals.kills,null);
    assert.equal(totals.gold,null);
  }
  assert.equal(teamOverview(game,'KC',roster).kills,10);
  assert.equal(teamOverview(undefined,undefined).gold,null);
});

test('unavailable grub and herald counters stay unknown; supported zeroes and collected events are shown', () => {
  const supported = {...timeline,coverage:{complete:true,voidGrubs:true,herald:true}};
  assert.equal(teamOverview(game,'KC',[],supported).grubs,0);
  assert.equal(teamOverview(game,'KC',[],supported).herald,0);
  const collected = {...timeline,events:[...timeline.events,event('g1','void_grubs','KC',3,350),event('h','herald','KC',1,800)]};
  assert.equal(teamOverview(game,'KC',[],collected).grubs,3);
  assert.equal(teamOverview(game,'KC',[],collected).herald,1);
});

test('elemental stacks remain chronological and never include elder dragon kills', () => {
  const mixed = {...timeline, events:[
    event('elder2','dragon','KC',1,3000,['elder']),
    event('first','dragon','KC',1,500,['cloud']),
    event('middle','dragon','KC',2,1100,['chemtech','infernal']),
    event('fourth','dragon','KC',1,1500,['infernal']),
    event('elder1','dragon','KC',1,2200,['elder']),
  ]};
  const totals = teamOverview(game,'KC',roster,mixed);
  assert.equal(totals.dragons,6);
  assert.equal(totals.elementalDragons,4);
  assert.equal(totals.elders,2);
  assert.deepEqual(totals.elementalTypes,['cloud','chemtech','infernal','infernal']);
});

test('missing dragon types are not turned into zero elders or known elemental stacks', () => {
  for (const types of [undefined,[],['unknown'],['toString']]) {
    const totals = teamOverview(game,'KC',[],{...timeline,events:[event('d','dragon','KC',1,600,types)]});
    assert.equal(totals.dragons,1);
    assert.equal(totals.elementalDragons,null);
    assert.equal(totals.elders,null);
  }
  const empty = teamOverview(game,'KC',[],{...timeline,events:[]});
  assert.equal(empty.elementalDragons,0);
  assert.equal(empty.elders,0);
  assert.equal(teamOverview(game,'KC').elders,null);
});

test('gold bar uses each team total and preserves ties, reversals, and unavailable records', () => {
  const first = goldComparison(57395,75994);
  assert.equal(first.difference,-18599);
  assert.equal(first.leftPercent,57395/(57395+75994)*100);
  assert.equal(goldComparison(75994,57395).difference,18599);
  assert.deepEqual(goldComparison(5000,5000),{leftPercent:50,difference:0});
  assert.deepEqual(goldComparison(0,5000),{leftPercent:0,difference:-5000});
  for (const values of [[null,50],[50,undefined],['',50],[-1,50],[Infinity,50],[0,0]]) assert.equal(goldComparison(...values),null);
});

test('verified final objective counts work without a timeline, follow teams, and preserve zero and missing values', () => {
  const objectiveTotals = {state:'ready',gameId:game.game_id,coverage:{totalsOnly:true,eventTimes:false},blue:{team:'C9',grubs:0,herald:null},red:{team:'KC',grubs:3,herald:1}};
  for (const data of [{state:'collecting',gameId:game.game_id,objectiveTotals},{...timeline,objectiveTotals}]) {
    assert.equal(teamOverview(game,'KC',[],data).grubs,3);
    assert.equal(teamOverview(game,'KC',[],data).herald,1);
    assert.equal(teamOverview(game,'C9',[],data).grubs,0);
    assert.equal(teamOverview(game,'C9',[],data).herald,null);
  }
  assert.deepEqual(teamOverview(game,'KC',[],{state:'collecting',gameId:game.game_id,objectiveTotals}).firsts,[]);
  for (const edit of [value => {value.gameId='other';},value => {value.blue.team='other';},value => {value.red.team='C9';},value => {value.red.grubs=-1;},value => {value.red.grubs='3';},value => {value.state='pending';}]) {
    const changed = structuredClone(objectiveTotals); edit(changed);
    assert.equal(objectiveTotalsForGame(game,{...timeline,objectiveTotals:changed}),null);
  }
  assert.equal(objectiveTotalsForGame(game,{...timeline,objectiveTotals:{...objectiveTotals,blue:objectiveTotals.red,red:objectiveTotals.blue}}),null);
});
