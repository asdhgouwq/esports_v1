import { MATCHES } from '../data/matches.js';
import { STANDINGS } from '../data/standings.js';
import { NEWS } from '../data/news.js';
import { renderMatchCard } from '../components/match-card.js';
import { renderStandingsTable } from '../components/standings-table.js';
import { renderLeagueStandings } from '../components/league-standings.js';
import { renderChampionStats } from '../components/champion-stats.js';
import { store } from '../state/store.js';

export function renderHome() {
  const container = document.getElementById('view-home');
  if (!container) return;

  const liveMatches = MATCHES.filter(m => m.status === 'live');
  const upcomingMatches = MATCHES.filter(m => m.status === 'upcoming').slice(0, 2);

  const liveHtml = liveMatches.length > 0
    ? liveMatches.map(m => renderMatchCard(m)).join('')
    : '<div class="empty">진행 중인 경기가 없습니다</div>';

  const newsHtml = (NEWS || []).slice(0, 5).map(news => `
    <div class="news-item">
      <div class="news-dot"></div>
      <div>
        <div class="news-h">${news.h}</div>
        <div class="news-m">${news.m}</div>
      </div>
    </div>
  `).join('');

  const standingsLegend = STANDINGS.legend || {};
  const standingsHtml = renderStandingsTable(standingsLegend, '레전드 그룹');

  const leagueStandingsHtml = renderLeagueStandings(store.state.homeLeagueFilter || 'LCK');
  const championStatsHtml = renderChampionStats(store.state.homeChampionLeague || 'LCK');

  container.innerHTML = `
    <div class="page-head">
      <h1 class="page-title">홈</h1>
    </div>

    <div class="grid cols-main">
      <div>
        <div class="card">
          <div class="card-head">
            <h3 class="card-title">지금 진행 중</h3>
          </div>
          <div class="card-body">
            ${liveHtml}
          </div>
        </div>

        <div class="card" style="margin-top:16px">
          <div class="card-head">
            <h3 class="card-title">다음 경기</h3>
          </div>
          <div class="card-body">
            ${upcomingMatches.map(m => renderMatchCard(m)).join('') || '<div class="empty">예정된 경기가 없습니다</div>'}
          </div>
        </div>

        <div style="margin-top:16px">
          ${standingsHtml}
        </div>

        <div style="margin-top:16px">
          ${championStatsHtml}
        </div>
      </div>

      <div>
        <div class="card">
          <div class="card-head">
            <h3 class="card-title">소식</h3>
          </div>
          <div class="card-body">
            ${newsHtml}
          </div>
        </div>

        <div style="margin-top:16px">
          ${leagueStandingsHtml}
        </div>
      </div>
    </div>
  `;

  const leagueTabsContainers = container.querySelectorAll('.league-tabs');
  leagueTabsContainers.forEach((tabContainer, idx) => {
    tabContainer.querySelectorAll('[data-league]').forEach(btn => {
      btn.addEventListener('click', e => {
        const league = e.target.getAttribute('data-league');
        if (idx === 0) {
          store.setState('homeLeagueFilter', league);
        } else {
          store.setState('homeChampionLeague', league);
        }
        renderHome();
      });
    });
  });
}
