import { MATCHES } from '../data/matches.js';
import { LEAGUES } from '../config/constants.js';
import { renderMatchCard } from '../components/match-card.js';
import { store } from '../state/store.js';

export function renderSchedule() {
  const container = document.getElementById('view-schedule');
  if (!container) return;

  const league = store.state.filters.league || 'LCK';
  const tab = store.state.filters.tab || 'upcoming';

  const filtered = MATCHES.filter(m => m.league === league);
  const byStatus = {
    upcoming: filtered.filter(m => m.status === 'upcoming'),
    done: filtered.filter(m => m.status === 'done')
  };

  const matches = byStatus[tab] || [];

  const grouped = {};
  matches.forEach(m => {
    if (!grouped[m.date]) grouped[m.date] = [];
    grouped[m.date].push(m);
  });

  const leagueNames = Object.keys(LEAGUES);
  const leagueTabsHtml = leagueNames.map(lcode => {
    const active = lcode === league ? ' aria-pressed="true"' : '';
    return `<button class="chip" data-league="${lcode}"${active}>${lcode}</button>`;
  }).join('');

  const tabsHtml = ['upcoming', 'done'].map(t => {
    const active = t === tab ? ' aria-pressed="true"' : '';
    return `<button class="seg-btn" data-tab="${t}"${active}>${t === 'upcoming' ? '예정' : '결과'}</button>`;
  }).join('');

  const matchesHtml = Object.entries(grouped).map(([date, matchList]) => {
    const matchCards = matchList.map(m => renderMatchCard(m)).join('');
    return `
      <div class="day-label">${date}</div>
      ${matchCards}
    `;
  }).join('');

  container.innerHTML = `
    <div class="page-head">
      <h1 class="page-title">일정 · 결과</h1>
    </div>

    <div class="chip-row" style="margin-bottom:16px">
      ${leagueTabsHtml}
    </div>

    <div class="seg" style="margin-bottom:16px">
      ${tabsHtml}
    </div>

    <div>
      ${matchesHtml || '<div class="empty">경기가 없습니다</div>'}
    </div>
  `;

  // 이벤트 바인딩
  container.querySelectorAll('[data-league]').forEach(btn => {
    btn.addEventListener('click', e => {
      const league = e.target.getAttribute('data-league');
      store.setFilter('league', league);
      renderSchedule();
    });
  });

  container.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', e => {
      const tab = e.target.getAttribute('data-tab');
      store.setFilter('tab', tab);
      renderSchedule();
    });
  });
}
