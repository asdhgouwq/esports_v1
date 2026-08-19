import { STANDINGS } from '../data/standings.js';
import { renderStandingsTable } from '../components/standings-table.js';

export function renderStandings({ leagueId, container }) {
  const legend = STANDINGS.legend || {};
  const rise = STANDINGS.rise || {};

  const legendHtml = renderStandingsTable(legend, '레전드 그룹');
  const riseHtml = renderStandingsTable(rise, '라이즈 그룹');

  container.innerHTML = `
    <div class="page-head">
      <h1 class="page-title">순위</h1>
    </div>

    <div class="grid cols-1" style="gap:16px">
      ${legendHtml}
      ${riseHtml}
    </div>
  `;
}
