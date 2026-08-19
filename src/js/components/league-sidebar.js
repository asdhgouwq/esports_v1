import { LEAGUES, navigateTo } from '../router.js';

export function renderLeagueSidebar(activeLeague) {
  const leagueItems = LEAGUES.map(league => {
    const active = league.id === activeLeague ? ' aria-current="true"' : '';
    return `
      <button class="league-item" data-league="${league.id}"${active}>
        ${league.name[0]}
      </button>
    `;
  }).join('');

  return `
    <div style="display:flex;flex-direction:column;gap:12px;width:100%">
      ${leagueItems}
    </div>
  `;
}

export function bindLeagueSidebarEvents(container, currentLeague, currentPage) {
  container.querySelectorAll('[data-league]').forEach(btn => {
    btn.addEventListener('click', e => {
      const league = e.currentTarget.getAttribute('data-league');
      navigateTo(league, currentPage);
    });
  });
}
