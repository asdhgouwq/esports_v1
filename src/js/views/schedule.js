import { MATCHES } from '../data/matches.js';
import { renderMatchCard } from '../components/match-card.js';

export function renderSchedule({ leagueId, container }) {
  const league = leagueId.toUpperCase();
  const filtered = MATCHES.filter(m => m.league === league);

  const grouped = {};
  filtered.forEach(m => {
    if (!grouped[m.date]) grouped[m.date] = [];
    grouped[m.date].push(m);
  });

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

    <div>
      ${matchesHtml || '<div class="empty">경기가 없습니다</div>'}
    </div>
  `;
}
