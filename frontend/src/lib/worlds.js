export function scheduleStatus(row) {
  return row.is_nullified ? 'cancelled' : row.winner ? 'completed' : 'scheduled';
}
export function scheduleTime(row) {
  if (!row.datetime_utc || !Number.isFinite(Date.parse(row.datetime_utc))) return { date: '일정 미정', time: '시간 미정' };
  const date = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(row.datetime_utc));
  const time = row.has_time ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(row.datetime_utc)) : '시간 미정';
  return { date, time };
}
export const stageLabel = (stage) => ({ 'Round 1': '1라운드', 'Round 2': '2라운드', 'Round 3': '3라운드', 'Round 4': '4라운드', 'Round 5': '5라운드', Quarterfinals: '8강', Semifinals: '4강', Finals: '결승' }[stage] || stage || '라운드 미정');
export function selectSchedules(rows, filter, search = '') {
  return rows.filter(row => (filter === 'all' || scheduleStatus(row) === filter) && `${row.team1 || ''} ${row.team2 || ''} ${row.tournament} ${stageLabel(row.stage)}`.toLowerCase().includes(search.trim().toLowerCase()));
}
