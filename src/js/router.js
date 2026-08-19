const ROUTE_MAP = {
  lck: 'LCK',
  lpl: 'LPL',
  lec: 'LEC'
};

const PAGES = ['home', 'schedule', 'standings', 'teams', 'ai-analysis'];

export function parseRoute() {
  const hash = window.location.hash.slice(1) || 'lck/home';
  const parts = hash.split('/');

  const leagueId = parts[0] || 'lck';
  const page = parts[1] || 'home';

  if (!ROUTE_MAP[leagueId]) {
    navigateTo('lck', 'home');
    return { leagueId: 'lck', page: 'home' };
  }

  if (!PAGES.includes(page)) {
    navigateTo(leagueId, 'home');
    return { leagueId, page: 'home' };
  }

  return { leagueId, page };
}

export function navigateTo(leagueId, page) {
  window.location.hash = `${leagueId}/${page}`;
}

export function getLeagueName(leagueId) {
  return ROUTE_MAP[leagueId] || 'LCK';
}

export function onRouteChange(callback) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

export const LEAGUES = Object.entries(ROUTE_MAP).map(([id, name]) => ({
  id,
  name
}));

export const MENUS = [
  { id: 'home', label: '홈' },
  { id: 'schedule', label: '일정 · 결과' },
  { id: 'standings', label: '순위' },
  { id: 'teams', label: '팀' },
  { id: 'ai-analysis', label: 'AI 분석' }
];
