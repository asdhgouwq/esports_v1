export function buildMatchSummary(games) {
  const seen = new Set();
  const records = games.filter((game) => {
    if (!game.game_id || seen.has(game.game_id)) return false;
    seen.add(game.game_id);
    return true;
  }).sort((a,b) => (Number(a.game_number) || Date.parse(a.datetime_utc) || 0) - (Number(b.game_number) || Date.parse(b.datetime_utc) || 0));
  const teams = [records[0]?.team1, records[0]?.team2];
  const score = [0, 0];
  let confirmed = 0;
  let totalMinutes = 0;
  let timed = 0;

  const sets = records.map((game, index) => {
    const sameTeams = teams.every(Boolean) && teams[0] !== teams[1]
      && teams.every((team) => [game.team1, game.team2].includes(team));
    const winner = sameTeams && teams.includes(game.win_team) ? game.win_team : null;
    if (winner) {
      score[teams.indexOf(winner)]++;
      confirmed++;
    }
    const minutes = Number(game.gamelength_number);
    const duration = Number.isFinite(minutes) && minutes > 0 ? minutes : null;
    if (duration) {
      totalMinutes += duration;
      timed++;
    }
    return { gameId: game.game_id, index: Number.isInteger(Number(game.game_number)) && Number(game.game_number) > 0 ? Number(game.game_number) - 1 : index, winner, duration, score: [...score] };
  });

  let overview = '세트별 경기 기록이 연결되면 전체 결과와 경기 흐름을 한눈에 확인할 수 있습니다.';
  if (records.length && !confirmed) {
    overview = '수집된 세트의 승패가 아직 확인되지 않았습니다. 결과가 연결되면 시리즈 요약이 표시됩니다.';
  } else if (confirmed) {
    const result = score[0] === score[1]
      ? '양 팀의 세트 승수가 같습니다.'
      : `${teams[score[0] > score[1] ? 0 : 1]}이 기록된 세트 승수에서 앞서 있습니다.`;
    overview = `결과가 확인된 ${confirmed}세트 기준, ${teams[0]} ${score[0]} : ${score[1]} ${teams[1]}. ${result}`;
  }

  return {
    teams, score, sets, confirmed, overview,
    totalMinutes: timed ? totalMinutes : null,
    averageMinutes: timed ? totalMinutes / timed : null,
    timed,
  };
}

export function matchReviewKey(match, gameId) {
  const identity = match?.match_id
    ? [match.tournament, match.match_id, ...[match.team1, match.team2].sort()]
    : [gameId];
  return `dolgg:match-review:v1:${JSON.stringify(identity)}`;
}
