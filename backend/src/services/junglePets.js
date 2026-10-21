const PETS = new Set(['1101', '1102', '1103']);
const VARIANTS = new Map([['1101','1101'], ['1102','1102'], ['1103','1103'], ['1105','1103'], ['1106','1102'], ['1107','1101']]);
const petId = value => VARIANTS.get(String(value)) || null;

function normalizeJunglePets(details, timeline, sourceGameId) {
  if (timeline?.state !== 'ready' || timeline.source?.gameId !== sourceGameId || !Array.isArray(details?.frames)) throw new Error('Jungle pet source mismatch');
  const start = Date.parse(timeline.samples[0].timestamp), end = Date.parse(timeline.samples.at(-1).timestamp);
  const players = [];
  for (const side of [timeline.blue, timeline.red]) {
    const junglers = side.participants.filter(player => player.role === 'Jungle');
    if (junglers.length !== 1) continue;
    const player = junglers[0];
    let observation;
    for (const frame of details.frames) {
      const time = Date.parse(frame.rfc460Timestamp);
      if (!(time >= start && time <= end)) continue;
      const rows = frame.participants?.filter(row => row.participantId === player.id) || [];
      const pets = [...new Set(rows.length === 1 ? (rows[0].items || []).map(petId).filter(Boolean) : [])];
      if (pets.length === 1 && (!observation || time > Date.parse(observation.observedAt))) observation = {participantId: player.id, name: player.name, team: side.team, champion: player.champion, itemId: pets[0], observedAt: frame.rfc460Timestamp};
    }
    if (observation) players.push(observation);
  }
  return {sourceGameId, source: 'LoL Esports LiveStats · participant items', players};
}

function attachJunglePets(loadouts, timeline) {
  const evidence = timeline?.junglePets;
  if (timeline?.state !== 'ready' || timeline.gameId !== loadouts.gameId || evidence?.sourceGameId !== timeline.source?.gameId || !Array.isArray(evidence?.players)) return loadouts;
  return {...loadouts, players: loadouts.players.map(player => {
    const side = [timeline.blue, timeline.red].find(team => team.team === player.team);
    const matches = evidence.players.filter(pet => pet.name === player.name && pet.team === player.team && pet.champion === player.champion && PETS.has(pet.itemId)
      && side?.participants.some(row => row.id === pet.participantId && row.name === player.name && row.champion === player.champion && row.role === 'Jungle'));
    return matches.length === 1 ? {...player, junglePet: matches[0].itemId} : player;
  })};
}
module.exports = {normalizeJunglePets, attachJunglePets};
