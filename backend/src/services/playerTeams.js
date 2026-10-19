const championKey = (value) => {
  const key = String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  return { wukong: 'monkeyking', renataglasc: 'renata', nunuwillump: 'nunu' }[key] || key;
};
const champions = (value) => String(value || '').split(',').map(championKey).filter(Boolean);

// Older databases have no team column. A champion uniquely identifies a side
// only when all ten distinct final picks are present in this exact game.
function attachPlayerTeams(players, games) {
  return players.map((player) => {
    const game = games.find((item) => item.game_id === player.game_id);
    if (!game || [game.team1, game.team2].includes(player.team)) return player;
    const blue = champions(game.team1_picks), red = champions(game.team2_picks);
    if (blue.length !== 5 || red.length !== 5 || new Set([...blue, ...red]).size !== 10) return player;
    const key = championKey(player.champion);
    const team = blue.includes(key) ? game.team1 : red.includes(key) ? game.team2 : null;
    return team ? { ...player, team } : player;
  });
}
module.exports = { attachPlayerTeams, championKey, champions };
