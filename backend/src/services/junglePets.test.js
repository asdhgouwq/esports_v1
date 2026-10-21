const {test} = require('node:test');
const assert = require('node:assert/strict');
const {normalizeJunglePets, attachJunglePets} = require('./junglePets');
const timeline = () => ({state:'ready',gameId:'g1',source:{gameId:'source1'},samples:[{timestamp:'2026-10-20T00:00:00Z'},{timestamp:'2026-10-20T00:01:00Z'}],blue:{team:'A',participants:[{id:2,name:'JungleA',champion:'Lee Sin',role:'Jungle'}]},red:{team:'B',participants:[{id:7,name:'JungleB',champion:'Xin Zhao',role:'Jungle'}]}});
const details = () => ({frames:[{rfc460Timestamp:'2026-10-20T00:00:10Z',participants:[{participantId:2,items:[1101,2003]},{participantId:7,items:[1103]}]},{rfc460Timestamp:'2026-10-20T00:00:20Z',participants:[{participantId:2,items:[1107]},{participantId:7,items:[1105]}]}]});

test('recorded companion and evolved item IDs preserve actual pet colors',()=>{
  const pets=normalizeJunglePets(details(),timeline(),'source1');
  assert.deepEqual(pets.players.map(p=>[p.name,p.itemId]),[['JungleA','1101'],['JungleB','1103']]);
  const blue=details();blue.frames[1].participants[0].items=[1102];
  assert.equal(normalizeJunglePets(blue,timeline(),'source1').players[0].itemId,'1102');
});

test('unrelated games, out-of-game frames and ambiguous item IDs cannot supply a pet color',()=>{
  assert.throws(()=>normalizeJunglePets(details(),timeline(),'other'));
  const outside=details();outside.frames.forEach(frame=>frame.rfc460Timestamp='2026-10-21T00:00:00Z');
  assert.equal(normalizeJunglePets(outside,timeline(),'source1').players.length,0);
  const ambiguous=details();ambiguous.frames.forEach(frame=>frame.participants[0].items=[1101,1102]);
  assert.equal(normalizeJunglePets(ambiguous,timeline(),'source1').players.some(p=>p.name==='JungleA'),false);
});

test('pet enrichment requires the same game, player, team, champion and jungle role',()=>{
  const t=timeline();t.junglePets=normalizeJunglePets(details(),t,'source1');
  const data={gameId:'g1',players:t.junglePets.players.map(({name,team,champion})=>({name,team,champion}))};
  assert.equal(attachJunglePets(data,t).players[0].junglePet,'1101');
  assert.equal(data.players[0].junglePet,undefined);
  assert.equal(attachJunglePets({...data,gameId:'g2'},t).players[0].junglePet,undefined);
  for(const patch of [{name:'Other'},{team:'B'},{champion:'Gnar'}])assert.equal(attachJunglePets({...data,players:[{...data.players[0],...patch}]},t).players[0].junglePet,undefined);
  t.blue.participants[0].role='Support';assert.equal(attachJunglePets(data,t).players[0].junglePet,undefined);
});
