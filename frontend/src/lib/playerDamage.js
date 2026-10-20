export function playerDamageRanking(players, gameId) {
  const rows = players.filter(player => player.game_id === gameId).map(player => {
    const raw = player.damage_to_champions;
    const damage = raw === null || raw === undefined || raw === '' ? null : Number(raw);
    return {...player, damage: Number.isFinite(damage) && damage >= 0 ? damage : null};
  });
  const ranked = rows.filter(row => row.damage !== null).sort((a,b) => b.damage-a.damage || a.name.localeCompare(b.name));
  let rank = 0;
  return {missing: rows.length-ranked.length, players: ranked.map((row, index) => {
    if (index === 0 || row.damage !== ranked[index-1].damage) rank = index+1;
    return {...row, rank};
  })};
}

// A damage share is not an absolute damage amount. Only a recorded cumulative
// value at 15 minutes may be used to split the final total.
export function playerDamageSegments(player) {
  const raw = player.damage_to_champions_at_15;
  const before = raw === null || raw === undefined || raw === '' ? null : Number(raw);
  if (before === null || !Number.isFinite(before) || before < 0 || before > player.damage) return null;
  return {before, after: player.damage-before};
}
export function damageTeamRoster(players, team) {
  const positions = {top:0,jungle:1,jungler:1,jgl:1,mid:2,middle:2,bot:3,bottom:3,adc:3,support:4,sup:4};
  return players.filter(player=>player.team===team).sort((a,b)=>(positions[String(a.role).toLowerCase()]??5)-(positions[String(b.role).toLowerCase()]??5) || a.name.localeCompare(b.name));
}
