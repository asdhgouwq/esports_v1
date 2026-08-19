import { LEAGUES, MENUS, navigateTo, getLeagueEmoji } from '../router.js';

export function renderLeagueNav(activeLeague) {
  return LEAGUES.map(league => {
    const active = league.id === activeLeague ? ' aria-current="true"' : '';
    return `
      <button class="league-item" data-league="${league.id}"${active}>
        <span>${getLeagueEmoji(league.id)}</span>
        <span>${league.name}</span>
      </button>
    `;
  }).join('');
}

export function bindLeagueNavEvents(container, currentLeague, currentPage) {
  container.querySelectorAll('[data-league]').forEach(btn => {
    btn.addEventListener('click', () => {
      const league = btn.getAttribute('data-league');
      navigateTo(league, currentPage);
    });
  });
}

export function renderSubmenuBar(activePage) {
  return MENUS.map(menu => {
    const active = menu.id === activePage ? ' aria-current="page"' : '';
    return `
      <button class="submenu-btn" data-page="${menu.id}"${active}>
        ${menu.label}
      </button>
    `;
  }).join('');
}

export function bindSubmenuBarEvents(container, currentLeague) {
  container.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.getAttribute('data-page');
      navigateTo(currentLeague, page);
    });
  });
}
