/**
 * RIFT.GG - Format Utilities
 * 숫자, 텍스트 포맷팅
 */

export function formatGold(num) {
  if (num === null || num === undefined) return '0';
  if (num === 0) return '0';
  if (num > 0) return `+${num.toLocaleString()}`;
  return num.toLocaleString();
}

export function formatWinRate(wins, losses) {
  if (wins + losses === 0) return '0%';
  return `${Math.round(wins / (wins + losses) * 100)}%`;
}

export function formatTime(timeStr) {
  if (!timeStr) return '-';
  return timeStr;
}

export function formatDuration(sec) {
  if (!sec) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatKDA(k, d, a) {
  if (d === 0) return `${k}/${d}/${a} (∞)`;
  const ratio = ((k + a) / d).toFixed(2);
  return `${k}/${d}/${a} (${ratio})`;
}

export function truncateText(text, maxLen) {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen) + '…';
}

export function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}
