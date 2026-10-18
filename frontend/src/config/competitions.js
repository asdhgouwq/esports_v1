// Tournament names are provided by Leaguepedia. Keep aliases here so category
// navigation does not depend on a particular season or split name.
export const COMPETITION_GROUPS = [
  {
    id: 'regional', label: '지역별 리그', subtitle: 'REGIONAL LEAGUES',
    competitions: [
      { id: 'lck', label: 'LCK', description: '한국', mark: 'KR', pattern: /^LCK(?:\s+\d{4}\b|$)/i },
      { id: 'lpl', label: 'LPL', description: '중국', mark: 'CN', pattern: /^LPL(?:\s+\d{4}\b|$)/i },
      { id: 'lec', label: 'LEC', description: '유럽 · 중동 · 아프리카', mark: 'EMEA', pattern: /^LEC(?:\s+\d{4}\b|$)/i },
    ],
  },
  {
    id: 'international', label: '국제 대회', subtitle: 'GLOBAL EVENTS',
    competitions: [
      { id: 'worlds', label: 'WORLDS', description: '월드 챔피언십', mark: 'W', pattern: /\bWorlds\b|\bWorld Championship\b/i },
      { id: 'msi', label: 'MSI', description: '미드 시즌 인비테이셔널', mark: 'M', pattern: /\bMSI\b|\bMid[ -]Season Invitational\b/i },
      { id: 'fst', label: 'FST', description: '퍼스트 스탠드', mark: 'F', pattern: /\bFST\b|\bFirst Stand\b/i },
    ],
  },
];

export const COMPETITIONS = COMPETITION_GROUPS.flatMap((group) => group.competitions);

export function competitionPath(id) {
  const isLeague = COMPETITION_GROUPS[0].competitions.some((item) => item.id === id);
  return `/${isLeague ? 'leagues' : 'tournaments'}/${id}`;
}

export function belongsToCompetition(tournament, competitionId) {
  if (!competitionId) return true;
  const competition = COMPETITIONS.find((item) => item.id === competitionId);
  return Boolean(competition && competition.pattern.test(tournament || ''));
}
