import {dragonNames, objectiveTimeline} from './objectiveTimeline.js';

const number = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;

export function objectiveTotalsForGame(game, timeline) {
  const value = timeline?.objectiveTotals;
  if (!game?.game_id || timeline?.gameId !== game.game_id || value?.state !== 'ready' || value.gameId !== game.game_id
    || value.coverage?.totalsOnly !== true || value.coverage.eventTimes !== false || value.blue?.team === value.red?.team
    || !['blue','red'].every(side => value[side] && [game.team1,game.team2].includes(value[side].team)
      && ['grubs','herald'].every(key => value[side][key] === null || (Number.isInteger(value[side][key]) && value[side][key] >= 0)))) return null;
  if (timeline.state === 'ready' && ['blue','red'].some(side => timeline[side]?.team !== value[side].team)) return null;
  return value;
}

export function teamOverview(game, team, players = [], timeline) {
  const roster = players.filter(player => player.game_id === game?.game_id && player.team === team);
  const sum = key => roster.length === 5 && new Set(roster.map(player => player.name)).size === 5 && roster.every(player => number(player[key]) !== null)
    ? roster.reduce((total, player) => total + number(player[key]), 0) : null;
  const ready = timeline?.state === 'ready' && timeline.gameId === game?.game_id && timeline.coverage?.complete
    && timeline.blue?.team !== timeline.red?.team && [timeline.blue?.team, timeline.red?.team].every(name => name && [game?.team1, game?.team2].includes(name));
  const side = ready && (timeline.blue.team === team ? 'blue' : timeline.red.team === team ? 'red' : null);
  const last = side && timeline.samples?.at(-1);
  const events = side ? (timeline.events || []).filter(event => event.team === team && Number.isFinite(event.seconds) && event.seconds >= 0 && number(event.count) !== null) : [];
  const count = kind => side ? events.filter(event => event.kind === kind).reduce((total, event) => total + number(event.count), 0) : null;
  const dragonEvents = events.filter(event => event.kind === 'dragon').sort((a, b) => a.seconds - b.seconds);
  const dragonTypes = dragonEvents.flatMap(event => event.types || []);
  const knownDragons = Boolean(side) && dragonEvents.every(event => Array.isArray(event.types) && event.types.length === number(event.count) && event.types.every(type => Object.hasOwn(dragonNames, type)));
  const elementalTypes = dragonTypes.filter(type => type !== 'elder' && Object.hasOwn(dragonNames, type));
  const firsts = side ? objectiveTimeline(timeline).filter(event => event.team === team && ['first_blood', 'first_tower'].includes(event.kind)) : [];
  const objectiveTotals = objectiveTotalsForGame(game,timeline);
  const objectives = ['blue','red'].map(side => objectiveTotals?.[side]).find(value => value?.team === team);
  return {
    kills: number(last?.[`${side}Kills`]) ?? sum('kills'),
    deaths: sum('deaths'), assists: sum('assists'),
    gold: number(last?.[`${side}Gold`]) ?? sum('gold'),
    towers: count('tower'), dragons: count('dragon'), barons: count('baron'),
    dragonTypes, elementalTypes,
    elementalDragons: knownDragons ? elementalTypes.length : null,
    elders: knownDragons ? dragonTypes.filter(type => type === 'elder').length : null,
    firsts: firsts.map(event => event.kind),
    grubs: objectives?.grubs ?? (side && (timeline.coverage.voidGrubs || events.some(event => event.kind === 'void_grubs')) ? count('void_grubs') : null),
    herald: objectives?.herald ?? (side && (timeline.coverage.herald || events.some(event => event.kind === 'herald')) ? count('herald') : null),
  };
}

export function goldComparison(left, right) {
  if (number(left) === null || number(right) === null || Number(left) + Number(right) === 0) return null;
  return {leftPercent: Number(left) / (Number(left) + Number(right)) * 100, difference: Number(left) - Number(right)};
}
