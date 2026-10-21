const ALIASES = { wukong: 'MonkeyKing', nunuwillump: 'Nunu', renataglasc: 'Renata' };
const clean = (value) => String(value ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const ROLES = ['TOP', 'JGL', 'MID', 'BOT', 'SUP'];
const ROLE_ALIASES = { top: 'TOP', jungle: 'JGL', jungler: 'JGL', jgl: 'JGL', mid: 'MID', middle: 'MID', bot: 'BOT', bottom: 'BOT', adc: 'BOT', adcarry: 'BOT', support: 'SUP', sup: 'SUP' };

export function championDetails(value, catalog = {}) {
  const original = typeof value === 'string' ? value.trim() : '';
  if (!original) return null;
  const lookup = clean(ALIASES[clean(original)] || original);
  const champion = Object.values(catalog).find((item) => [item.id, item.name, item.key].some((name) => clean(name) === lookup));
  const fallback = ALIASES[clean(original)] || original.replace(/[^a-zA-Z0-9]/g, '');
  return { id: champion?.id || fallback, name: champion?.name || original, original };
}

export function draftSlots(value) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return Array.from({ length: 5 }, (_, index) => {
    const name = typeof values[index] === 'string' ? values[index].trim() : '';
    return !name || ['none', 'null', '-', '—', 'n/a'].includes(name.toLowerCase()) ? null : name;
  });
}

export const PICK_TURNS = { first: [1, 4, 5, 8, 9], second: [2, 3, 6, 7, 10] };

export function draftSequence(game, draft) {
  const sides = draft?.sidesConfirmed ? [draft.blue, draft.red] : draft?.teams;
  const valid = game && draft?.state === 'ready' && draft.gameId === game.game_id && draft.format === 'tournament'
    && Array.isArray(sides) && sides.length === 2
    && sides.every((side) => side && [game.team1, game.team2].includes(side.team)
      && ['picks', 'bans'].every((kind) => Array.isArray(side[kind]) && side[kind].length === 5))
    && sides[0].team !== sides[1].team && sides.some(side => side.team === draft.firstPickTeam);
  if (!valid) return { game, ordered: false, firstPickTeam: null, sidesConfirmed: false, selections: {} };
  const teamNames = sides.map(side => side.team);
  const selection = value => teamNames.includes(value) ? value : null;
  return {
    ordered: true, firstPickTeam: draft.firstPickTeam, sidesConfirmed: Boolean(draft.sidesConfirmed),
    selections: {side: selection(draft.selections?.side), pick: selection(draft.selections?.pick)},
    game: { ...game, team1: sides[0].team, team2: sides[1].team,
      team1_picks: sides[0].picks, team2_picks: sides[1].picks, team1_bans: sides[0].bans, team2_bans: sides[1].bans },
  };
}

export function teamDraft(game, side, players = [], catalog = {}, { preserveOrder = false } = {}) {
  const team = game?.[`team${side}`];
  const picks = draftSlots(game?.[`team${side}_picks`]).map((name) => {
    const champion = championDetails(name, catalog);
    if (!champion) return { champion: null, player: null, role: null };
    const candidates = players.filter((player) => player.team === team && player.team
      && (!game.game_id || player.game_id === game.game_id)
      && clean(championDetails(player.champion, catalog)?.id || player.champion) === clean(champion.id || champion.original));
    const player = candidates.length === 1 ? candidates[0] : null;
    return { champion, player: player?.name || null, role: ROLE_ALIASES[clean(player?.role)] || null };
  });
  const roleSorted = picks.every((pick) => pick.champion && pick.role) && new Set(picks.map((pick) => pick.role)).size === 5;
  return {
    team, roleSorted,
    picks: roleSorted && !preserveOrder ? [...picks].sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role)) : picks,
    bans: draftSlots(game?.[`team${side}_bans`]).map((name) => championDetails(name, catalog)),
  };
}
