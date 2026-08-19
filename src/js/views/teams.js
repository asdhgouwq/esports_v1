import { TEAMS } from '../config/constants.js';
import { ROSTERS } from '../data/rosters.js';
import { renderTeamCard } from '../components/team-card.js';
import { getLeagueName } from '../router.js';

const LEAGUE_REGIONS = {
  lck: 'KR',
  lpl: 'CN',
  lec: 'EU',
  worlds: null,
  msi: null
};

export function renderTeams({ leagueId, container }) {
  if (!container) return;

  const region = LEAGUE_REGIONS[leagueId.toLowerCase()];
  const leagueName = getLeagueName(leagueId);

  const teamCodes = Object.keys(TEAMS).filter(code => {
    if (!region) return true;
    return TEAMS[code].region === region;
  });

  const teamCardsHtml = teamCodes.map(code => {
    const team = TEAMS[code];
    const roster = ROSTERS[code] || [];
    return renderTeamCard(team, roster);
  }).join('');

  container.innerHTML = `
    <div class="page-head">
      <h1 class="page-title">팀</h1>
    </div>

    <div class="team-grid">
      ${teamCardsHtml || '<div class="empty">팀 정보가 없습니다</div>'}
    </div>
  `;
}
