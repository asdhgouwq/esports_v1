export function renderTeamCard(team, roster) {
  const rosterHtml = (roster || []).map(([pos, ingame, realname, kda]) => `
    <div class="roster-row">
      <div class="pos">${pos}</div>
      <div>
        <div class="pl-name">${ingame}</div>
        <div class="pl-real">${realname}</div>
      </div>
      <div class="kda">${kda.toFixed(1)}</div>
    </div>
  `).join('');

  return `
    <div class="team-card" style="--tc:${team.color}">
      <h4>${team.name}</h4>
      <div class="team-meta">
        <span>${team.founded}년 설립</span>
        <span>${team.region}</span>
      </div>

      <div class="sep"></div>

      <div class="roster">
        ${rosterHtml}
      </div>
    </div>
  `;
}
