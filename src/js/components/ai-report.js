import { TEAMS } from '../config/constants.js';
import { formatDuration } from '../utils/format.js';

export function renderAIReportSeries(report) {
  const { series } = report;

  return `
    <div class="card">
      <div class="card-head">
        <h3 class="card-title">시리즈 종합 분석</h3>
      </div>
      <div class="card-body">
        <div class="ai-hero">
          <div style="margin-bottom:16px">
            <p style="font-size:18px;font-weight:700;line-height:1.6">${series.headline}</p>
          </div>

          <div style="font-size:14px;line-height:1.7;color:var(--ink-2);margin-bottom:16px">
            ${series.summary}
          </div>

          <div class="tag-row" style="gap:6px;display:flex;flex-wrap:wrap">
            ${series.tags?.map(tag => `<span class="tag">${tag}</span>`).join('') || ''}
          </div>

          <div style="margin-top:16px;display:flex;gap:8px;font-size:11px;color:var(--ink-3)">
            <span>신뢰도: ${series.confidence}%</span>
            <span>•</span>
            <span>시리즈 MVP: ${series.mvp}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderAIReportGame(game, matchId, setNum) {
  const { winner, duration, headline, summary, tags, confidence, mvp, phases = [], moments = [], ratings = [] } = game;

  const winnerTeam = TEAMS[winner];

  const phaseHtml = phases.map(p => `
    <div class="phase">
      <div>
        <div class="phase-k">${p.k}</div>
        <div class="phase-t">${p.t}</div>
      </div>
      <div>
        <div class="phase-body">${p.body}</div>
        <div class="phase-tags" style="display:flex;gap:5px;margin-top:8px;flex-wrap:wrap">
          ${p.tags?.map(tag => `<span class="tag" style="font-size:10px">${tag}</span>`).join('') || ''}
        </div>
      </div>
    </div>
  `).join('');

  const momentHtml = moments.slice(0, 4).map(m => `
    <div class="moment">
      <div class="moment-t">${m.m}</div>
      <div>
        <div class="moment-h">${m.h}</div>
        <div class="moment-d">${m.d}</div>
        <div class="swing" style="color:${m.s === 'a' ? '#3fd23f' : '#ff7a7a'}">${m.swing}</div>
      </div>
    </div>
  `).join('');

  const ratingHtml = ratings.slice(0, 5).map(r => `
    <div class="rating-row">
      <div style="text-align:center;font-size:9px;font-weight:700">${r.t}</div>
      <div class="rate-bar">
        <div class="rate-fill" style="width:${(r.r / 10) * 100}%;background:var(--accent)"></div>
      </div>
      <div style="text-align:right;font-size:12px;font-weight:700">${r.r.toFixed(1)}</div>
      <div style="font-size:11px;color:var(--ink-3)">${r.p}</div>
    </div>
  `).join('');

  return `
    <div class="card">
      <div class="card-head">
        <div style="display:flex;align-items:center;gap:8px;flex:1">
          <span style="font-weight:700;color:var(--accent)">${setNum}세트</span>
          <span style="color:${winnerTeam?.color};font-weight:700">${winnerTeam?.name} 승리</span>
          <span style="font-size:12px;color:var(--ink-3)">${formatDuration(duration)}</span>
        </div>
        <span class="tag" style="font-size:11px">신뢰도 ${confidence}%</span>
      </div>
      <div class="card-body" style="padding:16px;border-bottom:1px solid var(--line-soft)">
        <h4 style="font-size:16px;font-weight:700;margin-bottom:8px">${headline}</h4>
        <p style="font-size:13px;line-height:1.7;color:var(--ink-2)">${summary}</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px">
          ${tags?.map(tag => `<span class="tag" style="font-size:10px">${tag}</span>`).join('') || ''}
        </div>
      </div>

      <div style="padding:16px;border-bottom:1px solid var(--line-soft)">
        <h5 style="font-size:12px;font-weight:700;color:var(--ink-3);margin-bottom:12px">경기 흐름</h5>
        <div>${phaseHtml}</div>
      </div>

      <div style="padding:16px;border-bottom:1px solid var(--line-soft)">
        <h5 style="font-size:12px;font-weight:700;color:var(--ink-3);margin-bottom:12px">핵심 순간</h5>
        <div>${momentHtml}</div>
      </div>

      <div style="padding:16px;border-bottom:1px solid var(--line-soft)">
        <h5 style="font-size:12px;font-weight:700;color:var(--ink-3);margin-bottom:12px">선수 평점</h5>
        <div>${ratingHtml}</div>
      </div>

      <div style="padding:16px;background:var(--surface-2);border-radius:0 0 var(--r-lg) var(--r-lg);font-size:11px;color:var(--ink-3)">
        AI 자동 생성 분석입니다. 신뢰도가 낮은 부분은 참고만 하세요.
      </div>
    </div>
  `;
}
