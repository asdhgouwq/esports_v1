import { store } from './state/store.js';
import { parseRoute, onRouteChange } from './router.js';
import { renderLeagueSidebar, bindLeagueSidebarEvents } from './components/league-sidebar.js';
import { renderSubmenuNav, bindSubmenuNavEvents } from './components/submenu-nav.js';
import { renderHome } from './views/home.js';
import { renderSchedule } from './views/schedule.js';
import { renderStandings } from './views/standings.js';
import { renderTeams } from './views/teams.js';
import { renderAnalysis } from './views/analysis.js';

export function initApp() {
  initTheme();
  renderApp();
  onRouteChange(renderApp);
}

function initTheme() {
  const html = document.documentElement;
  html.setAttribute('data-theme', store.state.theme);

  store.on('change', ({ path, value }) => {
    if (path === 'theme') {
      html.setAttribute('data-theme', value);
    }
  });

  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => store.toggleTheme());
  }
}

function renderApp() {
  const { leagueId, page } = parseRoute();

  renderLeagueSidebarUI(leagueId, page);
  renderSubmenuUI(leagueId, page);
  renderPageContent(leagueId, page);
}

function renderLeagueSidebarUI(leagueId, page) {
  const sidebar = document.getElementById('leagueSidebar');
  sidebar.innerHTML = renderLeagueSidebar(leagueId);
  bindLeagueSidebarEvents(sidebar, leagueId, page);
}

function renderSubmenuUI(leagueId, page) {
  const submenuNav = document.getElementById('submenuNav');
  submenuNav.innerHTML = renderSubmenuNav(leagueId, page);
  bindSubmenuNavEvents(submenuNav, leagueId);
}

function renderPageContent(leagueId, page) {
  const mainContent = document.getElementById('mainContent');
  const sections = mainContent.querySelectorAll('.view');

  sections.forEach(section => section.classList.remove('is-active'));
  mainContent.style.display = 'block';

  const pageMap = {
    home: 'view-home',
    schedule: 'view-schedule',
    standings: 'view-standings',
    teams: 'view-teams',
    'ai-analysis': 'view-ai'
  };

  const viewId = pageMap[page];
  const viewElement = mainContent.querySelector(`#${viewId}`);

  if (viewElement) {
    viewElement.classList.add('is-active');
    renderPage(leagueId, page, viewElement);
  }
}

function renderPage(leagueId, page, container) {
  const pageData = { leagueId, page, container };

  switch (page) {
    case 'home':
      renderHome(pageData);
      break;
    case 'schedule':
      renderSchedule(pageData);
      break;
    case 'standings':
      renderStandings(pageData);
      break;
    case 'teams':
      renderTeams(pageData);
      break;
    case 'ai-analysis':
      renderAnalysis(pageData);
      break;
  }
}

document.addEventListener('DOMContentLoaded', initApp);
