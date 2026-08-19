import { MATCHES } from '../data/matches.js';
import { REPORTS } from '../data/reports.js';
import { TEAMS } from '../config/constants.js';
import { renderAIReportSeries, renderAIReportGame } from '../components/ai-report.js';
import { renderDraftBoard } from '../components/draft-board.js';

export function renderAnalysis({ leagueId, container }) {
  if (!container) return;

  const doneMatches = MATCHES.filter(m => m.status === 'done' && REPORTS[m.id]).slice(0, 4);

  if (doneMatches.length === 0) {
    container.innerHTML = '<div class="empty">분석 가능한 경기가 없습니다</div>';
    return;
  }

  const activeMatch = doneMatches[0].id;

  const matchTabsHtml = doneMatches.map(m => {
    const teamA = TEAMS[m.a];
    const teamB = TEAMS[m.b];
    const active = m.id === activeMatch ? ' aria-pressed="true"' : '';
    return `
      <button class="chip" data-match="${m.id}"${active}>
        ${teamA?.name} ${m.sa} : ${m.sb} ${teamB?.name}
      </button>
    `;
  }).join('');

  const report = REPORTS[activeMatch];
  if (!report) {
    container.innerHTML = '<div class="empty">분석 데이터를 불러올 수 없습니다</div>';
    return;
  }

  const { series, games = [] } = report;

  const seriesTabsHtml = '<button class="set-tab" data-set="series" aria-pressed="true"><div class="st-n">종합</div></button>' +
    games.map((g, idx) => {
      const winner = TEAMS[g.winner];
      return `
        <button class="set-tab" data-set="${idx}">
          <div class="st-n">${idx + 1}세트</div>
          <div class="st-w">${winner?.name} 승</div>
        </button>
      `;
    }).join('');

  const seriesHtml = renderAIReportSeries(report);
  const gamesHtml = games.map((g, idx) => {
    return `<div class="set-view" data-set="${idx}" style="display:none">
      ${renderAIReportGame(g, activeMatch, idx + 1)}
      ${g.banpick ? renderDraftBoard(g.banpick) : ''}
    </div>`;
  }).join('');

  container.innerHTML = `
    <div class="page-head">
      <h1 class="page-title">AI 경기 분석</h1>
    </div>

    <div class="chip-row" style="margin-bottom:16px">
      ${matchTabsHtml}
    </div>

    <div class="set-bar">
      ${seriesTabsHtml}
    </div>

    <div style="margin-top:16px">
      <div class="set-view" data-set="series">
        ${seriesHtml}
      </div>
      ${gamesHtml}
    </div>
  `;

  container.querySelectorAll('[data-set]').forEach(btn => {
    btn.addEventListener('click', e => {
      const setIdx = e.target.closest('[data-set]').getAttribute('data-set');

      container.querySelectorAll('[data-set]').forEach(b => {
        b.removeAttribute('aria-pressed');
      });
      e.target.closest('[data-set]').setAttribute('aria-pressed', 'true');

      container.querySelectorAll('.set-view').forEach(v => {
        v.style.display = v.getAttribute('data-set') === setIdx ? 'block' : 'none';
      });
    });
  });
}
