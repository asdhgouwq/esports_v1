import { TEAMS } from '../config/constants.js';
import { LEAGUE_STANDINGS } from '../data/league-standings.js';

export function renderLeagueStandings(activeLeague = 'LCK') {
  const leagueData = LEAGUE_STANDINGS[activeLeague] || LEAGUE_STANDINGS.LCK;
  const rows = leagueData.rows || [];

  const leagueTabs = ['LCK', 'LPL', 'LEC'].map(league => {
    const active = league === activeLeague ? ' aria-pressed="true"' : '';
    return `<button class="chip" data-league="${league}"${active}>${league}</button>`;
  }).join('');

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
    <div class="card">
      <div class="card-head">
        <h3 class="card-title">리그별 현 순위</h3>
      </div>
      <div class="card-body">
        <div class="league-tabs" style="display:flex;gap:4px;margin-bottom:16px">
          ${leagueTabs}
        </div>

        <div class="table-wrap">
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
        </div>
      </div>
    </div>
  `;
}
