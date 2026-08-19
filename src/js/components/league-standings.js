import { TEAMS } from '../config/constants.js';
import { LEAGUE_STANDINGS } from '../data/league-standings.js';
import { getLeagueName } from '../router.js';

function renderStandingsTable(leagueId) {
  const leagueKey = leagueId.toUpperCase();
  const leagueData = LEAGUE_STANDINGS[leagueKey] || LEAGUE_STANDINGS.LCK;
  const rows = leagueData.rows || [];

  const tableRows = rows.map((row, idx) => {
    const team = TEAMS[row.t];
    const formHtml = (row.form || []).map(result => {
      const pillClass = result === 'W' ? 'pill w' : 'pill l';
      return `<span class="${pillClass}">${result}</span>`;
    }).join('');

    return `
      <tr>
        <td class="rank-cell"><span class="rank">${idx + 1}</span></td>
        <td>
          <div class="team-cell">
            <span style="color:${team?.color}">■</span>
            <span>${team?.name}</span>
          </div>
        </td>
        <td class="t-center">${row.w}-${row.l}</td>
        <td class="t-center">${row.sw}-${row.sl}</td>
        <td class="t-center">
          <div class="pill-row">${formHtml}</div>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <table>
      <thead>
        <tr>
          <th style="width:40px">순위</th>
          <th>팀</th>
          <th style="width:70px">승-패</th>
          <th style="width:80px">세트</th>
          <th style="width:90px">최근</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  `;
}

export function renderLeagueStandings(leagueId = 'lck') {
  const leagueKey = leagueId.toUpperCase();
  const leagueName = getLeagueName(leagueId);
  const tableHtml = renderStandingsTable(leagueId);

  return `
    <div class="card" id="league-standings-card">
      <div class="card-head">
        <h3 class="card-title">${leagueName} 순위</h3>
      </div>
      <div class="card-body">
        <div class="table-wrap">
          ${tableHtml}
        </div>
      </div>
    </div>
  `;
}

export function updateLeagueStandingsDOM(leagueId) {
  const card = document.getElementById('league-standings-card');
  if (!card) return;

  const leagueName = getLeagueName(leagueId);
  const tableHtml = renderStandingsTable(leagueId);

  card.innerHTML = `
    <div class="card-head">
      <h3 class="card-title">${leagueName} 순위</h3>
    </div>
    <div class="card-body">
      <div class="table-wrap">
        ${tableHtml}
      </div>
    </div>
  `;
}
