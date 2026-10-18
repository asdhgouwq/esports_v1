export function groupRecentMatches(matches) {
  const series = new Map();
  // A series can switch blue/red sides between games. Count wins by team name.
  const games = [...matches].sort((a, b) => timestamp(a.datetime_utc) - timestamp(b.datetime_utc));
  const seen = new Set();
  for (const game of games) {
    if (!game.game_id || seen.has(game.game_id)) continue;
    seen.add(game.game_id);
    if (!game.team1 || !game.team2 || ![game.team1, game.team2].includes(game.win_team)) continue;
    const key = JSON.stringify([game.tournament, game.match_id || game.game_id, ...[game.team1, game.team2].sort()]);
    if (!series.has(key)) series.set(key, {
      id: key, tournament: game.tournament || '대회 미기록',
      team1: game.team1, team2: game.team2, score1: 0, score2: 0,
      date: game.datetime_utc, latest: timestamp(game.datetime_utc), gameId: game.game_id,
      singleGame: !game.match_id,
    });
    const row = series.get(key);
    if (game.win_team === row.team1) row.score1++; else row.score2++;
    if (timestamp(game.datetime_utc) > row.latest) row.latest = timestamp(game.datetime_utc);
  }
  return [...series.values()].sort((a, b) => b.latest - a.latest || a.id.localeCompare(b.id));
}

function timestamp(value) {
  if (!value) return 0;
  const utc = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value.replace(' ', 'T')}Z`;
  return Date.parse(utc) || 0;
}

export function matchDate(value) {
  const time = timestamp(value);
  if (!time) return '날짜 미기록';
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(time);
}
