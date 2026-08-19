import { store } from './state/store.js';
import { parseRoute, onRouteChange } from './router.js';
import { renderLeagueNav, bindLeagueNavEvents, renderSubmenuBar, bindSubmenuBarEvents } from './components/gnb.js';
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

  renderGNB(leagueId, page);
  renderPageContent(leagueId, page);
}

function renderGNB(leagueId, page) {
  const leagueNav = document.getElementById('leagueNav');
  const submenuBar = document.getElementById('submenuBar');

  leagueNav.innerHTML = renderLeagueNav(leagueId);
  submenuBar.innerHTML = renderSubmenuBar(page);

  bindLeagueNavEvents(leagueNav, leagueId, page);
  bindSubmenuBarEvents(submenuBar, leagueId);
}

function renderPageContent(leagueId, page) {
  const mainContent = document.getElementById('mainContent');
  const sections = mainContent.querySelectorAll('.view');

  sections.forEach(section => section.classList.remove('is-active'));

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
