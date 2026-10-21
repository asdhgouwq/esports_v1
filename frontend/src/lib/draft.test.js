import { test } from 'node:test';
import assert from 'node:assert/strict';
import { championDetails, draftSlots, draftSequence, PICK_TURNS, teamDraft } from './draft.js';

const catalog = Object.fromEntries([
  { id: 'MonkeyKing', key: '62', name: '오공' }, { id: 'Renata', key: '888', name: '레나타 글라스크' },
  { id: 'Chogath', key: '31', name: '초가스' }, { id: 'Ahri', key: '103', name: '아리' },
].map((champion) => [champion.id, champion]));

test('draft aliases resolve to official image IDs and Korean champion names', () => {
  for (const name of ['Wukong', 'MonkeyKing', '오공', '62']) assert.equal(championDetails(name, catalog).id, 'MonkeyKing');
  assert.equal(championDetails('Renata Glasc', catalog).name, '레나타 글라스크');
  assert.equal(championDetails("Cho’Gath", catalog).id, 'Chogath');
  assert.equal(championDetails('unknown champion', catalog).name, 'unknown champion');
});

test('missing draft slots retain their positions and never turn into champion portraits', () => {
  assert.deepEqual(draftSlots(' Ahri, ,None,-,Renata Glasc,extra'), ['Ahri', null, null, null, 'Renata Glasc']);
  assert.deepEqual(draftSlots(null), [null, null, null, null, null]);
  assert.deepEqual(draftSlots(['Ahri', 'N/A']), ['Ahri', null, null, null, null]);
});

test('only unambiguous players from the selected game and explicit team can label picks', () => {
  const game = { game_id: 'g2', team1: 'RED YESTERDAY', team2: 'OTHER', team1_picks: 'Wukong,Ahri' };
  const player = { game_id: 'g2', champion: 'MonkeyKing', role: 'Jungle', name: 'correct', team: game.team1 };
  const players = [player, { ...player, game_id: 'g1', name: 'stale' }, { ...player, team: game.team2, name: 'wrong team' }, { game_id: 'g2', champion: 'Ahri', role: 'Mid', name: 'unknown team' }];
  let draft = teamDraft(game, 1, players, catalog);
  assert.equal(draft.picks[0].player, 'correct');
  assert.equal(draft.picks[0].role, 'JGL');
  assert.equal(draft.picks[1].player, null);
  assert.equal(draft.roleSorted, false);
  draft = teamDraft(game, 1, [...players, { ...player, name: 'ambiguous' }], catalog);
  assert.equal(draft.picks[0].player, null);
});

test('position ordering is used only for five verified distinct roles; sides follow each set', () => {
  const game = { game_id: 'g2', team1: 'BETA', team2: 'ALPHA', team1_picks: 'A,B,C,D,E' };
  const players = ['Support', 'Bot', 'Mid', 'Jungle', 'Top'].map((role, index) => ({ game_id: 'g2', team: 'BETA', champion: 'ABCDE'[index], role, name: role }));
  const draft = teamDraft(game, 1, players);
  assert.equal(draft.team, 'BETA');
  assert.equal(draft.roleSorted, true);
  assert.deepEqual(draft.picks.map((pick) => pick.champion.name), ['E', 'D', 'C', 'B', 'A']);
  const incomplete = teamDraft(game, 1, players.slice(1));
  assert.equal(incomplete.roleSorted, false);
  assert.equal(incomplete.picks[0].champion.name, 'A');
  assert.equal(teamDraft(game, 1, players, {}, {preserveOrder:true}).picks[0].champion.name, 'A');
});

test('verified sequence overrides role-order arrays and rejects results from previous sets', () => {
  const game = { game_id:'g2', team1:'ALPHA', team2:'BETA', team1_picks:'A,B,C,D,E' };
  const draft = { state:'ready', gameId:'g2', format:'tournament', sidesConfirmed:true, firstPickTeam:'ALPHA', blue:{team:'ALPHA',picks:['D','A','B','C','E'],bans:[null,null,null,null,null]},red:{team:'BETA',picks:['F','G','H','I','J'],bans:[null,null,null,null,null]} };
  const result = draftSequence(game, draft);
  assert.equal(result.ordered, true);
  assert.deepEqual(result.game.team1_picks, ['D','A','B','C','E']);
  assert.equal(draftSequence(game, {...draft,gameId:'g1'}).ordered, false);
  assert.equal(draftSequence(game, {...draft,state:'unavailable'}).firstPickTeam, null);
  assert.equal(draftSequence(game, {...draft,blue:{...draft.blue,team:'OTHER'}}).ordered, false);
});

test('two team pick rows combine into ten distinct chronological pick turns', () => {
  assert.deepEqual(PICK_TURNS.first, [1,4,5,8,9]);
  assert.deepEqual(PICK_TURNS.second, [2,3,6,7,10]);
  assert.deepEqual([...PICK_TURNS.first,...PICK_TURNS.second].sort((a,b)=>a-b), Array.from({length:10},(_,i)=>i+1));
});

test('a red first-picking team keeps the first turn while blue stays in the left column', () => {
  const game={game_id:'g1',team1:'BLUE',team2:'RED'};
  const side=team=>({team,picks:['A','B','C','D','E'],bans:[null,null,null,null,null]});
  const draft={state:'ready',gameId:'g1',format:'tournament',sidesConfirmed:true,firstPickTeam:'RED',blue:side('BLUE'),red:side('RED'),selections:{side:'BLUE',pick:'RED'}};
  const result=draftSequence(game,draft);
  assert.equal(result.game.team1,'BLUE');assert.equal(result.game.team2,'RED');
  assert.equal(result.firstPickTeam,'RED');assert.equal(result.sidesConfirmed,true);
  assert.deepEqual(result.selections,{side:'BLUE',pick:'RED'});
  const unknown=draftSequence(game,{...draft,sidesConfirmed:false,teams:[side('RED'),side('BLUE')],selections:{side:'OTHER'}});
  assert.equal(unknown.sidesConfirmed,false);assert.equal(unknown.firstPickTeam,'RED');assert.equal(unknown.selections.side,null);
});
