import { TEAMS } from '../config/constants.js';
import { formatTime, formatDuration, formatGold } from '../utils/format.js';

export function renderMatchCard(match) {
  const teamA = TEAMS[match.a];
  const teamB = TEAMS[match.b];

  const statusClass = `match match-${match.status}`;

  let scoreHtml = '';
  if (match.status === 'live') {
    scoreHtml = `
      <div class="match-score">
        <span class="score">${match.sa ?? '-'}</span>
        <span class="separator">:</span>
        <span class="score">${match.sb ?? '-'}</span>
      </div>
      <div class="live-indicator">
        <span class="dot-live"></span>
        <span class="live-text">${match.liveNote}</span>
      </div>
    `;
  } else if (match.status === 'done') {
    scoreHtml = `
      <div class="match-score">
        <span class="score ${match.sa > match.sb ? 'win' : 'lose'}">${match.sa}</span>
        <span class="separator">:</span>
        <span class="score ${match.sb > match.sa ? 'win' : 'lose'}">${match.sb}</span>
      </div>
    `;
  }

  return `
    <div class="${statusClass}">
      <div class="match-time">
        <b>${formatTime(match.time)}</b>
        <div class="match-date">${match.date}</div>
      </div>
      <div class="match-teams">
        <div class="mt-row">
          <span class="mt-name" style="--tc:${teamA?.color}">${teamA?.name}</span>
          <span class="mt-score">${match.sa ?? '-'}</span>
        </div>
        <div class="mt-row">
          <span class="mt-name" style="--tc:${teamB?.color}">${teamB?.name}</span>
          <span class="mt-score">${match.sb ?? '-'}</span>
        </div>
      </div>
      ${scoreHtml}
    </div>
  `;
}
