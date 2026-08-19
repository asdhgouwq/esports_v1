import { STANDINGS } from '../data/standings.js';
import { LEAGUE_STANDINGS } from '../data/league-standings.js';
import { renderStandingsTable } from '../components/standings-table.js';
import { getLeagueName } from '../router.js';

export function renderStandings({ leagueId, container }) {
  if (!container) return;

  const leagueKey = leagueId.toUpperCase();
  const leagueName = getLeagueName(leagueId);

  const leagueData = LEAGUE_STANDINGS[leagueKey] || LEAGUE_STANDINGS.LCK;
  const rows = leagueData.rows || [];

  const standingsHtml = renderStandingsTable({ rows }, `${leagueName} 순위`);

  container.innerHTML = `
    <div class="page-head">
      <h1 class="page-title">순위</h1>
    </div>

    <div>
      ${standingsHtml}
    </div>
  `;
}
