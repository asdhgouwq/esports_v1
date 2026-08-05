/**
 * RIFT.GG - News Data
 * 최신 뉴스 및 소식
 */

export const NEWS = [
  { h:"한화생명, 라운드 4 4연승… 정규시즌 1위 매직넘버 2", m:"LCK · 2시간 전" },
  { h:"T1 vs 젠지 3세트, 시즌 최다 동시시청자 기록 경신", m:"LCK · 6시간 전" },
  { h:"쵸비, 라운드 3-4 구간 KDA 9.1로 전체 1위", m:"기록실 · 1일 전" },
  { h:"2026 월드 챔피언십 개최지 및 일정 공식 발표", m:"국제대회 · 2일 전" },
  { h:"한진 브리온, 미드 로머 교체 — 콜업 명단 공개", m:"로스터 · 3일 전" }
];

export function getRecentNews(limit = 5) {
  return NEWS.slice(0, limit);
}
