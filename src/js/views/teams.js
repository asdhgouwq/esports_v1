import { TEAMS } from '../config/constants.js';
import { ROSTERS } from '../data/rosters.js';
import { renderTeamCard } from '../components/team-card.js';

export function renderTeams({ leagueId, container }) {
  if (!container) return;

  const teamCodes = Object.keys(TEAMS);
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
      ${teamCardsHtml}
    </div>
  `;
}
