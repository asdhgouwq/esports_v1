import { TEAMS } from '../config/constants.js';

export function renderStandingsTable(groupData, groupLabel) {
  const rows = groupData.rows || [];

  const tableRows = rows.map((row, idx) => {
    const team = TEAMS[row.t];
    const qualClass = row.qual ? 'rank q' : 'rank';

    const formHtml = (row.form || []).map(result => {
      const pillClass = result === 'W' ? 'pill w' : 'pill l';
      return `<span class="${pillClass}">${result}</span>`;
    }).join('');

    return `
      <tr>
        <td><span class="${qualClass}">${idx + 1}</span></td>
        <td>
          <div class="team-cell">
            <span style="color:${team?.color}">■</span>
            <span>${team?.name}</span>
          </div>
        </td>
        <td class="t-center">${row.w}-${row.l}</td>
        <td class="t-center">${row.sw}-${row.sl}</td>
        <td class="t-center">${row.streak}</td>
        <td class="t-center">
          <div class="pill-row">${formHtml}</div>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div class="card">
      <div class="card-head">
        <h3 class="card-title">${groupLabel}</h3>
      </div>
      <div class="card-body">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>순위</th>
                <th>팀</th>
                <th>승-패</th>
                <th>세트</th>
                <th>연속</th>
                <th>최근</th>
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
