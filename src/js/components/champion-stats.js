import { CHAMPION_STATS } from '../data/champion-stats.js';

function renderChampionRow(champ, type = 'pick') {
  const iconUrl = champ.icon || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Crect fill=%22%23333%22 width=%2240%22 height=%2240%22 rx=%228%22/%3E%3C/svg%3E';

  return `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line-soft)">
      <div style="width:32px;flex:none;text-align:center;font-weight:700;color:var(--accent)">${champ.rank}</div>
      <img src="${iconUrl}" alt="${champ.name}" style="width:40px;height:40px;border-radius:6px;flex:none;object-fit:cover">
      <div style="flex:1;min-width:0">
        <div style="font-weight:650;font-size:13px">${champ.name}</div>
      </div>
      <div style="text-align:right;flex:none">
        <div style="font-size:12px;color:var(--ink-3)">
          ${type === 'pick' ? `픽 ${champ.count}회` : `밴 ${champ.count}회`}
        </div>
        <div style="font-weight:700;font-size:13px;color:var(--accent)">${champ.rate}%</div>
      </div>
    </div>
  `;
}

export function renderChampionStats(activeLeague = 'LCK') {
  const leagueData = CHAMPION_STATS[activeLeague] || CHAMPION_STATS.LCK;
  const picks = leagueData.picks || [];
  const bans = leagueData.bans || [];

  const leagueTabs = ['LCK', 'LPL', 'LEC'].map(league => {
    const active = league === activeLeague ? ' aria-pressed="true"' : '';
    return `<button class="chip" data-league="${league}"${active}>${league}</button>`;
  }).join('');

  const pickHtml = picks.map(champ => renderChampionRow(champ, 'pick')).join('');
  const banHtml = bans.map(champ => renderChampionRow(champ, 'ban')).join('');

  return `
    <div class="card">
      <div class="card-head">
        <h3 class="card-title">챔피언 밴픽 순위</h3>
      </div>
      <div class="card-body">
        <div class="league-tabs" style="display:flex;gap:4px;margin-bottom:16px">
          ${leagueTabs}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
          <div>
            <h4 style="font-size:13px;font-weight:700;color:var(--ink-2);margin-bottom:12px">최다 픽(Pick)</h4>
            <div>${pickHtml}</div>
          </div>

          <div>
            <h4 style="font-size:13px;font-weight:700;color:var(--ink-2);margin-bottom:12px">최다 밴(Ban)</h4>
            <div>${banHtml}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}
