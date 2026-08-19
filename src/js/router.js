const LEAGUES = [
  { id: 'lck', name: 'LCK', emoji: '🇰🇷' },
  { id: 'lpl', name: 'LPL', emoji: '🇨🇳' },
  { id: 'lec', name: 'LEC', emoji: '🇪🇺' },
  { id: 'worlds', name: 'Worlds', emoji: '🌍' },
  { id: 'msi', name: 'MSI', emoji: '⭐' }
];

const PAGES = ['home', 'schedule', 'standings', 'teams', 'ai-analysis'];

export function parseRoute() {
  const hash = window.location.hash.slice(1) || 'lck/home';
  const parts = hash.split('/');

  const leagueId = parts[0] || 'lck';
  const page = parts[1] || 'home';

  if (!LEAGUES.find(l => l.id === leagueId)) {
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
  const league = LEAGUES.find(l => l.id === leagueId);
  return league ? league.name : 'LCK';
}

export function getLeagueEmoji(leagueId) {
  const league = LEAGUES.find(l => l.id === leagueId);
  return league ? league.emoji : '🇰🇷';
}

export function onRouteChange(callback) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

export { LEAGUES };

export const MENUS = [
  { id: 'home', label: '홈' },
  { id: 'schedule', label: '일정 · 결과' },
  { id: 'standings', label: '순위' },
  { id: 'teams', label: '팀' },
  { id: 'ai-analysis', label: 'AI 분석' }
];
