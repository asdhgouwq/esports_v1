/**
 * RIFT.GG - Date Utilities
 * 날짜/시간 포맷팅 및 조작
 */

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${month}/${day}`;
}

export function formatDateKo(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${year}년 ${month}월 ${day}일`;
}

export function formatTime(timeStr) {
  return timeStr || '';
}

export function groupByDate(items) {
  const grouped = {};
  items.forEach(item => {
    if (!grouped[item.date]) {
      grouped[item.date] = [];
    }
    grouped[item.date].push(item);
  });
  return Object.entries(grouped).map(([date, items]) => ({
    date,
    items: items.sort((a, b) => a.time.localeCompare(b.time))
  }));
}

export function isToday(dateStr) {
  const today = new Date().toISOString().split('T')[0];
  return dateStr === today;
}

export function isFuture(dateStr) {
  const today = new Date().toISOString().split('T')[0];
  return dateStr > today;
}

export function isPast(dateStr) {
  const today = new Date().toISOString().split('T')[0];
  return dateStr < today;
}
